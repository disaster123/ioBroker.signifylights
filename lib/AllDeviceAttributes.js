// Classification of all state attributes possible
const conv_wiz_iob = {
    'online': 'system.online',
    'register': 'system.register',
    'ip': 'system.ip',
    'mac': 'system.mac',
    'rssi': 'system.rssi',
    'ping': 'system.ping',
    'rgn': 'system.rgn',
    'moduleName': 'system.moduleName',
    'fwVersion': 'system.fwVersion',
    'drvConf': 'system.drvConf',
    'homeId': 'home.homeId',
    'roomId': 'home.roomId',
    'groupId': 'home.groupId',
    'state': 'led.state',
    'sceneId': 'led.sceneId',
    'dimming': 'led.dimming',
    'speed': 'led.speed',
    'temp': 'led.temp',
    'r': 'led.r',
    'g': 'led.g',
    'b': 'led.b',
    'c': 'led.c',
    'w': 'led.w',
    'rgb': 'colors.rgb',
    'hsv': 'colors.hsv',
    'hsl': 'colors.hsl',
    'hex': 'colors.hex',
    'hue': 'colors.hue'
};

function get_on_function(key) {
    return defaults[key].on;
}

/*const led_empty = {
    'state': null,
    'sceneId': null,
    'dimming': null,
    'speed': null,
    'temp': null,
    'r': null,
    'g': null,
    'b': null,
    'c': null,
    'w': null
}

const override_with_null_not_exists(moduleName, params) {
    params = Object.assign(led_empty ,params);
    let all = eval(noduleName+'();')).filter(([key]) => key.substing(0,4) == 'led.'));
    for (key in params) {
        if (!'led.'+key in all) {
            delete params[key];
        }
    }
    return params;
}*/

