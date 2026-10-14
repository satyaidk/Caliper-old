import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { area, bytes, compact, count, degrees, dim, grams, ms, shortName, volume } from '../src/lib/format.ts';

/* Everything in lib/ is a pure function, which makes it the cheapest code in
   the project to test and the code most likely to be quietly wrong — number
   formatting bugs do not throw, they just print something slightly off. */

describe('bytes', () => {
  test('stays in bytes below a kilobyte', () => {
    assert.equal(bytes(0), '0 B');
    assert.equal(bytes(1023), '1023 B');
  });

  test('climbs through the units', () => {
    assert.equal(bytes(1024), '1.0 KB');
    assert.equal(bytes(1024 * 1024), '1.0 MB');
    assert.equal(bytes(1024 ** 3), '1.0 GB');
  });

  test('drops the decimal once the number is big enough to not need it', () => {
    assert.equal(bytes(9.4 * 1024), '9.4 KB');
    assert.equal(bytes(412 * 1024), '412 KB');
  });

  test('does not run off the end of the unit table', () => {
    assert.match(bytes(1024 ** 5), /GB$/);
  });
});

describe('count', () => {
  test('groups thousands', () => {
    assert.equal(count(1000), '1,000');
    assert.equal(count(131948), '131,948');
  });

  test('is locale-independent', () => {
    // Hardcoded en-US, so a machine set to another locale still agrees with
    // every screenshot and every test on every other machine.
    assert.equal(count(1234567), '1,234,567');
  });
});

describe('compact', () => {
  test('leaves small numbers alone', () => {
    assert.equal(compact(999), '999');
  });

  test('abbreviates thousands and millions', () => {
    assert.equal(compact(1500), '1.5k');
    assert.equal(compact(15000), '15k');
    assert.equal(compact(1500000), '1.5M');
  });
});

describe('dim', () => {
  test('converts between unit systems', () => {
    assert.equal(dim(1000, 'mm'), '1000 mm');
    assert.equal(dim(1000, 'cm'), '100.0 cm');
    assert.equal(dim(1000, 'm'), '1.00 m');
  });

  test('zero is always plain zero', () => {
    assert.equal(dim(0, 'mm'), '0 mm');
    assert.equal(dim(0, 'in'), '0 in');
  });

  test('survives the floating-point boundary at exactly one inch', () => {
    // 25.4 / 25.4 lands a hair under 1.0 in binary floating point. Without the
    // epsilon nudge in dim() this prints '1.0000' instead of '1.00'.
    assert.equal(dim(25.4, 'in'), '1.00 in');
  });

  test('picks precision from magnitude', () => {
    assert.equal(dim(0.5, 'mm'), '0.5000 mm'); // below 1 -> four decimals
    assert.equal(dim(5, 'mm'), '5.00 mm'); //     below 100 -> two
    assert.equal(dim(500, 'mm'), '500.0 mm'); //  below 1000 -> one
    assert.equal(dim(5000, 'mm'), '5000 mm'); //  above -> none
  });

  test('handles negative values without losing the sign', () => {
    assert.equal(dim(-5, 'mm'), '-5.00 mm');
  });
});

describe('ms', () => {
  test('milliseconds below a second, seconds above', () => {
    assert.equal(ms(16.4), '16 ms');
    assert.equal(ms(999), '999 ms');
    assert.equal(ms(1500), '1.50 s');
  });
});

describe('shortName', () => {
  test('leaves short names alone', () => {
    assert.equal(shortName('cube.stl', 20), 'cube.stl');
  });

  test('truncates the stem and keeps the extension', () => {
    const out = shortName('a-very-long-model-filename-indeed.step', 20);
    assert.ok(out.length <= 20, `"${out}" should be at most 20 characters`);
    assert.ok(out.endsWith('.step'), `"${out}" should keep its extension`);
    assert.ok(out.includes('…'), `"${out}" should show it was shortened`);
  });
});

describe('volume and area', () => {
  test('pick cm³ and cm² for printable sizes', () => {
    assert.equal(volume(6000, 'mm'), '6.00 cm³');
    assert.equal(area(2200, 'mm'), '22.00 cm²');
  });

  test('drop to mm for small parts', () => {
    assert.equal(volume(512, 'mm'), '512.0 mm³');
    assert.equal(area(64, 'cm'), '64.0 mm²');
  });

  test('switch to inch units when the display is in inches', () => {
    assert.equal(volume(16387.064, 'in'), '1.00 in³');
    assert.equal(area(645.16, 'in'), '1.00 in²');
  });

  test('group thousands on very large parts', () => {
    assert.equal(volume(2_500_000_000, 'mm'), '2,500,000 cm³');
  });
});

describe('grams and degrees', () => {
  test('grams climb to kilograms', () => {
    assert.equal(grams(7.44), '7.4 g');
    assert.equal(grams(250.4), '250 g');
    assert.equal(grams(1240), '1.24 kg');
  });

  test('degrees keep one decimal', () => {
    assert.equal(degrees(90), '90.0°');
    assert.equal(degrees(44.96), '45.0°');
  });
});
