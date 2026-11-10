'use strict';

// Growth regression checks execute the app's actual Fenton and weight-velocity
// functions. These tests verify software behaviour, not independent clinical
// validation of the Fenton reference dataset or growth targets.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extractFunction(name) {
  const match = new RegExp('function\\s+' + name + '\\s*\\(').exec(html);
  assert.ok(match, 'Missing application function: ' + name);
  const open = html.indexOf('{', match.index);
  let depth = 0;
  for (let i = open; i < html.length; i++) {
    if (html[i] === '{') depth++;
    if (html[i] === '}' && --depth === 0) return html.slice(match.index, i + 1);
  }
  throw new Error('Unclosed function: ' + name);
}

function extractObject(declaration) {
  const start = html.indexOf(declaration);
  assert.notEqual(start, -1, 'Missing declaration: ' + declaration);
  const open = html.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < html.length; i++) {
    if (html[i] === '{') depth++;
    if (html[i] === '}' && --depth === 0) return html.slice(open, i + 1);
  }
  throw new Error('Unclosed object: ' + declaration);
}

const context = {
  FENTON: vm.runInNewContext('(' + extractObject('const FENTON =') + ')'),
  FENTON_Z: [-1.8808, -1.2816, 0, 1.2816, 1.8808],
  entries: [],
  GA_WK: 28,
  GA_DY: 0,
  growthTarget: () => ({ range: 'reference', band: 'reference' }),
  Math,
};
vm.createContext(context);
vm.runInContext([
  extractFunction('fentonRowInterp'),
  extractFunction('zFromRow'),
  extractFunction('zNumeric'),
  extractFunction('computeWeightVelocity'),
].join('\n'), context);

test('Fenton weight percentile knots map to their documented z values', () => {
  const row = context.fentonRowInterp('boy', 28, 'w');
  const expected = context.FENTON_Z;
  row.forEach((weightKg, i) => {
    assert.ok(Math.abs(context.zNumeric('w', 'boy', 28, weightKg) - expected[i]) < 1e-9);
  });
});

test('Fenton row interpolation at half-week uses the midpoint of adjacent rows', () => {
  const a = context.fentonRowInterp('girl', 30, 'w');
  const b = context.fentonRowInterp('girl', 31, 'w');
  const mid = context.fentonRowInterp('girl', 30.5, 'w');
  mid.forEach((value, i) => assert.ok(Math.abs(value - (a[i] + b[i]) / 2) < 1e-12));
});

test('Fenton z-score clamps extreme values to the app limits', () => {
  assert.equal(context.zNumeric('w', 'boy', 28, 0), -5);
  assert.equal(context.zNumeric('w', 'boy', 28, 100), 5);
});

test('weight velocity uses the latest two distinct DOLs when latest day has duplicate records', () => {
  context.entries = [
    { dol: 1, wt: 900 },
    { dol: 5, wt: 1000 },
    { dol: 5, wt: 1020 },
    { dol: 8, wt: 1100 },
    { dol: 8, wt: 1120 },
  ];
  // Dashboard retains the first measurement on each DOL: 1000 g at DOL 5,
  // then 1100 g at DOL 8. Average-weight velocity = (100/3)/1.05.
  const result = context.computeWeightVelocity();
  assert.ok(Math.abs(result.velocity - (100 / 3 / 1.05)) < 1e-10);
});

test('weight velocity returns unavailable with fewer than two distinct days', () => {
  context.entries = [{ dol: 2, wt: 900 }, { dol: 2, wt: 920 }];
  assert.equal(context.computeWeightVelocity().velocity, null);
});

test('weight velocity ignores duplicate days consistently and sorts out-of-order entries', () => {
  context.entries = [
    { dol: 8, wt: 1100 },
    { dol: 1, wt: 900 },
    { dol: 8, wt: 1120 },
    { dol: 5, wt: 1000 },
  ];
  const result = context.computeWeightVelocity();
  assert.ok(Math.abs(result.velocity - (100 / 3 / 1.05)) < 1e-10);
});

test('longitudinal deficit snapshots store minimum energy and protein targets', () => {
  assert.match(html, /latestNutritionSnapshot\s*=\s*\{[\s\S]*?eMax:\s*tgt\.eMin/);
  assert.match(html, /latestNutritionSnapshot\s*=\s*\{[\s\S]*?pMax:\s*tgt\.pMin/);
  assert.match(html, /Cumulative energy deficit/);
  assert.match(html, /Days below protein target/);
});

test('Fenton reference lower age boundary is metric-specific', () => {
  const lengthAtLower = context.fentonRowInterp('boy', 22.0, 'l');
  const lengthAtBoundary = context.fentonRowInterp('boy', 23.5, 'l');
  lengthAtLower.forEach((value, i) => assert.ok(Math.abs(value - lengthAtBoundary[i]) < 1e-12));
  const weightAtLower = context.fentonRowInterp('boy', 22.0, 'w');
  const weightAtBoundary = context.fentonRowInterp('boy', 22.5, 'w');
  weightAtLower.forEach((value, i) => assert.ok(Math.abs(value - weightAtBoundary[i]) < 1e-12));
});
