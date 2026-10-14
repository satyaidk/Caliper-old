import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  BEDS,
  MM_PER,
  bedById,
  fitOnBed,
  fractionAtLayer,
  layerAtFraction,
  layerCount,
  niceStep,
} from '../src/lib/printers.ts';

describe('fitOnBed', () => {
  const bed: [number, number, number] = [256, 256, 256];

  test('a part inside the volume fits as it is', () => {
    const report = fitOnBed([100, 50, 100], bed);
    assert.equal(report.fits, true);
    assert.equal(report.turned, false);
  });

  test('a part exactly the size of the volume fits', () => {
    assert.equal(fitOnBed([256, 256, 256], bed).fits, true);
  });

  test('a part too wide one way fits after a quarter turn', () => {
    // 240 wide by 200 deep on a 250 × 210 plate does not fit straight in…
    const report = fitOnBed([200, 10, 240], [250, 210, 220]);
    assert.equal(report.fits, true);
    assert.equal(report.turned, true);
  });

  test('reports how far a part overshoots, per axis', () => {
    const report = fitOnBed([300, 280, 100], bed);
    assert.equal(report.fits, false);
    assert.equal(report.over.width, 44);
    assert.equal(report.over.height, 24);
  });

  test('height cannot be fixed by turning', () => {
    assert.equal(fitOnBed([10, 300, 10], bed).fits, false);
  });
});

describe('bed presets', () => {
  test('every id is unique and resolves to itself', () => {
    const ids = new Set(BEDS.map((b) => b.id));
    assert.equal(ids.size, BEDS.length);
    for (const bed of BEDS) assert.equal(bedById(bed.id), bed);
  });

  test('an unknown id falls back to the model-sized plate', () => {
    assert.equal(bedById('nope').size, null);
  });

  test('unit factors convert to millimetres', () => {
    assert.equal(MM_PER.mm, 1);
    assert.equal(MM_PER.in * 2, 50.8);
    assert.equal(MM_PER.m, 1000);
  });
});

describe('niceStep', () => {
  test('lands on the 1-2-5 ruler sequence', () => {
    assert.equal(niceStep(240, 24), 10);
    assert.equal(niceStep(48, 24), 2);
    assert.equal(niceStep(110, 24), 5);
    assert.equal(niceStep(2.4, 24), 0.1);
  });

  test('never returns zero or NaN', () => {
    assert.equal(niceStep(0), 1);
    assert.equal(niceStep(Number.NaN), 1);
  });
});

describe('layers', () => {
  test('a 10 mm part at 0.2 mm prints in 50 layers', () => {
    assert.equal(layerCount(10, 0.2), 50);
  });

  test('a partial top layer still counts', () => {
    assert.equal(layerCount(10.1, 0.2), 51);
  });

  test('the top of the part is the last layer', () => {
    assert.equal(layerAtFraction(1, 10.1, 0.2), 51);
    assert.equal(layerAtFraction(1, 10, 0.2), 50);
  });

  test('layer and fraction convert back and forth', () => {
    for (const layer of [1, 7, 25, 49]) {
      assert.equal(layerAtFraction(fractionAtLayer(layer, 10, 0.2), 10, 0.2), layer);
    }
  });

  test('never reports layer 0 or past the end', () => {
    assert.equal(layerAtFraction(0, 10, 0.2), 1);
    assert.equal(layerAtFraction(2, 10, 0.2), 50);
    assert.equal(fractionAtLayer(999, 10, 0.2), 1);
  });

  test('a flat part with no height is one layer', () => {
    assert.equal(layerCount(0, 0.2), 1);
    assert.equal(layerAtFraction(0.5, 0, 0.2), 1);
  });
});
