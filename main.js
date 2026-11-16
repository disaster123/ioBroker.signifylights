'use strict';

/*
 * Created with @iobroker/create-adapter v2.4.0
 */

const utils = require('@iobroker/adapter-core');
// const objectHelper = require('@apollon/iobroker-tools').objectHelper; // Common adapter utils
// const EventEmitter = require('node:events').EventEmitter;
const { randomUUID } = require('node:crypto');

const ip = require('ip');
// const os = require("node:os");
const dns = require('node:dns');

const AllDeviceAttributes = require('./lib/AllDeviceAttributes.js'); // Load attribute library
const ColorConv = require('./lib/colorconv.js'); // Load attribute library

const dgram = require('node:dgram');

class Signifylights extends utils.Adapter {
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */

    constructor(options) {
        super({
            ...options,
            name: 'signifylights',
        });

        this.HOST = ip.address(); //'0.0.0.0';
        this.PORTS = [38899, 38900];
        // nobody knows if eth0 exists - skip this here and rely on user provided MAC
        // this.MAC = os.networkInterfaces()['eth0'][0]['mac'].replace(/:/g, '').toUpperCase(); //JSON.stringify(os.networkInterfaces());//
        this.IP = ip.address();
        this.SOCKETS = {};
        this.ISONLINE = {};
        this.MESSAGEQUEUE = {};
        this.idlessReplyGuards = {};
        this.ipmap = {};
        this.maxAttempt = 10;
        this.sendTimeout = 1000;

        this.MESSAGEID = 1000;

        this.POLLER = null;
        this.timeoutList = {};

        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        // this.on("objectChange", this.onObjectChange.bind(this));
        // this.on("message", this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    async getIP(hostname) {
        const obj = await dns.promises.lookup(hostname).catch(error => {
            console.error(error);
        });
        return obj?.address;
    }

    async open_udp_sockets() {
        for (const i in this.PORTS) {
            this.ISONLINE[this.PORTS[i]] = false;
            this.SOCKETS[this.PORTS[i]] = dgram.createSocket('udp4');
            this.SOCKETS[this.PORTS[i]].bind(this.PORTS[i], this.HOST);

            this.SOCKETS[this.PORTS[i]].on('error', err => {
                this.log.debug(`server error:\n${err.stack}`);
                this.ISONLINE[this.PORTS[i]] = false;
                this.SOCKETS[this.PORTS[i]].close();
            });

            this.SOCKETS[this.PORTS[i]].on('message', (msg, client) => {
                this.ISONLINE[this.PORTS[i]] = true;

                //this.log.debug(`server got: ${msg} from ${client.address}:${client.port}`);

                this.WIZ__RECEIVE_MESSAGE(msg, client);
            });

            this.SOCKETS[this.PORTS[i]].on('listening', () => {
                this.ISONLINE[this.PORTS[i]] = true;
                // const address = this.SOCKETS[this.PORTS[i]].address();
                // this.log.debug(`server listening ${address.address}:${address.port}`);
            });
        }
    }