const defaults = {
    // State object
    'system.online': {
        common: {
            'name': 'Online',
            'type': 'boolean',
            'role': 'state',
            'read': true,
            'write': false,
            'states': {false: 'Offline', true: 'Online'}
        },
        //'on': 'this.log.warn("expired "+state_value); '
        //'on': 'if(state_value !== true) { this.log.warn("expired"); )'
    },
    'system.register': {
        common: {
            'name': 'Register for Autoupdate',
            'type': 'boolean',
            'role': 'state',
            'read': true,
            'write': true,
            'def': true,
            'states': {false: 'No', true: 'Yes'}
        },
        //'on': 'this.log.warn("expired "+state_value); '
        //'on': 'if(state_value !== true) { this.log.warn("expired"); )'
    },
    'system.mac': {
        common: {
            'name': 'MAC-Adresse',
            'type': 'string',
            'role': 'info',
            'read': true,
            'write': false
        }
    },
    'system.ip': {
        common: {
            'name': 'IP-Adresse',
            'type': 'string',
            'role': 'info.ip',
            'read': true,
            'write': false
        }
    },
    'system.hostname': {
        common: {
            'name': 'Hostname',
            'type': 'string',
            'role': 'info',
            'read': true,
            'write': false
        }
    },
    'system.rssi': {
        common: {
            'name': 'RSSI',
            'type': 'number',
            'role': 'info',
            'read': true,
            'write': false
        }
    },
    'system.ping': {
        common: {
            'name': 'Ping',
            'type': 'number',
            'role': 'info',
            'read': true,
            'write': false
        }
    },
    'system.rgn': {
        common: {
            'name': 'Region',
            'type': 'string',
            'role': 'info',
            'read': true,
            'write': false
        }
    },
    'system.moduleName': {
        common: {
            'name': 'Modul-Name',
            'type': 'string',
            'role': 'info',
            'read': true,
            'write': false
        }
    },
    'system.fwVersion': {
        common: {
            'name': 'Firmware VErsion',
            'type': 'string',
            'role': 'info',
            'read': true,
            'write': false
        }
    },
    'system.drvConf': {
        common: {
            'name': 'drvConf',
            'type': 'object',
            'role': 'info',
            'read': true,
            'write': false
        }
    },
    'home.homeId': {
        common: {
            'name': 'Haus-ID',
            'type': 'number',
            'role': 'state',
            'read': true,
            'write': false
        }
    },
    'home.roomId': {
        common: {
            'name': 'Raum-ID',
            'type': 'number',
            'role': 'state',
            'read': true,
            'write': true
        }
    },
    'home.groupId': {
        common: {
            'name': 'Gruppen-ID',
            'type': 'number',
            'role': 'state',
            'read': true,
            'write': true
        }
    },
    'led.state': {
        common: {
            'name': 'ON / Off',
            'type': 'boolean',
            'role': 'state',
            'read': true,
            'write': true,
            'states': {false: 'OFF', true: 'ON'}
        },
        on: 'this.WIZ__SET_STATE(client_ip,state_value);'
    },
    'led.sceneId': {
        common: {
            'name': 'Scenen-Nr',
            'type': 'number',
            'role': 'state',
            'read': true,
            'write': true,
            'min': 0,
            'max': 32,
            'states': {
                0:'Color',
                1:'Ocean',
                2:'Romantik',
                3:'Sonnenuntergang',
                4:'Party',
                5:'Kamin',
                6:'Gemütlich',
                7:'Wald',
                8:'Pastellfarben',
                9:'Aufwachen',
                10:'Schlafenszeit',
                11:'Warmweiß',
                12:'Tageslicht',
                13:'Kaltweiß',
                14:'Nachtlicht',
                15:'Fokus',
                16:'Entspannen',
                17:'Echte Farben',
                18:'Fernsehzeit',
                19:'Pflanzenwachstum',
                20:'Frühling',
                21:'Sommer',
                22:'Herbst',
                23:'Tieftauchgang',
                24:'Dschungel',
                25:'Mojito',
                26:'Club',
                27:'Weihnachten',
                28:'Halloween',
                29:'Kerzenlicht',
                30:'Goldenes Weiß',
                31:'Impuls',
                32:'Steampunk'
            }
        },
        on: 'this.WIZ__SET_SCENE(client_ip,state_value);'
    },
    'led.dimming': {
        common: {
            'name': 'Dimmer',
            'type': 'number',
            'role': 'state',
            'read': true,
            'write': true,
            'unit': '%',
            'min': 10,
            'max': 100
        },
        on: 'this.WIZ__SET_DIMMING(client_ip,state_value);'
    },
    'led.speed': {
        common: {
            'name': 'Geschwindigkeit',
            'type': 'number',
            'role': 'state',
            'read': true,
            'write': true,
            'unit': '',
            'min': 10,
            'max': 200
        },
        on: 'this.WIZ__SET_SPEED(client_ip,state_value);'
    },
    'led.temp': {
        common: {
            'name': 'Farbtemperatur in Kelvin',
            'type': 'number',
            'role': 'state',
            'read': true,
            'write': true,
            'unit': 'K',
            'min': 2200,
            'max': 6500
        },
        on: 'this.WIZ__SET_COLORTEMP(client_ip,state_value);'
    },
    'led.r': {
        common: {
            'name': 'Rot',
            'type': 'number',
            'role': 'state',
            'read': true,
            'write': true,
            'min': 0,
            'max': 255
        },
        on: 'this.WIZ__SET_COLOR(client_ip);'
    },
    'led.g': {
        common: {
            'name': 'Grün',
            'type': 'number',
            'role': 'state',
            'read': true,
            'write': true,
            'min': 0,
            'max': 255
        },
        on: 'this.WIZ__SET_COLOR(client_ip);'
    },
    'led.b': {
        common: {
            'name': 'Blau',
            'type': 'number',
            'role': 'state',
            'read': true,
            'write': true,
            'min': 0,
            'max': 255
        },
        on: 'this.WIZ__SET_COLOR(client_ip);'
    },
    'led.c': {
        common: {
            'name': 'Kaltweiß',
            'type': 'number',
            'role': 'state',
            'read': true,
            'write': true,
            'min': 0,
            'max': 255
        },
        on: 'this.WIZ__SET_COLOR(client_ip);'
    },
    'led.w': {
        common: {
            'name': 'Warmweiß',
            'type': 'number',
            'role': 'state',
            'read': true,
            'write': true,
            'min': 0,
            'max': 255
        },
        on: 'this.WIZ__SET_COLOR(client_ip);'
    },
    'colors.rgb': {
        common: {
            'name': 'RGB',
            'type': 'object',
            'role': 'state',
            'read': true,
            'write': true,
        },
        on: 'this.WIZ__SET_COLOR_RGB(client_ip, state_value);'
    },
    'colors.hsv': {
        common: {
            'name': 'HSV',
            'type': 'object',
            'role': 'state',
            'read': true,
            'write': true,
        },
        on: 'this.WIZ__SET_COLOR_HSV(client_ip, state_value);'
    },
    'colors.hsl': {
        common: {
            'name': 'HSL',
            'type': 'object',
            'role': 'state',
            'read': true,
            'write': true,
        },
        on: 'this.WIZ__SET_COLOR_HSL(client_ip, state_value);'
    },
    'colors.hex': {
        common: {
            'name': 'HEX',
            'type': 'string',
            'role': 'state',
            'read': true,
            'write': true,
        },
        on: 'this.WIZ__SET_COLOR_HEX(client_ip, state_value);'
    },
    'colors.hue': {
        common: {
            'name': 'HUE',
            'type': 'number',
            'role': 'state',
            'read': true,
            'write': true,
        },
        on: 'this.WIZ__SET_COLOR_HUE(client_ip, state_value);'
    }
};

