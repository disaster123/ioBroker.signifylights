'use strict';

const assert = require('node:assert/strict');
const { native } = require('./io-package.json');

describe('Adapter configuration defaults', () => {
    it('declares the UDP MAC field used by the admin UI and adapter', () => {
        assert.equal(native.udpmac, '');
    });
});