    WIZ__RECEIVE_MESSAGE(msg, client) {
        const objid = this.ipmap[client.address] || client.address;
        const queue = this.MESSAGEQUEUE[objid] || {};
        const endpointCandidates = Object.entries(queue).filter(([, data]) => data.port === client.port);
        // Receipt is evidence of reachability, never evidence that a write succeeded.
        for (const [, data] of endpointCandidates) {
            data.replyReceived = true;
        }
        if (objid in this.MESSAGEQUEUE) {
            this.WIZ__UPDATE_STATES(objid, { online: true });
        }
        const source = `${client.address}:${client.port}`;
        try {
            msg = JSON.parse(msg);
        } catch {
            this.log.warn(`UDP ${source}: malformed JSON reply; check device firmware/network`);
            return;
        }
        if (!msg || typeof msg !== 'object' || Array.isArray(msg)) {
            this.log.warn(`UDP ${source}: non-object JSON reply; check device firmware`);
            return;
        }
        // Only known method names and standard error descriptions are safe to log.
        const methods = ['getPilot', 'setPilot', 'getSystemConfig', 'registration', 'syncPilot'];
        const method = methods.includes(msg.method) ? msg.method : 'unknown';
        if (method === 'syncPilot' && msg.params && typeof msg.params === 'object' && !Array.isArray(msg.params)) {
            if (objid in this.MESSAGEQUEUE) {
                this.WIZ__UPDATE_STATES(objid, msg.params);
                const message = Buffer.from(JSON.stringify({ method: 'syncPilot', result: { mac: this.MAC } }));
                this.SOCKETS[38899].send(message, 0, message.length, 38899, client.address, err => {
                    if (err) {
                        this.log.warn(`UDP ${source} syncPilot: acknowledgement send failed`);
                    }
                });
            }
            return;
        }
        const candidates = endpointCandidates.filter(([, data]) => data.message.method === msg.method);
        const hasID = Object.hasOwn(msg, 'id');
        let matches = hasID ? candidates.filter(([, data]) => msg.id === data.message.id) : candidates;
        // Legacy getPilot requests use ID 0 as a wildcard, but an exact ID always wins.
        if (hasID && matches.length === 0 && typeof msg.id === 'number' && method === 'getPilot') {
            matches = candidates.filter(([, data]) => data.message.id === 0);
        }
        const guardKey = `${objid}:${client.port}:${method}`;
        const guarded =
            !hasID &&
            (this.idlessReplyGuards[guardKey] > Date.now() || candidates.some(([, data]) => data.idlessBlocked));
        const ambiguous = matches.length > 1;
        if (ambiguous && !hasID) {
            // These requests remain indistinguishable even if one later leaves the queue.
            for (const [, data] of candidates) {
                data.idlessBlocked = true;
            }
        }
        const resultValid = msg.result && typeof msg.result === 'object' && !Array.isArray(msg.result);
        const hasError = Object.hasOwn(msg, 'error');
        const errorValid =
            msg.error && typeof msg.error === 'object' && !Array.isArray(msg.error) && Number.isInteger(msg.error.code);
        const rejected = errorValid || (resultValid && msg.result.success === false);
        let detail = '';
        if (rejected) {
            const descriptions = {
                '-32700': 'Parse error',
                '-32600': 'Invalid request',
                '-32601': 'Method not found',
                '-32602': 'Invalid params; check command parameters',
                '-32603': 'Internal error',
                '-32605': 'Security error; check device authentication requirements',
            };
            const code = Number.isInteger(msg.error?.code) ? msg.error.code : 'unknown';
            const description =
                descriptions[code] ||
                (Object.hasOwn(msg, 'error')
                    ? 'Device error (untrusted message omitted)'
                    : 'Device reported success=false');
            detail = `: rejected code=${code} ${description}`;
        }
        if (matches.length !== 1 || guarded) {
            const reason = ambiguous
                ? 'ambiguous reply'
                : guarded
                  ? 'uncorrelated id-less reply (possible delayed/repeated response)'
                  : 'unmatched reply (method/port/ID)';
            this.log.warn(`UDP ${source} ${method}: ${reason}${detail}; pending requests retained`);
            return;
        }
        const [queueID, data] = matches[0];
        const success =
            resultValid &&
            (['getPilot', 'getSystemConfig'].includes(method) ||
                (['setPilot', 'registration'].includes(method) && msg.result.success === true));
        if ((hasError && !errorValid) || (!rejected && !success)) {
            this.log.warn(`UDP ${source} ${method}: invalid result; pending request retained`);
            return;
        }
        delete queue[queueID];
        // A duplicate id-less datagram must not consume a subsequent request of this method.
        this.idlessReplyGuards[guardKey] = Date.now() + this.maxAttempt * this.sendTimeout;
        for (const [, other] of candidates) {
            if (other !== data) {
                other.idlessBlocked = true;
            }
        }
        if (rejected) {
            this.log.warn(`UDP ${source} ${method}${detail}; retries stopped`);
        } else if (['getPilot', 'getSystemConfig'].includes(method)) {
            this.WIZ__UPDATE_STATES(objid, msg.result);
        } else if (method === 'registration') {
            this.WIZ__UPDATE_STATES(objid, { ip: client.address });
        }
    }

