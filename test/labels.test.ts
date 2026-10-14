import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spreadLabels } from '../src/lib/labels.ts';

describe('spreadLabels', () => {
  test('leaves tags that do not touch where they are', () => {
    const anchors = [
      { id: 1, x: 100, y: 100 },
      { id: 2, x: 400, y: 100 },
    ];
    assert.deepEqual(spreadLabels(anchors), anchors);
  });

  test('pushes the second of two stacked tags down by a row', () => {
    const [a, b] = spreadLabels([
      { id: 1, x: 300, y: 200 },
      { id: 2, x: 305, y: 202 },
    ]);
    assert.equal(a.y, 200);
    assert.equal(b.y, 228);
    assert.equal(b.x, 305, 'tags move down, not sideways');
  });

  test('keeps stepping until a tag is clear of every other', () => {
    const out = spreadLabels([
      { id: 1, x: 0, y: 0 },
      { id: 2, x: 0, y: 0 },
      { id: 3, x: 0, y: 0 },
    ]);
    assert.deepEqual(
      out.map((t) => t.y),
      [0, 26, 52],
    );
  });

  test('returns tags in the order it was given them', () => {
    const out = spreadLabels([
      { id: 9, x: 0, y: 50 },
      { id: 4, x: 0, y: 10 },
    ]);
    assert.deepEqual(
      out.map((t) => t.id),
      [9, 4],
    );
  });
});