function MINIMAL() {
    const data = Object.assign({}, defaults);
    delete data['led.dimming'];
    delete data['led.temp'];
    delete data['led.sceneId'];
    delete data['led.speed'];
    delete data['led.r'];
    delete data['led.g'];
    delete data['led.b'];
    delete data['led.w'];
    delete data['led.c'];
    delete data['colors.rgb'];
    delete data['colors.hsv'];
    delete data['colors.hsl'];
    delete data['colors.hex'];
    delete data['colors.hue'];
    return data;
}

function ESP01_SHDW_01() {
    const data = Object.assign({}, defaults);
    delete data['led.temp'];
    delete data['led.sceneId'];
    delete data['led.speed'];
    delete data['led.r'];
    delete data['led.g'];
    delete data['led.b'];
    delete data['led.w'];
    delete data['led.c'];
    delete data['colors.rgb'];
    delete data['colors.hsv'];
    delete data['colors.hsl'];
    delete data['colors.hex'];
    delete data['colors.hue'];
    return data;
}

function ESP01_SHRGB1C_31() {
    return defaults;
}

function ESP01_SHTW1C_31() {
    const data = Object.assign({}, defaults);
    delete data['led.sceneId'];
    delete data['led.speed'];
    delete data['led.r'];
    delete data['led.g'];
    delete data['led.b'];
    delete data['led.w'];
    delete data['led.c'];
    delete data['colors.rgb'];
    delete data['colors.hsv'];
    delete data['colors.hsl'];
    delete data['colors.hex'];
    delete data['colors.hue'];
    return data;
}

function ESP56_SHTW3_01() {
    const data = Object.assign({}, defaults);
    delete data['led.r'];
    delete data['led.g'];
    delete data['led.b'];
    delete data['led.w'];
    delete data['led.c'];
    delete data['colors.rgb'];
    delete data['colors.hsv'];
    delete data['colors.hsl'];
    delete data['colors.hex'];
    delete data['colors.hue'];
    return data;
}

function ESP01_SHRGB_03() {
    return defaults;
}

function ESP01_SHDW1_31() {
    const data = Object.assign({}, defaults);
    delete data['led.temp'];
    delete data['led.sceneId'];
    delete data['led.speed'];
    delete data['led.r'];
    delete data['led.g'];
    delete data['led.b'];
    delete data['led.w'];
    delete data['led.c'];
    return data;
}

function ESP06_SHDW1_01() {
    const data = Object.assign({}, defaults);
    delete data['led.temp'];
    delete data['led.sceneId'];
    delete data['led.speed'];
    delete data['led.r'];
    delete data['led.g'];
    delete data['led.b'];
    delete data['led.w'];
    delete data['led.c'];
    delete data['colors.rgb'];
    delete data['colors.hsv'];
    delete data['colors.hsl'];
    delete data['colors.hex'];
    delete data['colors.hue'];
    return data;
}

function ESP15_SHTW1_01I() {
    const data = Object.assign({}, defaults);
    delete data['led.sceneId'];
    delete data['led.speed'];
    delete data['led.r'];
    delete data['led.g'];
    delete data['led.b'];
    delete data['led.w'];
    delete data['led.c'];
    delete data['colors.rgb'];
    delete data['colors.hsv'];
    delete data['colors.hsl'];
    delete data['colors.hex'];
    delete data['colors.hue'];
    return data;
}

function ESP03_SHRGB1C_01() {
    return defaults;
}

function ESP03_SHRGB1W_01() {
    return defaults;
}

function ESP06_SHDW9_01() {
    const data = Object.assign({}, defaults);
    delete data['led.temp'];
    delete data['led.sceneId'];
    delete data['led.speed'];
    delete data['led.r'];
    delete data['led.g'];
    delete data['led.b'];
    delete data['led.w'];
    delete data['led.c'];
    delete data['colors.rgb'];
    delete data['colors.hsv'];
    delete data['colors.hsl'];
    delete data['colors.hex'];
    delete data['colors.hue'];
    return data;
}

