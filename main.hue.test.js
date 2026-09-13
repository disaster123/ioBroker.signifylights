'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const proxyquire = require('proxyquire').noCallThru();
const ColorConv = require('./lib/colorconv.js');
const createAdapter = proxyquire('./main.js', {
    '@iobroker/adapter-core': { Adapter: EventEmitter },
    ip: { address: () => '127.0.0.1' },
});

function hueAdapter(rgb) {
    const adapter = createAdapter({});
    const sent = [];
    const updated = [];
    const warnings = [];
    const states = { 'led.r': rgb[0], 'led.g': rgb[1], 'led.b': rgb[2], 'led.dimming': 42 };
    adapter.WIZ__GET_IOB_STATE = async (_host, key) => states[key] === undefined ? null : { val: states[key] };
    adapter.WIZ__SETPILOT = (host, params) => sent.push({ host, params });
    adapter.WIZ__UPDATE_STATES = (host, values) => updated.push({ host, values });
    adapter.log = { warn: message => warnings.push(message) };
    return { adapter, sent, updated, warnings, states };
}

describe('Hue changes', () => {
    it('preserves saturation, RGB brightness and the independent device dimmer', async () => {
        const original = [204, 102, 51];
        const { adapter, sent, updated, warnings, states } = hueAdapter(original);
        await adapter.WIZ__SET_COLOR_HUE('192.0.2.1', 240);
        assert.deepEqual(sent, [{ host: '192.0.2.1', params: { r: 51, g: 51, b: 204 } }]);
        assert.deepEqual(
            ColorConv.RGB2HSV(51, 51, 204).slice(1),
            ColorConv.RGB2HSV(original[0], original[1], original[2]).slice(1),
        );
        assert.equal(states['led.dimming'], 42);
        assert.equal(Object.hasOwn(sent[0].params, 'dimming'), false);
        assert.equal(Object.hasOwn(updated[0].values, 'dimming'), false);
        assert.equal(updated[0].values.hue, 240);
        assert.deepEqual(warnings, []);
    });

    it('does not round very low brightness down to zero', async () => {
        const { adapter, sent } = hueAdapter([1, 0, 0]);
        await adapter.WIZ__SET_COLOR_HUE('192.0.2.1', 120);
        assert.deepEqual(sent[0].params, { r: 0, g: 1, b: 0 });
    });

    it('keeps black and gray achromatic', async () => {
        for (const level of [0, 128, 255]) {
            const { adapter, sent } = hueAdapter([level, level, level]);
            await adapter.WIZ__SET_COLOR_HUE('192.0.2.1', 240);
            assert.deepEqual(sent[0].params, { r: level, g: level, b: level });
        }
    });

    it('accepts the hue wraparound at 360 degrees', async () => {
        const { adapter, sent, warnings } = hueAdapter([0, 204, 51]);
        await adapter.WIZ__SET_COLOR_HUE('192.0.2.1', 360);
        assert.deepEqual(sent[0].params, { r: 204, g: 0, b: 0 });
        assert.deepEqual(warnings, []);
    });

    it('does not send a guessed color when a current RGB channel is invalid', async () => {
        for (const value of [undefined, null, '51', NaN, -1, 256]) {
            const { adapter, sent, updated, warnings } = hueAdapter([204, 102, value]);
            await adapter.WIZ__SET_COLOR_HUE('192.0.2.1', 120);
            assert.deepEqual(sent, []);
            assert.deepEqual(updated, []);
            assert.equal(warnings.length, 1);
        }
    });

    it('rejects invalid hue values without changing device states', async () => {
        for (const value of [undefined, null, '120', NaN, -1, 361]) {
            const { adapter, sent, updated, warnings } = hueAdapter([204, 102, 51]);
            await adapter.WIZ__SET_COLOR_HUE('192.0.2.1', value);
            assert.deepEqual(sent, []);
            assert.deepEqual(updated, []);
            assert.equal(warnings.length, 1);
        }
    });

    it('handles failed state reads without an unhandled rejection', async () => {
        const { adapter, sent, warnings } = hueAdapter([204, 102, 51]);
        adapter.WIZ__GET_IOB_STATE = async () => { throw new Error('State read failed'); };
        await adapter.WIZ__SET_COLOR_HUE('192.0.2.1', 120);
        assert.deepEqual(sent, []);
        assert.equal(warnings.length, 1);
    });
});