    async WIZ__UPDATE_STATES(ip, result) {
        try {
            const deviceId = ip.replace(/\./g, '_');
            const convert = AllDeviceAttributes.conv_wiz_iob;

            result.ip = ip;
            if (!('online' in result)) {
                result.online = true;
            }

            for (const key in result) {
                if (key in convert) {
                    if (['hsv', 'hsl', 'rgb', 'drvConf'].includes(key)) {
                        result[key] = JSON.stringify(result[key]);
                    }
                    if (key == 'temp' && result[key] == 0) {
                        // temp key 0 means unknown - which is invalid to set
                        // skip it
                        continue;
                    }
                    if (key == 'online') {
                        this.setState(`${deviceId}.${convert[key]}`, {
                            val: result[key],
                            ack: true,
                            expire: +this.config.listed_online,
                        });
                    } else {
                        this.setState(`${deviceId}.${convert[key]}`, { val: result[key], ack: true });
                    }
                }
            }
        } catch (err) {
            //this.log.debug(`__ERROR ->  ${FUNCTION_NAME} [ ${ip} : ${name} ]`);
            this.log.error(err);
        }
    }

    WIZ__QUEUE_MESSAGE(method, id, params, ip, port) {
        const queueID = randomUUID();
        const data = {
            ip: ip,
            port: port,
            attempt: 0,
            replyReceived: false,
            sendFailed: false,
            idlessBlocked: false,
            message: {
                method: method,
                id: id,
                params: params,
            },
            message_buffer: Buffer.from(JSON.stringify({ method, id, params })),
        };

        try {
            this.MESSAGEQUEUE[ip][queueID] = data;
            this.WIZ__SEND_MESSAGE(ip, queueID, this);
        } catch (e) {
            this.log.warn(`MSG QUEUE: IP: ${ip}Error: ${e}`);
        }
    }

    async WIZ__SEND_MESSAGE(ip, queueID, that) {
        const realip = await that.getIP(ip);
        if (!realip) {
            that.log.error(`WIZ__SEND_MESSAGE: cannot find ip of ${ip}`);
            // by deleting the queue we skip steps below
            delete that.MESSAGEQUEUE[ip][queueID];
        }
        if (
            ip in that.MESSAGEQUEUE &&
            queueID in that.MESSAGEQUEUE[ip] &&
            that.MESSAGEQUEUE[ip][queueID]['attempt'] < that.maxAttempt
        ) {
            that.ipmap[realip] = ip;
            that.ipmap[ip] = realip;

            that.MESSAGEQUEUE[ip][queueID]['attempt'] = ++that.MESSAGEQUEUE[ip][queueID]['attempt'];

            that.log.debug(
                `Nachricht ${queueID} gesendet -> ${ip} ${realip} Versuch: ${that.MESSAGEQUEUE[ip][queueID]['attempt']}`,
            );
            //that.log.warn(JSON.stringify(that.MESSAGEQUEUE[ip][queueID]['message']))

            that.SOCKETS[that.MESSAGEQUEUE[ip][queueID]['port']].send(
                that.MESSAGEQUEUE[ip][queueID]['message_buffer'],
                0,
                that.MESSAGEQUEUE[ip][queueID]['message_buffer'].length,
                that.MESSAGEQUEUE[ip][queueID]['port'],
                realip,
                err => {
                    if (err) {
                        const data = that.MESSAGEQUEUE[ip]?.[queueID];
                        if (data) {
                            data.sendFailed = true;
                            that.log.warn(`UDP ${realip}:${data.port} ${data.message.method}: send failed`);
                        }
                    }
                },
            );

            const timeoutid = that.setTimeout(function () {
                that.WIZ__SEND_MESSAGE(ip, queueID, that);
                delete that.timeoutList[timeoutid];
            }, that.sendTimeout);
            if (!timeoutid) {
                that.log.error('ERROR ERROR NO timeoutid returned');
            }
            that.timeoutList[timeoutid] = true;
        } else if (
            ip in that.MESSAGEQUEUE &&
            queueID in that.MESSAGEQUEUE[ip] &&
            that.MESSAGEQUEUE[ip][queueID]['attempt'] >= that.maxAttempt
        ) {
            const data = that.MESSAGEQUEUE[ip][queueID];
            const reason = data.replyReceived
                ? 'no matching reply (device replied)'
                : data.sendFailed
                  ? 'send failure; no reply received'
                  : 'no reply received';
            that.log.warn(`UDP ${realip}:${data.port} ${data.message.method}: retries exhausted; ${reason}`);
            that.idlessReplyGuards[`${ip}:${data.port}:${data.message.method}`] =
                Date.now() + that.maxAttempt * that.sendTimeout;
            delete that.MESSAGEQUEUE[ip][queueID];
            if (!data.replyReceived) {
                that.WIZ__UPDATE_STATES(ip, { online: false });
            }
        }
    }

