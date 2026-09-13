'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const proxyquire = require('proxyquire').noCallThru();

describe('Message queue identifiers', () => {
    const createAdapter = proxyquire('./main.js', {
        '@iobroker/adapter-core': { Adapter: EventEmitter },
        ip: { address: () => '127.0.0.1' },
    });

    it('generates distinct version 4 UUIDs without the uuid package', () => {
        const adapter = createAdapter({});
        const host = '192.0.2.1';
        const sent = [];
        adapter.MESSAGEQUEUE[host] = {};
        adapter.WIZ__SEND_MESSAGE = (ip, queueID) => sent.push({ ip, queueID });

        for (let i = 0; i < 100; i++) {
            adapter.WIZ__QUEUE_MESSAGE('getPilot', i, {}, host, 38899);
        }

        const ids = Object.keys(adapter.MESSAGEQUEUE[host]);
        assert.equal(ids.length, 100);
        assert.equal(sent.length, 100);
        for (const [index, id] of ids.entries()) {
            assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
            assert.deepEqual(sent[index], { ip: host, queueID: id });
        }
    });

    it('preserves the protocol message ID, payload and destination', () => {
        const adapter = createAdapter({});
        const host = '192.0.2.1';
        adapter.MESSAGEQUEUE[host] = {};
        adapter.WIZ__SEND_MESSAGE = () => {};
        const params = { state: true, dimming: 42 };

        adapter.WIZ__QUEUE_MESSAGE('setPilot', 1234, params, host, 38899);

        const [data] = Object.values(adapter.MESSAGEQUEUE[host]);
        assert.equal(data.ip, host);
        assert.equal(data.port, 38899);
        assert.equal(data.attempt, 0);
        assert.deepEqual(data.message, { method: 'setPilot', id: 1234, params });
        assert.deepEqual(JSON.parse(data.message_buffer.toString()), data.message);
    });
});
