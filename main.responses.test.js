'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const proxyquire = require('proxyquire').noCallThru();
const createAdapter = proxyquire('./main.js', {
    '@iobroker/adapter-core': { Adapter: EventEmitter },
    ip: { address: () => '127.0.0.1' },
});
const host = '192.0.2.1';
const port = 38899;

function fixture() {
    const adapter = createAdapter({});
    const warnings = [];
    const updates = [];
    const sends = [];
    const timers = [];
    adapter.log = { warn: value => warnings.push(value), debug: () => {}, error: value => warnings.push(value) };
    adapter.MESSAGEQUEUE[host] = {};
    adapter.getIP = async () => host;
    adapter.WIZ__UPDATE_STATES = (_host, values) => updates.push({ ...values });
    adapter.SOCKETS[port] = { send: (...args) => { sends.push(args); args.at(-1)(null); } };
    adapter.setTimeout = callback => { timers.push(callback); return timers.length; };
    adapter.maxAttempt = 2;
    function pending(method = 'setPilot', id = 1234, targetPort = port) {
        const key = `entry${Object.keys(adapter.MESSAGEQUEUE[host]).length}`;
        adapter.MESSAGEQUEUE[host][key] = {
            ip: host, port: targetPort, attempt: 0, message: { method, id, params: { state: true } },
            message_buffer: Buffer.from('{}'),
        };
        return key;
    }
    const receive = (value, source = { address: host, port }) => adapter.WIZ__RECEIVE_MESSAGE(
        Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)), source,
    );
    const exhaust = async key => {
        while (adapter.MESSAGEQUEUE[host][key]) {
            await adapter.WIZ__SEND_MESSAGE(host, key, adapter);
        }
    };
    return { adapter, warnings, updates, sends, timers, pending, receive, exhaust };
}

