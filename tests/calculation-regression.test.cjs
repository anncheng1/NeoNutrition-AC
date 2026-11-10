'use strict';

// Regression tests execute the actual pure calculation functions extracted from
// index.html. No clinical formulas are reimplemented in this test file.
// Run: node --test tests/calculation-regression.test.cjs
//
// These are software regression checks only. They do NOT independently validate
// the clinical appropriateness of the underlying targets or reference ranges.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extractFunction(name) {
  const marker = new RegExp('function\\s+' + name + '\\s*\\(');
  const match = marker.exec(html);
  assert.ok(match, 'Expected function ' + name + ' to exist in index.html');
  const start = match.index;
  const open = html.indexOf('{', match.index);
  assert.notEqual(open, -1, 'Opening brace not found for ' + name);
  let depth = 0;
  for (let i = open; i < html.length; i++) {
    if (html[i] === '{') depth++;
    if (html[i] === '}') {
      depth--;
      if (depth === 0) return html.slice(start, i + 1);
    }
  }
  throw new Error('Unclosed function body: ' + name);
}

const fields = { gGaWk: '26', gGaDy: '0' };
const context = {
  document: { getElementById: id => ({ value: fields[id] ?? '' }) },
  entries: [],
  GA_WK: 26,
  GA_DY: 0,
  growthTarget: () => ({ range: 'test-range', band: 'test-band' }),
  Math,
};
const functionNames = [
  'isPreterm',
  'nutritionTargetForWeight',
  'pnAaMax',
  'dayIndex',
  'pnTargetsForDay',
  'totalFluidTarget',
  'computeWeightVelocity',
];
vm.createContext(context);
vm.runInContext(functionNames.map(extractFunction).join('\n'), context);

function setGestation(weeks, days = 0) {
  fields.gGaWk = String(weeks);
  fields.gGaDy = String(days);
  context.GA_WK = weeks;
  context.GA_DY = days;
}

test('preterm full-enteral targets follow ESPGHAN 2022 across weight bands', () => {
  setGestation(26);
  const expected = { eMin: 115, eMax: 140, pMin: 3.5, pMax: 4, label: 'Preterm' };
  [850, 1000, 1499, 1500, 2000, 3000].forEach(weight => {
    assert.deepEqual(JSON.parse(JSON.stringify(context.nutritionTargetForWeight(weight))), expected);
  });
});

test('term gestation selects term nutrition target band', () => {
  setGestation(37, 0);
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.nutritionTargetForWeight(3200))),
    { eMin: 100, eMax: 120, pMin: 2, pMax: 2.5, label: 'Term' }
  );
});

test('PN day indexing clamps day zero and day five-plus', () => {
  assert.equal(context.dayIndex(0), 1);
  assert.equal(context.dayIndex(1), 1);
  assert.equal(context.dayIndex(5), 5);
  assert.equal(context.dayIndex(12), 5);
});

test('preterm PN targets respect day-one and day-five bands', () => {
  setGestation(28);
  const d1 = context.pnTargetsForDay(1, 850);
  assert.equal(d1.aa.lo, 1.5);
  assert.equal(d1.aa.hi, 2);
  assert.equal(d1.lipid.lo, 1);
  assert.equal(d1.gir.lo, 4);
  const d5 = context.pnTargetsForDay(5, 1200);
  assert.equal(d5.aa.lo, 3.5);
  assert.equal(d5.aa.hi, 3.5);
  assert.equal(d5.aa.max, 4);
});

test('term PN targets use term bands', () => {
  setGestation(39);
  const d1 = context.pnTargetsForDay(1, 3200);
  assert.equal(d1.gir.lo, 2.5);
  assert.equal(d1.kcal.lo, 45);
  assert.equal(d1.lipid.max, 3);
});

test('preterm fluid targets follow Malaysian Paediatric Protocols across weight bands', () => {
  setGestation(28);
  [900, 1000, 1800].forEach(weight => {
    [60, 80, 100, 120, 140].forEach((value, i) => {
      assert.deepEqual(JSON.parse(JSON.stringify(context.totalFluidTarget(weight, i + 1))), { lo: value, hi: value });
    });
  });
});

test('term fluid targets use term schedule', () => {
  setGestation(38);
  assert.deepEqual(JSON.parse(JSON.stringify(context.totalFluidTarget(3200, 1))), { lo: 60, hi: 60 });
  assert.deepEqual(JSON.parse(JSON.stringify(context.totalFluidTarget(3200, 5))), { lo: 150, hi: 150 });
});

test('weight velocity uses the two latest distinct DOL measurements', () => {
  setGestation(28);
  context.entries = [
    { dol: 1, wt: 900 },
    { dol: 6, wt: 1000 },
  ];
  const result = context.computeWeightVelocity();
  assert.ok(Math.abs(result.velocity - (100 / 5 / 0.95)) < 1e-10);
  assert.ok(Number.isFinite(result.velocityExp));
  assert.equal(result.velTarget.range, 'test-range');
});

test('weight velocity is unavailable with fewer than two weights or duplicate DOL', () => {
  context.entries = [{ dol: 1, wt: 900 }];
  assert.equal(context.computeWeightVelocity().velocity, null);
  context.entries = [{ dol: 2, wt: 900 }, { dol: 2, wt: 920 }];
  assert.equal(context.computeWeightVelocity().velocity, null);
});

test('weight velocity sorts measurements by DOL before selecting the latest interval', () => {
  setGestation(28);
  context.entries = [{ dol: 6, wt: 1000 }, { dol: 1, wt: 900 }];
  const result = context.computeWeightVelocity();
  assert.ok(Math.abs(result.velocity - (100 / 5 / 0.95)) < 1e-10);
});
