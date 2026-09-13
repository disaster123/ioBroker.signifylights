'use strict';

const assert = require('node:assert/strict');
const ColorConv = require('./lib/colorconv.js');

describe('RGB hue reporting', () => {
    it('reports the actual hue instead of a constant fallback', () => {
        assert.equal(ColorConv.RGB2HUE(255, 0, 0), 0);
        assert.equal(ColorConv.RGB2HUE(0, 255, 0), 120);
        assert.equal(ColorConv.RGB2HUE(0, 0, 255), 240);
        assert.equal(ColorConv.RGB2HUE(0, 0, 0), 0);
    });
});

describe('Hexadecimal to RGB conversion', () => {
    it('converts six-digit hexadecimal colors', () => {
        assert.deepEqual(ColorConv.HEX2RGB('ff8040'), [255, 128, 64]);
        assert.deepEqual(ColorConv.HEX2RGB('000000'), [0, 0, 0]);
        assert.deepEqual(ColorConv.HEX2RGB('FFFFFF'), [255, 255, 255]);
    });

    it('rejects empty input with a TypeError', () => {
        assert.throws(() => ColorConv.HEX2RGB(''), TypeError);
    });
});

describe('HSV to RGB conversion', () => {
    it('covers all six hue sectors and the hue wraparound', () => {
        const expected = [[255, 0, 0], [255, 255, 0], [0, 255, 0], [0, 255, 255], [0, 0, 255], [255, 0, 255]];
        for (const [index, rgb] of expected.entries()) {
            assert.deepEqual(ColorConv.HSV2RGB(index * 60, 100, 100), rgb);
        }
        assert.deepEqual(ColorConv.HSV2RGB(360, 100, 100), [255, 0, 0]);
        assert.deepEqual(ColorConv.HSV2RGB(120, 0, 100), [255, 255, 255]);
        assert.deepEqual(ColorConv.HSV2RGB(120, 100, 0), [0, 0, 0]);
    });

    it('keeps invalid hue inputs non-finite', () => {
        assert.deepEqual(ColorConv.HSV2RGB(NaN, 100, 100), [NaN, NaN, NaN]);
        assert.deepEqual(ColorConv.HSV2RGB(-60, 100, 100), [NaN, NaN, NaN]);
    });
});

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

describe('RGB to HSV conversion', () => {
    it('converts primary and achromatic colors', () => {
        assert.deepEqual(ColorConv.RGB2HSV(255, 0, 0), [0, 100, 100]);
        assert.deepEqual(ColorConv.RGB2HSV(0, 255, 0), [120, 100, 100]);
        assert.deepEqual(ColorConv.RGB2HSV(0, 0, 255), [240, 100, 100]);
        assert.deepEqual(ColorConv.RGB2HSV(0, 0, 0), [0, 0, 0]);
        assert.deepEqual(ColorConv.RGB2HSV(255, 255, 255), [0, 0, 100]);
    });

    it('keeps non-finite RGB inputs non-finite', () => {
        assert.ok(Number.isNaN(ColorConv.RGB2HSV(NaN, 0, 0)[0]));
    });
});
