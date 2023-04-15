"use strict";

/*
 * Created with @iobroker/create-adapter v2.4.0
 */

const utils = require("@iobroker/adapter-core");
// const objectHelper = require('@apollon/iobroker-tools').objectHelper; // Common adapter utils
// const EventEmitter = require('events').EventEmitter;
const uuid = require('uuid');

const ip = require("ip");
// const os = require("os");
const dns = require('dns');

const AllDeviceAttributes = require('./lib/AllDeviceAttributes.js'); // Load attribute library
const ColorConv = require('./lib/colorconv.js'); // Load attribute library

const dgram = require('dgram');

class Signifylights extends utils.Adapter {

    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */

    constructor(options) {
        super({
            ...options,
            name: "signifylights",
        });

        this.HOST = ip.address();//'0.0.0.0';
        this.PORTS = [38899, 38900];
        // nobody knows if eth0 exists - skip this here and rely on user provided MAC
        // this.MAC = os.networkInterfaces()['eth0'][0]['mac'].replace(/:/g, '').toUpperCase(); //JSON.stringify(os.networkInterfaces());//
        this.IP = ip.address();
        this.SOCKETS = {};
        this.ISONLINE = {};
        this.MESSAGEQUEUE = {};
        this.ipmap = {};
        this.maxAttempt = 10;
        this.sendTimeout = 1000;

        this.MESSAGEID = 1000;

        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        // this.on("objectChange", this.onObjectChange.bind(this));
        // this.on("message", this.onMessage.bind(this));
        this.on("unload", this.onUnload.bind(this));
    }

    async getIP(hostname) {
        const obj = await dns.promises.lookup(hostname).catch((error)=>
        {
            console.error(error);
        });
        return obj?.address;
    }