describe('UDP response handling', () => {
    for (const code of [-32602, -32605]) {
        for (const idless of [false, true]) {
            it(`stops retries for ${idless ? 'unique id-less' : 'exact ID'} rejection ${code} without acknowledging a write`, async () => {
                const f = fixture();
                const key = f.pending();
                const other = f.pending('getPilot', 0);
                await f.adapter.WIZ__SEND_MESSAGE(host, key, f.adapter);
                f.receive({ method: 'setPilot', ...(idless ? {} : { id: 1234 }), error: { code, message: 'SECRET' } });
                assert.equal(f.adapter.MESSAGEQUEUE[host][key], undefined);
                assert.ok(f.adapter.MESSAGEQUEUE[host][other]);
                f.timers[0]();
                await Promise.resolve();
                await f.adapter.WIZ__SEND_MESSAGE(host, key, f.adapter);
                assert.equal(f.sends.length, 1);
                assert.deepEqual(f.updates, [{ online: true }]);
                assert.match(f.warnings.join(), new RegExp(`setPilot: rejected code=${code}`));
                assert.match(f.warnings.join(), code === -32602 ? /Invalid params/ : /Security error/);
                assert.doesNotMatch(f.warnings.join(), /SECRET|params":|state/);
            });
        }
    }

    for (const idless of [false, true]) {
        it(`treats success=false as terminal with ${idless ? 'no ID' : 'exact ID'}`, async () => {
            const f = fixture();
            const key = f.pending();
            f.receive({ method: 'setPilot', ...(idless ? {} : { id: 1234 }), result: { success: false, state: true } });
            await f.adapter.WIZ__SEND_MESSAGE(host, key, f.adapter);
            assert.deepEqual(f.adapter.MESSAGEQUEUE[host], {});
            assert.deepEqual(f.sends, []);
            assert.deepEqual(f.updates, [{ online: true }]);
            assert.match(f.warnings.join(), /success=false/);
        });
    }

    it('retains ambiguous id-less requests and tracks receipt without claiming correlation', async () => {
        const f = fixture();
        const first = f.pending();
        const second = f.pending('setPilot', 1235);
        f.receive({ method: 'setPilot', error: { code: -32605 } });
        assert.equal(Object.keys(f.adapter.MESSAGEQUEUE[host]).length, 2);
        assert.match(f.warnings.join(), /ambiguous/);
        await f.exhaust(first);
        f.receive({ method: 'setPilot', result: { success: true } });
        assert.ok(f.adapter.MESSAGEQUEUE[host][second]);
        await f.exhaust(second);
        assert.match(f.warnings.join(), /no matching reply \(device replied\)/);
        assert.ok(f.updates.every(value => value.online === true));
    });

    for (const body of [{ result: { success: true } }, { error: { code: -32602 } }]) {
        it('never consumes a request for a conflicting explicit ID', async () => {
            const f = fixture();
            const key = f.pending();
            f.receive({ method: 'setPilot', id: 9999, ...body });
            assert.ok(f.adapter.MESSAGEQUEUE[host][key]);
            assert.match(f.warnings.join(), /unmatched/);
            await f.exhaust(key);
            assert.ok(f.updates.every(value => value.online === true));
        });
    }

    for (const value of ['{SECRET', 'null', '[]', '42', '"SECRET"']) {
        it(`handles malformed/non-object JSON safely (${value[0]})`, async () => {
            const f = fixture();
            const key = f.pending();
            assert.doesNotThrow(() => f.receive(value));
            assert.ok(f.adapter.MESSAGEQUEUE[host][key]);
            await f.exhaust(key);
            assert.ok(f.updates.every(update => update.online === true));
            assert.doesNotMatch(f.warnings.join(), /SECRET/);
        });
    }

    it('preserves retry count and offline state for true silence', async () => {
        const f = fixture();
        const key = f.pending();
        await f.exhaust(key);
        assert.equal(f.sends.length, f.adapter.maxAttempt);
        assert.deepEqual(f.updates, [{ online: false }]);
        assert.match(f.warnings.join(), /retries exhausted; no reply received/);
    });

    it('distinguishes send failures from silence without logging raw errors', async () => {
        const f = fixture();
        f.adapter.SOCKETS[port].send = (...args) => args.at(-1)(new Error('SECRET'));
        await f.exhaust(f.pending());
        assert.match(f.warnings.join(), /send failure; no reply received/);
        assert.doesNotMatch(f.warnings.join(), /SECRET/);
    });

    for (const method of ['getPilot', 'getSystemConfig', 'registration', 'setPilot']) {
        for (const idless of [false, true]) {
            it(`preserves ${method} success ${idless ? 'without ID' : 'with legacy ID'}`, () => {
                const f = fixture();
                f.pending(method);
                const result = ['getPilot', 'getSystemConfig'].includes(method) ? { dimming: 42 } : { success: true };
                f.receive({ method, ...(idless ? {} : { id: 1234 }), result });
                assert.deepEqual(f.adapter.MESSAGEQUEUE[host], {});
                assert.deepEqual(f.updates, [{ online: true }, ...(
                    ['getPilot', 'getSystemConfig'].includes(method) ? [result] :
                        method === 'registration' ? [{ ip: host }] : [])]);
            });
        }
    }

    it('prioritizes an exact getPilot ID over the ID=0 wildcard', () => {
        const f = fixture();
        const wildcard = f.pending('getPilot', 0);
        const exact = f.pending('getPilot', 1234);
        f.receive({ method: 'getPilot', id: 1234, result: { state: true } });
        assert.ok(f.adapter.MESSAGEQUEUE[host][wildcard]);
        assert.equal(f.adapter.MESSAGEQUEUE[host][exact], undefined);
        f.receive({ method: 'getPilot', id: 4321, result: { state: false } });
        assert.deepEqual(f.adapter.MESSAGEQUEUE[host], {});
    });

    it('does not use null IDs as missing IDs or wildcards', () => {
        const f = fixture();
        const key = f.pending('getPilot', 0);
        f.receive({ method: 'getPilot', id: null, result: { state: true } });
        assert.ok(f.adapter.MESSAGEQUEUE[host][key]);
    });

    for (const method of ['setPilot', 'registration', 'getSystemConfig']) {
        it(`allows back-to-back id-less ${method} successes and rejections without cooldown`, async () => {
            const f = fixture();
            const replies = [
                { result: { success: true, dimming: 42 } },
                { error: { code: -32602 } },
                { error: { code: -32605 } },
                { result: { success: false } },
                { result: { success: true, dimming: 12 } },
            ];
            for (const [index, body] of replies.entries()) {
                const key = f.pending(method, 1234 + index);
                await f.adapter.WIZ__SEND_MESSAGE(host, key, f.adapter);
                f.receive({ method, ...body });
                assert.deepEqual(f.adapter.MESSAGEQUEUE[host], {});
                await f.adapter.WIZ__SEND_MESSAGE(host, key, f.adapter);
            }
            assert.equal(f.sends.length, replies.length);
            assert.equal(f.warnings.length, 3);
            assert.ok(f.warnings.every(value => value.includes('retries stopped')));
            assert.ok(f.updates.every(value => value.online !== false));
        });
    }

    it('does not impose a cooldown after an exact-ID completion or retry exhaustion', async () => {
        const f = fixture();
        f.pending();
        f.receive({ method: 'setPilot', id: 1234, result: { success: true } });
        f.pending('setPilot', 1235);
        f.receive({ method: 'setPilot', result: { success: true } });
        assert.deepEqual(f.adapter.MESSAGEQUEUE[host], {});
        await f.exhaust(f.pending('setPilot', 1236));
        const key = f.pending('setPilot', 1237);
        f.receive({ method: 'setPilot', error: { code: -32605 } });
        assert.equal(f.adapter.MESSAGEQUEUE[host][key], undefined);
        assert.deepEqual(f.updates.at(-1), { online: true });
        assert.doesNotMatch(f.warnings.join(), /uncorrelated/);
    });

    for (const idless of [false, true]) {
        it(`keeps rapid repeated legacy polling working ${idless ? 'without IDs' : 'with wildcard IDs'}`, async () => {
            const f = fixture();
            for (let i = 0; i < 20; i++) {
                const key = f.pending('getPilot', 0);
                await f.adapter.WIZ__SEND_MESSAGE(host, key, f.adapter);
                f.receive({ method: 'getPilot', ...(idless ? {} : { id: 100 + i }), result: { dimming: i } });
                assert.deepEqual(f.adapter.MESSAGEQUEUE[host], {});
                assert.deepEqual(f.updates.at(-1), { dimming: i });
            }
            assert.equal(f.sends.length, 20);
            assert.deepEqual(f.warnings, []);
            assert.ok(f.updates.every(value => value.online !== false));
        });

        it(`satisfies overlapping ID=0 polls with one ${idless ? 'id-less' : 'wildcard'} snapshot`, async () => {
            const f = fixture();
            const first = f.pending('getPilot', 0);
            const second = f.pending('getPilot', 0);
            f.receive({ method: 'getPilot', ...(idless ? {} : { id: 42 }), result: { dimming: 42 } });
            assert.deepEqual(f.adapter.MESSAGEQUEUE[host], {});
            assert.deepEqual(f.updates, [{ online: true }, { dimming: 42 }]);
            await f.adapter.WIZ__SEND_MESSAGE(host, first, f.adapter);
            await f.adapter.WIZ__SEND_MESSAGE(host, second, f.adapter);
            assert.deepEqual(f.sends, []);
            assert.deepEqual(f.warnings, []);
        });
    }

    it('updates id-less poll snapshots without consuming indistinguishable nonzero IDs', () => {
        const f = fixture();
        f.pending('getPilot', 0);
        f.pending('getPilot', 0);
        const explicit = f.pending('getPilot', 1234);
        f.receive({ method: 'getPilot', result: { state: true } });
        assert.deepEqual(Object.keys(f.adapter.MESSAGEQUEUE[host]), [explicit]);
        assert.deepEqual(f.updates.at(-1), { state: true });
    });

    it('retains overlapping polls on ambiguous rejection then accepts a successful snapshot', () => {
        const f = fixture();
        f.pending('getPilot', 0);
        f.pending('getPilot', 0);
        f.receive({ method: 'getPilot', error: { code: -32605 } });
        assert.equal(Object.keys(f.adapter.MESSAGEQUEUE[host]).length, 2);
        assert.deepEqual(f.updates, [{ online: true }]);
        f.receive({ method: 'getPilot', result: { state: true } });
        assert.deepEqual(f.adapter.MESSAGEQUEUE[host], {});
        assert.deepEqual(f.updates.at(-1), { state: true });
        assert.match(f.warnings.join(), /ambiguous/);
    });

    it('does not select wildcard polls for an id-less rejection when nonzero polls also exist', () => {
        const f = fixture();
        f.pending('getPilot', 0);
        f.pending('getPilot', 1234);
        f.receive({ method: 'getPilot', error: { code: -32602 } });
        assert.equal(Object.keys(f.adapter.MESSAGEQUEUE[host]).length, 2);
        assert.match(f.warnings.join(), /ambiguous/);
    });

    it('does not refresh reachability or receipt tracking from unexpected source ports', async () => {
        const f = fixture();
        const key = f.pending();
        f.receive({ method: 'setPilot', id: 1234, result: { success: true } }, { address: host, port: 54321 });
        assert.deepEqual(f.updates, []);
        assert.ok(!f.adapter.MESSAGEQUEUE[host][key].replyReceived);
        assert.ok(!f.adapter.MESSAGEQUEUE[host][key].endpointReceived);
        await f.exhaust(key);
        assert.deepEqual(f.updates, [{ online: false }]);
        assert.match(f.warnings.join(), /unexpected source port/);
    });

    it('tracks unrelated method traffic only as endpoint reachability, preventing false offline', async () => {
        const f = fixture();
        const write = f.pending();
        const read = f.pending('getPilot', 0);
        f.receive({ method: 'setPilot', id: 1234, result: {} });
        assert.ok(f.adapter.MESSAGEQUEUE[host][write].replyReceived);
        assert.ok(!f.adapter.MESSAGEQUEUE[host][read].replyReceived);
        assert.ok(f.adapter.MESSAGEQUEUE[host][read].endpointReceived);
        await f.exhaust(read);
        assert.match(f.warnings.join(), /getPilot: retries exhausted; no matching reply \(device traffic received\)/);
        assert.ok(f.updates.every(value => value.online === true));
    });

    it('keeps sequential ID=0 polls working across id-less errors and successes', async () => {
        const f = fixture();
        for (const body of [
            { error: { code: -32602 } },
            { result: { state: true } },
            { result: { success: false } },
            { error: { code: -32605 } },
            { result: { state: false } },
        ]) {
            const key = f.pending('getPilot', 0);
            await f.adapter.WIZ__SEND_MESSAGE(host, key, f.adapter);
            f.receive({ method: 'getPilot', ...body });
            assert.deepEqual(f.adapter.MESSAGEQUEUE[host], {});
        }
        assert.equal(f.sends.length, 5);
        assert.equal(f.warnings.length, 3);
        assert.deepEqual(f.updates.filter(value => 'state' in value), [{ state: true }, { state: false }]);
        assert.ok(f.updates.every(value => value.online !== false));
    });

    it('does not claim method receipt for requests with other explicit IDs', async () => {
        const f = fixture();
        const matched = f.pending();
        const unrelated = f.pending('setPilot', 1235);
        f.receive({ method: 'setPilot', id: 1234, error: { code: -32605 } });
        assert.equal(f.adapter.MESSAGEQUEUE[host][matched], undefined);
        assert.ok(!f.adapter.MESSAGEQUEUE[host][unrelated].replyReceived);
        assert.ok(f.adapter.MESSAGEQUEUE[host][unrelated].endpointReceived);
        await f.exhaust(unrelated);
        assert.ok(f.updates.every(value => value.online === true));
        assert.match(f.warnings.join(), /no matching reply \(device traffic received\)/);
    });

    it('does not match a different method, source IP or port', () => {
        const f = fixture();
        const key = f.pending();
        f.receive({ method: 'getSystemConfig', id: 1234, result: {} });
        f.receive({ method: 'setPilot', id: 1234, result: { success: true } }, { address: '192.0.2.2', port });
        f.receive({ method: 'setPilot', id: 1234, result: { success: true } }, { address: host, port: 38900 });
        assert.ok(f.adapter.MESSAGEQUEUE[host][key]);
    });

    it('maps a resolved source IP back to the configured hostname', () => {
        const f = fixture();
        f.adapter.MESSAGEQUEUE['lamp.example'] = f.adapter.MESSAGEQUEUE[host];
        delete f.adapter.MESSAGEQUEUE[host];
        f.adapter.ipmap[host] = 'lamp.example';
        f.adapter.MESSAGEQUEUE['lamp.example'].entry = { port, message: { method: 'setPilot', id: 1234 } };
        f.receive({ method: 'setPilot', error: { code: -32605 } });
        assert.deepEqual(f.adapter.MESSAGEQUEUE['lamp.example'], {});
    });

    it('preserves syncPilot state updates and acknowledgement without consuming queued requests', () => {
        const f = fixture();
        const key = f.pending();
        f.adapter.MAC = 'AABBCCDDEEFF';
        f.receive({ method: 'syncPilot', params: { state: false, dimming: 12 } });
        assert.ok(f.adapter.MESSAGEQUEUE[host][key]);
        assert.deepEqual(f.updates, [{ online: true }, { state: false, dimming: 12 }]);
        assert.deepEqual(JSON.parse(f.sends[0][0].toString()), { method: 'syncPilot', result: { mac: f.adapter.MAC } });
    });

    it('retains requests with malformed result bodies and does not log untrusted metadata', () => {
        const f = fixture();
        const key = f.pending();
        for (const result of [null, [], false, 'SECRET', {}]) {
            f.receive({ method: 'setPilot', id: 1234, result });
            assert.ok(f.adapter.MESSAGEQUEUE[host][key]);
        }
        f.receive({ method: 'SECRET', id: 1234, error: { code: -12345, message: 'SECRET', data: 'SECRET' } });
        assert.doesNotMatch(f.warnings.join(), /SECRET/);
    });

    it('retains malformed error envelopes instead of treating them as terminal rejections', () => {
        const f = fixture();
        const key = f.pending();
        for (const error of [null, [], 'SECRET', {}, { code: 'SECRET' }]) {
            f.receive({ method: 'setPilot', id: 1234, error, result: { success: true } });
            assert.ok(f.adapter.MESSAGEQUEUE[host][key]);
        }
        assert.deepEqual(f.updates, Array(5).fill({ online: true }));
        assert.doesNotMatch(f.warnings.join(), /SECRET/);
    });

    it('retains duplicate exact IDs rather than arbitrarily deleting either request', () => {
        const f = fixture();
        f.pending();
        f.pending();
        f.receive({ method: 'setPilot', id: 1234, error: { code: -32605 } });
        assert.equal(Object.keys(f.adapter.MESSAGEQUEUE[host]).length, 2);
        assert.match(f.warnings.join(), /ambiguous/);
    });

    it('does not let a wildcard consume an exact-ID rejection', () => {
        const f = fixture();
        const wildcard = f.pending('getPilot', 0);
        const exact = f.pending('getPilot', 1234);
        f.receive({ method: 'getPilot', id: 1234, error: { code: -32602 } });
        assert.ok(f.adapter.MESSAGEQUEUE[host][wildcard]);
        assert.equal(f.adapter.MESSAGEQUEUE[host][exact], undefined);
        assert.deepEqual(f.updates, [{ online: true }]);
    });

    it('writes legacy read values to acknowledged states while rejection only updates reachability', () => {
        const f = fixture();
        const realAdapter = createAdapter({});
        const states = [];
        f.adapter.config = { listed_online: 60 };
        f.adapter.setState = (id, value) => states.push({ id, ...value });
        f.adapter.WIZ__UPDATE_STATES = realAdapter.WIZ__UPDATE_STATES.bind(f.adapter);
        f.pending('getPilot', 0);
        f.receive({ method: 'getPilot', id: 88, result: { state: true, dimming: 42 } });
        assert.ok(states.some(value => value.id.endsWith('.led.state') && value.val === true && value.ack));
        assert.ok(states.some(value => value.id.endsWith('.led.dimming') && value.val === 42 && value.ack));
        states.length = 0;
        f.pending();
        f.receive({ method: 'setPilot', id: 1234, error: { code: -32605 } });
        assert.equal(states.length, 2);
        assert.ok(states.every(value => value.id.endsWith('.system.online') || value.id.endsWith('.system.ip')));
    });

});