    WIZ__GET_MESSAGEID() {
        const messageID = this.MESSAGEID;
        this.MESSAGEID = this.MESSAGEID + 1;
        if (this.MESSAGEID > 9999) {
            this.MESSAGEID = 1000;
        }
        return messageID;
    }

    WIZ__REGISTER(client_ip) {
        this.WIZ__QUEUE_MESSAGE(
            'registration',
            this.WIZ__GET_MESSAGEID(),
            { phoneMac: this.MAC, phoneIp: this.IP, register: true },
            client_ip,
            38899,
        );
    }

    WIZ__GETPILOT(client_ip) {
        this.WIZ__QUEUE_MESSAGE('getPilot', 0, {}, client_ip, 38899);
    }

    WIZ__SETPILOT(client_ip, params) {
        this.WIZ__QUEUE_MESSAGE('setPilot', this.WIZ__GET_MESSAGEID(), params, client_ip, 38899);
    }

    WIZ__GETSYSTEMCONFIG(client_ip) {
        this.WIZ__QUEUE_MESSAGE('getSystemConfig', this.WIZ__GET_MESSAGEID(), {}, client_ip, 38899);
    }

    WIZ__SET_STATE(client_ip, state) {
        this.WIZ__SETPILOT(client_ip, { state: state });
    }

    WIZ__SET_DIMMING(client_ip, state) {
        this.WIZ__SETPILOT(client_ip, { dimming: state });
    }

    WIZ__SET_COLORTEMP(client_ip, state) {
        // this.log.warn('colortemp '+client_ip+' '+state);
        this.WIZ__UPDATE_STATES(client_ip, { sceneid: 0 });
        this.WIZ__SETPILOT(client_ip, { temp: state });
    }