    async open_udp_sockets() {
        for (const i in this.PORTS) {
            this.ISONLINE[this.PORTS[i]] = false;
            this.SOCKETS[this.PORTS[i]] = dgram.createSocket('udp4');
            this.SOCKETS[this.PORTS[i]].bind(this.PORTS[i], this.HOST);

            this.SOCKETS[this.PORTS[i]].on('error', (err) => {
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
        const that = this;
        // QUEUE löschen
        try {
            msg = JSON.parse(msg);
        } catch (err) {
            this.log.error(err);
        }
        let objid = client.address;
        if (client.address in this.ipmap) {
            objid = this.ipmap[client.address];
        }
        if ('result' in msg) {
            if (objid in this.MESSAGEQUEUE) {
                //this.log.debug(JSON.stringify(client));
                for (const queueID in this.MESSAGEQUEUE[objid]) {
                    const data = this.MESSAGEQUEUE[objid][queueID];
                    if (msg.method == data.message.method && client.port == data.port) {

                        if (msg.method == 'getPilot' && ( msg.id == data.message.id || data.message.id == 0 ) ) {
                            delete this.MESSAGEQUEUE[objid][queueID];
                            //this.log.debug(`[getPilot] ${client.address}:${client.port} success`);

                            //msg.result = AllDeviceAttributes.override_with_null_not_exists()
                            //Object.assign(AllDeviceAttributes.led_empty, msg.result);

                            this.WIZ__UPDATE_STATES(objid, msg.result);

                        } else if (msg.method == 'setPilot' &&  msg.id == data.message.id && msg.result.success == true ) {
                            delete this.MESSAGEQUEUE[objid][queueID];
                            //this.log.debug(`[setPilot] ${client.address}:${client.port} success`);

                        } else if (msg.method == 'getSystemConfig' && msg.id == data.message.id && 'result' in msg ) {
                            delete this.MESSAGEQUEUE[objid][queueID];
                            //this.log.debug(`[getSystemConfig] ${client.address}:${client.port} success`);
                            this.WIZ__UPDATE_STATES(objid, msg.result);

                        } else if (msg.method == 'registration' && msg.id == data.message.id && 'result' in msg && msg.result.success == true ) {
                            delete this.MESSAGEQUEUE[objid][queueID];
                            //this.log.debug(`[registration] ${client.address}:${client.port} success`);
                            this.WIZ__UPDATE_STATES(objid, {'ip':client.address});

                        }
                    }
                }

            } else {
                this.log.debug(`No QUEUE for Client ${client.address}:${client.port} found`);
            }
        } else if ('params' in msg && msg.method == 'syncPilot') {
            if (objid in this.MESSAGEQUEUE) {
                client.port = 38899;
                //this.log.debug(`[syncPilot] ${client.address}:${client.port} received`);
                this.WIZ__UPDATE_STATES(objid, msg.params);

                const message = new Buffer(`{"method":"syncPilot","result":{"mac":"${this.MAC}"}}`);

                //setTimeout(function() {
                that.SOCKETS[client.port].send(message, 0, message.length, client.port, client.address, (err) => {
                    if (err) throw err;
                });
                //that.log.debug(`[syncPilot] ${client.address}:${client.port} answerd`);
                //}, 5000);

            }
        }
    }

    async WIZ__UPDATE_STATES(ip, result){
        try {
            const deviceId = ip.replace(/\./g, '_');
            const convert = AllDeviceAttributes.conv_wiz_iob;

            result.ip = ip;
            if (!('online' in result)) {
                result.online = true;
            }

            for (const key in result) {
                if (key in convert) {
                    if (['hsv','hsl','rgb','drvConf'].includes(key)) {
                        result[key] = JSON.stringify(result[key]);
                    }
                    if (key == 'temp' && result[key] == 0) {
                        // temp key 0 means unknown - which is invalid to set
                        // skip it
                        continue;
                    }
                    if (key =='online') {
                        this.setState(deviceId+'.'+convert[key], {val: result[key], ack: true, expire: +this.config.listed_online});
                    } else {
                        this.setState(deviceId+'.'+convert[key], {val: result[key], ack: true});
                    }

                }
            }

        } catch (err) {
            //this.log.debug(`__ERROR ->  ${FUNCTION_NAME} [ ${ip} : ${name} ]`);
            this.log.error(err);
        }
    }

    WIZ__QUEUE_MESSAGE(method, id, params, ip, port) {
        const queueID = uuid.v4();
        const data = {
            "ip": ip,
            "port": port,
            "attempt" : 0,
            "message": {
                "method": method,
                "id": id,
                "params": params
            },
            "message_buffer": ""
        };
        data['message_buffer'] = new Buffer(JSON.stringify(data.message));

        try {
            this.MESSAGEQUEUE[ip][queueID] = data;
            this.WIZ__SEND_MESSAGE(ip, queueID, this);
        } catch(e) {
            this.log.warn("MSG QUEUE: IP: " + ip + "Error: " + e);
        }
    }


    async WIZ__SEND_MESSAGE(ip, queueID, that) {
        const realip = await that.getIP(ip);
        if (!realip) {
            that.log.error(`WIZ__SEND_MESSAGE: cannot find ip of ${ip}`);
            // by deleting the queue we skip steps below
            delete that.MESSAGEQUEUE[ip][queueID];
        }
        if (ip in that.MESSAGEQUEUE && queueID in that.MESSAGEQUEUE[ip] && that.MESSAGEQUEUE[ip][queueID]['attempt'] < that.maxAttempt) {

            that.ipmap[realip] = ip;
            that.ipmap[ip] = realip;

            that.MESSAGEQUEUE[ip][queueID]['attempt'] = ++that.MESSAGEQUEUE[ip][queueID]['attempt'];

            that.log.debug(`Nachricht ${queueID} gesendet -> ${ip} ${realip} Versuch: ${that.MESSAGEQUEUE[ip][queueID]['attempt']}`);
            //that.log.warn(JSON.stringify(that.MESSAGEQUEUE[ip][queueID]['message']))

            that.SOCKETS[that.MESSAGEQUEUE[ip][queueID]['port']].send(that.MESSAGEQUEUE[ip][queueID]['message_buffer'], 0, that.MESSAGEQUEUE[ip][queueID]['message_buffer'].length, that.MESSAGEQUEUE[ip][queueID]['port'], realip, (err) => {
                if (err) {
                    that.log.warn(`Nachricht ${queueID} konnte nicht gesendet werden: ${err}`);
                }
            });

            setTimeout(that.WIZ__SEND_MESSAGE, that.sendTimeout, ip, queueID, that);
        } else if (ip in that.MESSAGEQUEUE && queueID in that.MESSAGEQUEUE[ip] && that.MESSAGEQUEUE[ip][queueID]['attempt'] >= that.maxAttempt) {
            that.log.warn(`Nachricht ${queueID} ${ip} ${realip} hat keine Antwort erhalten`);
            delete that.MESSAGEQUEUE[ip][queueID];
            that.WIZ__UPDATE_STATES(ip, {'online': false});
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
        const that = this;
        this.WIZ__QUEUE_MESSAGE('registration',that.WIZ__GET_MESSAGEID(),{"phoneMac":this.MAC,"phoneIp":this.IP,"register":true},client_ip, 38899);
    }

    WIZ__GETPILOT(client_ip) {
        this.WIZ__QUEUE_MESSAGE('getPilot',0,{},client_ip, 38899);
    }

    WIZ__SETPILOT(client_ip, params) {
        this.WIZ__QUEUE_MESSAGE('setPilot',this.WIZ__GET_MESSAGEID(),params,client_ip, 38899);
    }

    WIZ__GETSYSTEMCONFIG(client_ip) {
        this.WIZ__QUEUE_MESSAGE('getSystemConfig',this.WIZ__GET_MESSAGEID(),{},client_ip, 38899);
    }

    WIZ__SET_STATE(client_ip, state) {
        this.WIZ__SETPILOT(client_ip,{'state':state});
    }

    WIZ__SET_DIMMING(client_ip, state) {
        this.WIZ__SETPILOT(client_ip,{'dimming':state});
    }

    WIZ__SET_COLORTEMP(client_ip, state) {
        this.log.warn('colortemp '+client_ip+' '+state);
        this.WIZ__UPDATE_STATES(client_ip, {'sceneid':0});
        this.WIZ__SETPILOT(client_ip,{'temp':state});
    }

    async WIZ__SET_COLOR(client_ip) {
        const params = {};
        params.r = await this.WIZ__GET_IOB_STATE(client_ip,'led.r');
        params.g = await this.WIZ__GET_IOB_STATE(client_ip,'led.g');
        params.b = await this.WIZ__GET_IOB_STATE(client_ip,'led.b');
        params.w = await this.WIZ__GET_IOB_STATE(client_ip,'led.w');
        params.c = await this.WIZ__GET_IOB_STATE(client_ip,'led.c');

        for (const key in params) {
            if (params[key] == null ) {
                delete params[key];
            } else {
                params[key] = params[key]['val'];
            }
        }

        const rgb = [params.r, params.g, params.b];
        this.WIZ__SET_COLOR_RGB(client_ip, rgb);

        this.WIZ__UPDATE_STATES(client_ip, {'sceneid':0});
        this.WIZ__SETPILOT(client_ip,params);
    }
    WIZ__SET_COLOR_HEX(client_ip, hex) {
        this.WIZ__SET_COLOR_RGB(client_ip,ColorConv.HEX2RGB(hex));
    }
    WIZ__SET_COLOR_HSL(client_ip, hsl) {
        if (!Array.isArray(hsl)) {
            hsl = JSON.parse(hsl);
        }
        this.WIZ__SET_COLOR_RGB(client_ip,ColorConv.HSL2RGB(hsl[0],hsl[1],hsl[2]));
    }
    WIZ__SET_COLOR_HSV(client_ip, hsv) {
        if (!Array.isArray(hsv)) {
            hsv = JSON.parse(hsv);
        }
        this.WIZ__SET_COLOR_RGB(client_ip,ColorConv.HSV2RGB(hsv[0],hsv[1],hsv[2]));
    }
    WIZ__SET_COLOR_HUE(client_ip, hue) {
        this.WIZ__SET_COLOR_RGB(client_ip,ColorConv.HUE2RGB(hue));
    }

    WIZ__SET_COLOR_RGB(client_ip, rgb) {
        if (!Array.isArray(rgb)) {
            rgb = JSON.parse(rgb);
        }
        const params = {'r':rgb[0],'g':rgb[1],'b':rgb[2]};
        const hsv = ColorConv.RGB2HSV(params.r, params.g, params.b);
        const hsl = ColorConv.RGB2HSL(params.r, params.g, params.b);
        const hex = ColorConv.RGB2HEX(params.r, params.g, params.b);
        const hue = ColorConv.RGB2HUE(params.r, params.g, params.b);

        this.WIZ__UPDATE_STATES(client_ip, {'sceneid':0,'rgb':rgb,'hsv':hsv,'hsl':hsl,'hex':hex,'hue':hue,'r':rgb[0],'g':rgb[1],'b':rgb[2],'c':0,'w':0});
        this.WIZ__SETPILOT(client_ip,params);
    }

    WIZ__SET_SPEED(client_ip, state) {
        this.WIZ__SETPILOT(client_ip,{'speed':state});
    }

    WIZ__SET_SCENE(client_ip, state) {
        this.WIZ__SETPILOT(client_ip,{'sceneid':state});
    }


    async WIZ__GET_IOB_STATE(ip, key) {
        const client_ip = ip.replace(/\./g, '_');
        return await this.getStateAsync(client_ip+'.'+key);
        //return await this.getStateAsync(client_ip+'.'+key);
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // const that = this;
        // Initialize your adapter here
        // Reset the connection indicator during startup
        this.setState("info.connection", false, true);

        this.HOST = this.config.bind_ip;
        this.MAC = this.config.udpmac.replace(/:/g, '').toUpperCase();
        this.IP = this.config.udpip;
        this.log.info("config bind_ip: " + this.config.bind_ip);
        this.log.info("config udpmac: " + this.config.udpmac);
        this.log.info("config udpip: " + this.config.udpip);

        await this.open_udp_sockets();

        await this.WIZ__INIT_ALL_DEVICES();

        this.setState('info.connection', true, true);
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            for (const i in this.SOCKETS) {
                this.SOCKETS[i].close();
                this.ISONLINE[i] = false;
            }

            callback();
        } catch (e) {
            callback();
        }
    }

    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            if (state.ack == false) {
                const state_name = id.split('.').slice(-2).join('.');
                // eslint-disable-next-line no-unused-vars
                const client_ip = id.split('.').slice(2,3).join().replace(/_/g, '.');
                // eslint-disable-next-line no-unused-vars
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
                        this.subscribeStates('*.'+statename);
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
        const that = this;
        this.log.debug(`__START ->  ${FUNCTION_NAME} [ ${ip} : ${name} ]`);

        try {
            const deviceId = ip.replace(/\./g, '_');
            this.MESSAGEQUEUE[ip] = {};
            this.log.debug(`-> CREATE Device: ${deviceId}`);

            let deviceStates = AllDeviceAttributes.MINIMAL();
            let deviceType = "MINIMAL";

            const obj = await this.getStateAsync(deviceId+'.system.moduleName');

            if (obj && obj.val.length > 5) {
                deviceType = obj.val;
                //this.log.warn(deviceType);
            }
            this.log.debug(`-> CREATE DeviceType: ${deviceType}`);

            if (deviceType == "MINIMAL") {
                // reschedule until we know device type...
                setTimeout(function() {
                    that.WIZ__INIT_DEVICE(ip, name);
                }, 5000);
            }

            if (eval('typeof AllDeviceAttributes.'+deviceType+'() !== "undefined"')) {
                this.log.debug(`-> CREATE DeviceType: EVAL ${deviceType}`);
                deviceStates = eval('AllDeviceAttributes.'+deviceType+'()');
            }

            if (deviceStates) {

                await this.extendObjectAsync( deviceId, {
                    type: 'device',
                    common: {
                        name: `Device: ${name} - ${ip}`
                    },
                    native: {
                        ip: ip,
                        name: name,
                        mac: '' // ToDo:
                    }
                });

                for (const statename in deviceStates) {
                    const state = deviceStates[statename];

                    const channelId = statename.split('.').slice(0, 1).join();

                    if (channelId !== statename) {

                        //this.log.debug(`-> CREATE CHANNEL: ${deviceId}.${channelId}`);
                        await this.extendObjectAsync( deviceId + '.' + channelId, {
                            type: 'channel',
                            common: {
                                name: `Channel: ${channelId}`
                            },
                            native: {}
                        });
                    }

                    //this.log.debug(`-> CREATE STATE: ${deviceId}.${statename}`);
                    await this.extendObjectAsync( deviceId + '.' + statename, {
                        type: 'state',
                        common: state.common
                    });


                }
            }

            const reg = await this.WIZ__GET_IOB_STATE(ip,'system.register');
            if (this.config.register_devices == true && reg !== null && reg.val == true ) {
                this.WIZ__REGISTER(ip);
            }
            this.WIZ__GETSYSTEMCONFIG(ip);
            this.WIZ__GETPILOT(ip);
            if (this.config.polling_intervall > 0) {
                setInterval(this.WIZ__GETPILOT.bind(this), this.config.polling_intervall*1000, ip);
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
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new Signifylights(options);
} else {
    // otherwise start the instance directly
    new Signifylights();
}