function ESP03_SHRGBP_31() {
    return defaults;
}

function ESP03_SHTWP_31() {
    const data = Object.assign({}, defaults);
    delete data['led.speed'];
    delete data['led.r'];
    delete data['led.g'];
    delete data['led.b'];
    delete data['led.w'];
    delete data['led.c'];
    delete data['colors.rgb'];
    delete data['colors.hsv'];
    delete data['colors.hsl'];
    delete data['colors.hex'];
    delete data['colors.hue'];
    return data;
}

function ESP17_SHTW9_01() {
    const data = Object.assign({}, defaults);
    delete data['led.speed'];
    delete data['led.r'];
    delete data['led.g'];
    delete data['led.b'];
    delete data['led.w'];
    delete data['led.c'];
    delete data['colors.rgb'];
    delete data['colors.hsv'];
    delete data['colors.hsl'];
    delete data['colors.hex'];
    delete data['colors.hue'];
    return data;
}

function ESP03_SHRGB3_01ABI() {
    return defaults;
}

function ESP04_SHRGBP0_01() {
    return defaults;
}

function ESP25_SHWRGB_01() {
    return defaults;
}

function ESP24_SHRGBC_01() {
    return defaults;
}

function ESP24_SHRGBW_01() {
    return defaults;
}

function ESP25_SHRGB_01() {
    return defaults;
}

function ESP06_SHTW1_01() {
    const data = Object.assign({}, defaults);
    delete data['led.speed'];
    delete data['led.r'];
    delete data['led.g'];
    delete data['led.b'];
    delete data['led.w'];
    delete data['led.c'];
    delete data['colors.rgb'];
    delete data['colors.hsv'];
    delete data['colors.hsl'];
    delete data['colors.hex'];
    delete data['colors.hue'];
    return data;
}


function ESP21_SHTW_01() {
    const data = Object.assign({}, defaults);
    delete data['led.speed'];
    delete data['led.r'];
    delete data['led.g'];
    delete data['led.b'];
    delete data['led.w'];
    delete data['led.c'];
    delete data['colors.rgb'];
    delete data['colors.hsv'];
    delete data['colors.hsl'];
    delete data['colors.hex'];
    delete data['colors.hue'];
    return data;
}

function ESP15_SHRGB1S_01I() {
    return defaults;
}

module.exports = {
    conv_wiz_iob: conv_wiz_iob,
    get_on_function: get_on_function,
    /*led_empty: led_empty,
    override_with_null_not_exists: override_with_null_not_exists,*/
    defaults: defaults,
    ESP01_SHDW1_31: ESP01_SHDW1_31,
    ESP01_SHDW_01: ESP01_SHDW_01,
    ESP01_SHRGB1C_31: ESP01_SHRGB1C_31,
    ESP01_SHRGB_03: ESP01_SHRGB_03,
    ESP01_SHTW1C_31: ESP01_SHTW1C_31,
    ESP03_SHRGB1C_01: ESP03_SHRGB1C_01,
    ESP03_SHRGB1W_01: ESP03_SHRGB1W_01,
    ESP03_SHRGB3_01ABI: ESP03_SHRGB3_01ABI,
    ESP03_SHRGBP_31: ESP03_SHRGBP_31,
    ESP03_SHTWP_31: ESP03_SHTWP_31,
    ESP04_SHRGBP0_01: ESP04_SHRGBP0_01,
    ESP06_SHDW1_01: ESP06_SHDW1_01,
    ESP06_SHDW9_01: ESP06_SHDW9_01,
    ESP06_SHTW1_01: ESP06_SHTW1_01,
    ESP15_SHRGB1S_01I: ESP15_SHRGB1S_01I,
    ESP15_SHTW1_01I: ESP15_SHTW1_01I,
    ESP17_SHTW9_01: ESP17_SHTW9_01,
    ESP21_SHTW_01: ESP21_SHTW_01,
    ESP24_SHRGBC_01: ESP24_SHRGBC_01,
    ESP24_SHRGBW_01: ESP24_SHRGBW_01,
    ESP25_SHRGB_01: ESP25_SHRGB_01,
    ESP25_SHWRGB_01: ESP25_SHWRGB_01,
    ESP56_SHTW3_01: ESP56_SHTW3_01,
    MINIMAL: MINIMAL
};