    async WIZ__SET_COLOR(client_ip) {
        const params = {};
        params.r = await this.WIZ__GET_IOB_STATE(client_ip, 'led.r');
        params.g = await this.WIZ__GET_IOB_STATE(client_ip, 'led.g');
        params.b = await this.WIZ__GET_IOB_STATE(client_ip, 'led.b');
        params.w = await this.WIZ__GET_IOB_STATE(client_ip, 'led.w');
        params.c = await this.WIZ__GET_IOB_STATE(client_ip, 'led.c');

        for (const key in params) {
            if (params[key] == null) {
                delete params[key];
            } else {
                params[key] = params[key]['val'];
            }
        }

        const rgb = [params.r, params.g, params.b];
        this.WIZ__SET_COLOR_RGB(client_ip, rgb);

        this.WIZ__UPDATE_STATES(client_ip, { sceneid: 0 });
        this.WIZ__SETPILOT(client_ip, params);
    }
    WIZ__SET_COLOR_HEX(client_ip, hex) {
        if (hex.startsWith('#')) {
            hex = hex.substring(1);
        }
        this.WIZ__SET_COLOR_RGB(client_ip, ColorConv.HEX2RGB(hex));
    }
    WIZ__SET_COLOR_HSL(client_ip, hsl) {
        if (!Array.isArray(hsl)) {
            hsl = JSON.parse(hsl);
        }
        this.WIZ__SET_COLOR_RGB(client_ip, ColorConv.HSL2RGB(hsl[0], hsl[1], hsl[2]));
    }
    WIZ__SET_COLOR_HSV(client_ip, hsv) {
        if (!Array.isArray(hsv)) {
            hsv = JSON.parse(hsv);
        }
        this.WIZ__SET_COLOR_RGB(client_ip, ColorConv.HSV2RGB(hsv[0], hsv[1], hsv[2]));
    }
    async WIZ__SET_COLOR_HUE(client_ip, hue) {
        try {
            if (typeof hue !== 'number' || !Number.isFinite(hue) || hue < 0 || hue > 360) {
                this.log.warn(`Cannot set hue for ${client_ip}: expected a number between 0 and 360`);
                return;
            }

            const states = await Promise.all(
                ['led.r', 'led.g', 'led.b'].map(key => this.WIZ__GET_IOB_STATE(client_ip, key)),
            );
            const rgb = [];
            for (const state of states) {
                const value = state?.val;
                if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 255) {
                    this.log.warn(`Cannot set hue for ${client_ip}: current RGB color is missing or invalid`);
                    return;
                }
                rgb.push(value);
            }

            const max = Math.max(...rgb);
            const min = Math.min(...rgb);
            const saturation = max === 0 ? 0 : ((max - min) / max) * 100;
            const value = (max / 255) * 100;
            this.WIZ__SET_COLOR_RGB(client_ip, ColorConv.HSV2RGB(hue, saturation, value));
        } catch (err) {
            this.log.warn(`Cannot set hue for ${client_ip}: ${err}`);
        }
    }

    WIZ__SET_COLOR_RGB(client_ip, rgb) {
        if (!Array.isArray(rgb)) {
            rgb = JSON.parse(rgb);
        }
        const params = { r: rgb[0], g: rgb[1], b: rgb[2] };
        const hsv = ColorConv.RGB2HSV(params.r, params.g, params.b);
        const hsl = ColorConv.RGB2HSL(params.r, params.g, params.b);
        const hex = ColorConv.RGB2HEX(params.r, params.g, params.b);
        const hue = ColorConv.RGB2HUE(params.r, params.g, params.b);

        this.WIZ__UPDATE_STATES(client_ip, {
            sceneid: 0,
            rgb: rgb,
            hsv: hsv,
            hsl: hsl,
            hex: hex,
            hue: hue,
            r: rgb[0],
            g: rgb[1],
            b: rgb[2],
            c: 0,
            w: 0,
        });
        this.WIZ__SETPILOT(client_ip, params);
    }

    WIZ__SET_SPEED(client_ip, state) {
        this.WIZ__SETPILOT(client_ip, { speed: state });
    }

    WIZ__SET_SCENE(client_ip, state) {
        this.WIZ__SETPILOT(client_ip, { sceneid: state });
    }

    async WIZ__GET_IOB_STATE(ip, key) {
        const client_ip = ip.replace(/\./g, '_');
        return await this.getStateAsync(`${client_ip}.${key}`);
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // const that = this;
        // Initialize your adapter here
        // Reset the connection indicator during startup
        this.setState('info.connection', false, true);

        if (!(this.config.bind_ip && this.config.bind_ip.length > 0)) {
            this.log.error('adapter is unconfigured, bind ip missing');
        } else {
            this.HOST = this.config.bind_ip;
            this.log.info(`config bind ip address: ${this.config.bind_ip}`);
            if (
                this.config.register_devices === true &&
                !(
                    this.config.udpip &&
                    this.config.udpip.length > 0 &&
                    this.config.udpmac &&
                    this.config.udpmac.length > 0
                )
            ) {
                this.log.error('adapter is unconfigured, udp target ip and/or udp mac address for auto update missing');
            } else {
                if (this.config.register_devices === true) {
                    this.log.info('config register devices for auto update: enabled');
                    this.IP = this.config.udpip;
                    this.log.info(`config udp target IP for auto update: ${this.config.udpip}`);
                    this.MAC = this.config.udpmac.replace(/:/g, '').toUpperCase();
                    this.log.info(`config udp mac address for auto update: ${this.MAC}`);
                }
                await this.open_udp_sockets();

                await this.WIZ__INIT_ALL_DEVICES();

                this.setState('info.connection', true, true);
            }
        }
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     *
     * @param {() => void} callback Callback supplied by ioBroker
     */
    onUnload(callback) {
        try {
            for (const i in this.SOCKETS) {
                this.SOCKETS[i].close();
                this.ISONLINE[i] = false;
            }
            if (this.POLLER) {
                clearInterval(this.POLLER);
            }
            for (const i in this.timeoutList) {
                clearTimeout(this.timeoutList[i]);
            }
            this.timeoutList = {};

            callback();
        } catch {
            callback();
        }
    }

    /**
     * Is called if a subscribed state changes
     *
     * @param {string} id ID of the changed state
     * @param {ioBroker.State | null | undefined} state New state value
     */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            if (state.ack == false) {
                const state_name = id.split('.').slice(-2).join('.');

                // The evaluated handler references this variable by name.
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const client_ip = id.split('.').slice(2, 3).join().replace(/_/g, '.');

                // The evaluated handler references this variable by name.
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const state_value = state.val;
                eval(AllDeviceAttributes.get_on_function(state_name));
                //this.log.info(`state ${state_name} changed: ${state.val} (ack = ${state.ack}) ${JSON.stringify(state)}`);
            }
        } else {
            // The state was deleted
            // ToDo: register again ????
            //this.log.info(`state ${id} deleted`);
        }
    }

    async WIZ__INIT_ALL_DEVICES() {
        const FUNCTION_NAME = 'WIZ__INIT_ALL_DEVICES';
        //this.log.debug(`_START -> ${FUNCTION_NAME}`);

        try {
            const devices = this.config.devices;
            let ip;
            let name;
            for (const k in devices) {
                if (devices[k].active == true) {
                    ip = devices[k].ip;
                    name = devices[k].name;
                    await this.WIZ__INIT_DEVICE(ip, name);
                }
            }

            const deviceStates = AllDeviceAttributes.defaults;
            if (deviceStates) {
                for (const statename in deviceStates) {
                    const state = deviceStates[statename];
                    if ('on' in state) {
                        this.subscribeStates(`*.${statename}`);
                    }
                }
            }
            //this.log.debug(`_END -> ${FUNCTION_NAME}`);
        } catch (err) {
            this.log.debug(`_ERROR -> ${FUNCTION_NAME}`);
            this.log.error(err);
        }
    }

    async WIZ__INIT_DEVICE(ip, name) {
        const FUNCTION_NAME = 'WIZ__INIT_DEVICES';
        this.log.debug(`__START ->  ${FUNCTION_NAME} [ ${ip} : ${name} ]`);

        try {
            const deviceId = ip.replace(/\./g, '_');
            this.MESSAGEQUEUE[ip] = {};
            this.log.debug(`-> CREATE Device: ${deviceId}`);

            let deviceStates = AllDeviceAttributes.MINIMAL();
            let deviceType = 'MINIMAL';

            const obj = await this.getStateAsync(`${deviceId}.system.moduleName`);

            if (obj && typeof obj.val === 'string' && obj.val.length > 5) {
                deviceType = obj.val;
                //this.log.warn(deviceType);
            }
            this.log.debug(`-> CREATE DeviceType: ${deviceType}`);

            if (deviceType == 'MINIMAL') {
                // reschedule until we know device type...
                const timeoutid = this.setTimeout(() => {
                    this.WIZ__INIT_DEVICE(ip, name);
                    delete this.timeoutList[timeoutid];
                }, 5000);
                if (!timeoutid) {
                    this.log.error('ERROR ERROR NO ${timeoutid} returned');
                }
                this.timeoutList[timeoutid] = true;
            }

            if (eval(`typeof AllDeviceAttributes.${deviceType}() !== "undefined"`)) {
                this.log.debug(`-> CREATE DeviceType: EVAL ${deviceType}`);
                deviceStates = eval(`AllDeviceAttributes.${deviceType}()`);
            }

            if (deviceStates) {
                await this.extendObjectAsync(deviceId, {
                    type: 'device',
                    common: {
                        name: `Device: ${name} - ${ip}`,
                    },
                    native: {
                        ip: ip,
                        name: name,
                        mac: '', // ToDo:
                    },
                });

                for (const statename in deviceStates) {
                    const state = deviceStates[statename];

                    const channelId = statename.split('.').slice(0, 1).join();

                    if (channelId !== statename) {
                        //this.log.debug(`-> CREATE CHANNEL: ${deviceId}.${channelId}`);
                        await this.extendObjectAsync(`${deviceId}.${channelId}`, {
                            type: 'channel',
                            common: {
                                name: `Channel: ${channelId}`,
                            },
                            native: {},
                        });
                    }

                    //this.log.debug(`-> CREATE STATE: ${deviceId}.${statename}`);
                    await this.extendObjectAsync(`${deviceId}.${statename}`, {
                        type: 'state',
                        common: state.common,
                    });
                }
            }

            const reg = await this.WIZ__GET_IOB_STATE(ip, 'system.register');
            if (this.config.register_devices == true && reg != null && reg.val == true) {
                this.WIZ__REGISTER(ip);
            }
            this.WIZ__GETSYSTEMCONFIG(ip);
            this.WIZ__GETPILOT(ip);
            if (this.config.polling_intervall > 0) {
                this.POLLER = this.setInterval(this.WIZ__GETPILOT.bind(this), this.config.polling_intervall * 1000, ip);
            }

            //this.log.debug(`__END ->  ${FUNCTION_NAME} [ ${ip} : ${name} ]`);
        } catch (err) {
            this.log.debug(`__ERROR ->  ${FUNCTION_NAME} [ ${ip} : ${name} ]`);
            this.log.error(err);
        }
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options] Adapter options
     */
    module.exports = options => new Signifylights(options);
} else {
    // otherwise start the instance directly
    new Signifylights();
}
