'use strict';

const assert = require('node:assert/strict');
const ColorConv = require('./lib/colorconv.js');

describe('RGB to HSL conversion', () => {
    it('converts primary and achromatic colors', () => {
        assert.deepEqual(ColorConv.RGB2HSL(255, 0, 0), [0, 100, 50]);
        assert.deepEqual(ColorConv.RGB2HSL(0, 255, 0), [120, 100, 50]);
        assert.deepEqual(ColorConv.RGB2HSL(0, 0, 255), [240, 100, 50]);
        assert.deepEqual(ColorConv.RGB2HSL(0, 0, 0), [0, 0, 0]);
        assert.deepEqual(ColorConv.RGB2HSL(255, 255, 255), [0, 0, 100]);
    });

    it('keeps non-finite RGB inputs non-finite', () => {
        assert.ok(Number.isNaN(ColorConv.RGB2HSL(NaN, 0, 0)[0]));
    });
});
