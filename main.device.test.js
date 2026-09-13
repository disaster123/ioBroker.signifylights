'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const proxyquire = require('proxyquire').noCallThru();
const { native } = require('./io-package.json');
const createAdapter = proxyquire('./main.js', {
    '@iobroker/adapter-core': { Adapter: EventEmitter },
    ip: { address: () => '127.0.0.1' },
});

function deviceAdapter(moduleValue) {
    const adapter = createAdapter({});
    adapter.config = { ...native, register_devices: false, polling_intervall: 0 };
    const errors = [];
    adapter.log = { debug: () => {}, error: error => errors.push(error) };
    adapter.getStateAsync = async id => id.endsWith('moduleName') ? { val: moduleValue } : null;
    adapter.extendObjectAsync = async () => {};
    adapter.setTimeout = () => 1;
    adapter.WIZ__GETSYSTEMCONFIG = () => {};
    adapter.WIZ__GETPILOT = () => {};
    return { adapter, errors };
}

describe('Device module name validation', () => {
    it('retains minimal initialization for missing or non-string module names', async () => {
        for (const value of [null, 42, false, '']) {
            const { adapter, errors } = deviceAdapter(value);
            await adapter.WIZ__INIT_DEVICE('192.0.2.1', 'Test light');
            assert.deepEqual(errors, []);
            assert.deepEqual(adapter.MESSAGEQUEUE['192.0.2.1'], {});
            assert.deepEqual(adapter.timeoutList, { 1: true });
        }
    });
});
