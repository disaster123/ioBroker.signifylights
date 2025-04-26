// Classification of all state attributes possible
const conv_wiz_iob = {
    online: 'system.online',
    register: 'system.register',
    ip: 'system.ip',
    mac: 'system.mac',
    rssi: 'system.rssi',
    ping: 'system.ping',
    rgn: 'system.rgn',
    moduleName: 'system.moduleName',
    fwVersion: 'system.fwVersion',
    drvConf: 'system.drvConf',
    homeId: 'home.homeId',
    roomId: 'home.roomId',
    groupId: 'home.groupId',
    state: 'led.state',
    sceneId: 'led.sceneId',
    dimming: 'led.dimming',
    speed: 'led.speed',
    temp: 'led.temp',
    r: 'led.r',
    g: 'led.g',
    b: 'led.b',
    c: 'led.c',
    w: 'led.w',
    rgb: 'colors.rgb',
    hsv: 'colors.hsv',
    hsl: 'colors.hsl',
    hex: 'colors.hex',
    hue: 'colors.hue'
};

function get_on_function(key) {
    return defaults[key].on;
}

const defaults = {
    'system.online': {
        common: {
            name: 'Online',
            type: 'boolean',
            role: 'state',
            read: true,
            write: false,
            states: {false: 'Offline', true: 'Online'}
        }
    },
    'system.register': {
        common: {
            name: 'Register for Autoupdate',
            type: 'boolean',
            role: 'state',
            read: true,
            write: true,
            def: true,
            states: {false: 'No', true: 'Yes'}
        }
    },
    'system.mac': {
        common: {name: 'MAC-Adresse', type: 'string', role: 'info', read: true, write: false}
    },
    'system.ip': {
        common: {name: 'IP-Adresse', type: 'string', role: 'info.ip', read: true, write: false}
    },
    'system.hostname': {
        common: {name: 'Hostname', type: 'string', role: 'info', read: true, write: false}
    },
    'system.rssi': {
        common: {name: 'RSSI', type: 'number', role: 'info', read: true, write: false}
    },
    'system.ping': {
        common: {name: 'Ping', type: 'number', role: 'info', read: true, write: false}
    },
    'system.rgn': {
        common: {name: 'Region', type: 'string', role: 'info', read: true, write: false}
    },
    'system.moduleName': {
        common: {name: 'Modul-Name', type: 'string', role: 'info', read: true, write: false}
    },
    'system.fwVersion': {
        common: {name: 'Firmware Version', type: 'string', role: 'info', read: true, write: false}
    },
    'system.drvConf': {
        common: {name: 'drvConf', type: 'object', role: 'info', read: true, write: false}
    },
    'home.homeId': {
        common: {name: 'Haus-ID', type: 'number', role: 'state', read: true, write: false}
    },
    'home.roomId': {
        common: {name: 'Raum-ID', type: 'number', role: 'state', read: true, write: true}
    },
    'home.groupId': {
        common: {name: 'Gruppen-ID', type: 'number', role: 'state', read: true, write: true}
    },
    'led.state': {
        common: {
            name: 'ON / Off',
            type: 'boolean',
            role: 'state',
            read: true,
            write: true,
            states: {false: 'OFF', true: 'ON'}
        },
        on: 'this.WIZ__SET_STATE(client_ip,state_value);'
    },
    'led.sceneId': {
        common: {
            name: 'Scenen-Nr',
            type: 'number',
            role: 'state',
            read: true,
            write: true,
            min: 0,
            max: 32,
            states: {
                0: 'Color',
                1: 'Ocean',
                2: 'Romantik',
                3: 'Sonnenuntergang',
                4: 'Party',
                5: 'Kamin',
                6: 'Gemütlich',
                7: 'Wald',
                8: 'Pastellfarben',
                9: 'Aufwachen',
                10: 'Schlafenszeit',
                11: 'Warmweiß',
                12: 'Tageslicht',
                13: 'Kaltweiß',
                14: 'Nachtlicht',
                15: 'Fokus',
                16: 'Entspannen',
                17: 'Echte Farben',
                18: 'Fernsehzeit',
                19: 'Pflanzenwachstum',
                20: 'Frühling',
                21: 'Sommer',
                22: 'Herbst',
                23: 'Tieftauchgang',
                24: 'Dschungel',
                25: 'Mojito',
                26: 'Club',
                27: 'Weihnachten',
                28: 'Halloween',
                29: 'Kerzenlicht',
                30: 'Goldenes Weiß',
                31: 'Impuls',
                32: 'Steampunk'
            }
        },
        on: 'this.WIZ__SET_SCENE(client_ip,state_value);'
    },
    'led.dimming': {
        common: {
            name: 'Dimmer',
            type: 'number',
            role: 'state',
            read: true,
            write: true,
            unit: '%',
            min: 10,
            max: 100
        },
        on: 'this.WIZ__SET_DIMMING(client_ip,state_value);'
    },
    'led.speed': {
        common: {
            name: 'Geschwindigkeit',
            type: 'number',
            role: 'state',
            read: true,
            write: true,
            unit: '',
            min: 10,
            max: 200
        },
        on: 'this.WIZ__SET_SPEED(client_ip,state_value);'
    },
    'led.temp': {
        common: {
            name: 'Farbtemperatur in Kelvin',
            type: 'number',
            role: 'state',
            read: true,
            write: true,
            unit: 'K',
            min: 2200,
            max: 6500
        },
        on: 'this.WIZ__SET_COLORTEMP(client_ip,state_value);'
    },
    'led.r': {
        common: {
            name: 'Rot',
            type: 'number',
            role: 'state',
            read: true,
            write: true,
            min: 0,
            max: 255
        },
        on: 'this.WIZ__SET_COLOR(client_ip);'
    },
    'led.g': {
        common: {
            name: 'Grün',
            type: 'number',
            role: 'state',
            read: true,
            write: true,
            min: 0,
            max: 255
        },
        on: 'this.WIZ__SET_COLOR(client_ip);'
    },
    'led.b': {
        common: {
            name: 'Blau',
            type: 'number',
            role: 'state',
            read: true,
            write: true,
            min: 0,
            max: 255
        },
        on: 'this.WIZ__SET_COLOR(client_ip);'
    },
    'led.c': {
        common: {
            name: 'Kaltweiß',
            type: 'number',
            role: 'state',
            read: true,
            write: true,
            min: 0,
            max: 255
        },
        on: 'this.WIZ__SET_COLOR(client_ip);'
    },
    'led.w': {
        common: {
            name: 'Warmweiß',
            type: 'number',
            role: 'state',
            read: true,
            write: true,
            min: 0,
            max: 255
        },
        on: 'this.WIZ__SET_COLOR(client_ip);'
    },
    'colors.rgb': {
        common: { name: 'RGB', type: 'object', role: 'state', read: true, write: true },
        on: 'this.WIZ__SET_COLOR_RGB(client_ip, state_value);'
    },
    'colors.hsv': {
        common: { name: 'HSV', type: 'object', role: 'state', read: true, write: true },
        on: 'this.WIZ__SET_COLOR_HSV(client_ip, state_value);'
    },
    'colors.hsl': {
        common: { name: 'HSL', type: 'object', role: 'state', read: true, write: true },
        on: 'this.WIZ__SET_COLOR_HSL(client_ip, state_value);'
    },
    'colors.hex': {
        common: { name: 'HEX', type: 'string', role: 'state', read: true, write: true },
        on: 'this.WIZ__SET_COLOR_HEX(client_ip, state_value);'
    },
    'colors.hue': {
        common: { name: 'HUE', type: 'number', role: 'state', read: true, write: true },
        on: 'this.WIZ__SET_COLOR_HUE(client_ip, state_value);'
    }
};

// Kategorien basierend auf Geräte-Funktionalität
const categoryRemovals = {
    minimal: ['led.dimming','led.temp','led.sceneId','led.speed','led.r','led.g','led.b','led.w','led.c','colors.rgb','colors.hsv','colors.hsl','colors.hex','colors.hue'],
    whiteOnly: ['led.temp','led.sceneId','led.speed','led.r','led.g','led.b','led.w','led.c','colors.rgb','colors.hsv','colors.hsl','colors.hex','colors.hue'],
    whiteTempScene: ['led.speed','led.r','led.g','led.b','led.w','led.c','colors.rgb','colors.hsv','colors.hsl','colors.hex','colors.hue'],
    fullColor: []
};

// Helper: erzeugt eine Kopie von defaults ohne die angegebenen Keys
function makeDeviceConfig(removeKeys) {
    const cfg = { ...defaults };
    removeKeys.forEach(key => delete cfg[key]);
    return cfg;
}

// Gibt die Gerätekonfiguration basierend auf dem Typ zurück
function getDeviceConfig(deviceType) {
    let removals;
    if (deviceType === 'MINIMAL') {
        removals = categoryRemovals.minimal;
    } else if (/SHRGB/.test(deviceType)) {
        removals = categoryRemovals.fullColor;
    } else if (/SHDW/.test(deviceType)) {
        removals = categoryRemovals.whiteOnly;
    } else if (/SHTW/.test(deviceType)) {
        removals = categoryRemovals.whiteTempScene;
    } else {
        removals = categoryRemovals.fullColor;
    }

    return makeDeviceConfig(removals);
}

// Exports
module.exports = {
    conv_wiz_iob,
    get_on_function,
    defaults,
    getDeviceConfig,
    // Legacy export for MINIMAL type
    MINIMAL: () => getDeviceConfig('MINIMAL')
};

