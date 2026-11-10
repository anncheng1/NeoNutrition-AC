'use strict';

// Targeted regression tests for corrected clinical calculation logic.
// These tests verify software behaviour, not independent clinical sign-off.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.TZ = 'Asia/Kuala_Lumpur';
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

let preterm = true;
class FixedDate extends Date {
  constructor(...args) {
    if (args.length) super(...args);
    else super('2026-11-10T07:59:00+08:00');
  }
}
const elements = {
  bDobDt: { value: '2026-11-09' },
  bWt: { value: '3200' },
  bLen: { value: '' },
  bOfc: { value: '' },
  sgaBanner: { innerHTML: '' },
};
const context = {
  Date: FixedDate,
  Math,
  Number,
  document: { getElementById: id => elements[id] || (elements[id] = { value: '', innerHTML: '' }) },
  isPreterm: () => preterm,
  GA_WK: 38,
  GA_DY: 0,
  GSEX: 'boy',
  pctNumeric: () => { throw new Error('Term SGA/LGA must not use the embedded preterm Growth dataset'); },
};
vm.createContext(context);
vm.runInContext([
  extractFunction('getDOB'),
  extractFunction('computeDOL'),
  extractFunction('totalFluidTarget'),
  extractFunction('suggestedIvFluidMlKgDay'),
  extractFunction('proteinEnergyRatioStatus'),
  extractFunction('vitaminDIntakeStatus'),
  extractFunction('enteralMineralTargets'),
  extractFunction('enteralAdvance'),
  extractFunction('renderSgaBanner'),
].join('\n'), context);

test('date-only DOB is parsed at local midnight in Malaysia', () => {
  const dob = context.getDOB();
  assert.equal(dob.getFullYear(), 2026);
  assert.equal(dob.getMonth(), 10);
  assert.equal(dob.getDate(), 9);
  assert.equal(dob.getHours(), 0);
});

test('DOL follows local calendar date, not UTC 08:00 boundary', () => {
  const result = context.computeDOL();
  assert.equal(result.dolInt, 1);
  assert.ok(result.dolFloat > 1.3 && result.dolFloat < 1.34);
});

test('preterm fluid schedule matches Malaysian Paediatric Protocols 5th Edition', () => {
  preterm = true;
  const expected = [60, 80, 100, 120, 140];
  expected.forEach((value, index) => {
    const target = context.totalFluidTarget(800, index + 1);
    assert.deepEqual({ lo: target.lo, hi: target.hi }, { lo: value, hi: value });
    const largerPreterm = context.totalFluidTarget(1800, index + 1);
    assert.deepEqual({ lo: largerPreterm.lo, hi: largerPreterm.hi }, { lo: value, hi: value });
  });
});

test('term fluid schedule remains 60, 90, 120, 150, 150 mL/kg/day', () => {
  preterm = false;
  [60, 90, 120, 150, 150].forEach((value, index) => {
    const target = context.totalFluidTarget(3200, index + 1);
    assert.deepEqual({ lo: target.lo, hi: target.hi }, { lo: value, hi: value });
  });
});

test('automatic IV suggestion subtracts KVO as well as feeds and lipid', () => {
  assert.equal(context.suggestedIvFluidMlKgDay(100, 40, 10, 12), 38);
  assert.equal(context.suggestedIvFluidMlKgDay(50, 40, 10, 12), 0);
});

test('enteral protein-energy ratio is only interpreted within energy and protein targets', () => {
  const inRange = context.proteinEnergyRatioStatus(3.2, 120, 3.8, 115, 140, 3.5, 4.0, true);
  assert.equal(inRange.applicable, true);
  assert.equal(inRange.status, 'WITHIN RANGE');
  const lowPER = context.proteinEnergyRatioStatus(2.6, 120, 3.8, 115, 140, 3.5, 4.0, true);
  assert.equal(lowPER.flag, 'warn');
  const energyLow = context.proteinEnergyRatioStatus(2.6, 100, 3.8, 115, 140, 3.5, 4.0, true);
  assert.equal(energyLow.applicable, false);
  assert.equal(energyLow.status, 'NOT INTERPRETED');
  const onPN = context.proteinEnergyRatioStatus(3.2, 120, 3.8, 115, 140, 3.5, 4.0, false);
  assert.equal(onPN.applicable, false);
});

test('preterm vitamin D uses IU/kg/day target and an absolute 1,000 IU/day upper limit', () => {
  assert.equal(context.vitaminDIntakeStatus(500, 1000, true).status, 'green');
  assert.equal(context.vitaminDIntakeStatus(800, 1000, true).status, 'yellow');
  assert.equal(context.vitaminDIntakeStatus(1001, 1000, true).status, 'red');
  assert.equal(context.vitaminDIntakeStatus(300, 1000, true).status, 'red');
  assert.equal(context.vitaminDIntakeStatus(500, 0, true), null);
});

test('term vitamin D status uses the fixed 400 IU/day MOH reference', () => {
  assert.equal(context.vitaminDIntakeStatus(400, 3200, false).status, 'green');
  assert.equal(context.vitaminDIntakeStatus(600, 3200, false).status, 'yellow');
  assert.equal(context.vitaminDIntakeStatus(1100, 3200, false).status, 'red');
});

test('term-born infants are not classified using the embedded preterm growth dataset', () => {
  context.GA_WK = 38;
  context.GA_DY = 0;
  context.renderSgaBanner();
  assert.match(elements.sgaBanner.innerHTML, /Birth-size percentile unavailable/);
  assert.match(elements.sgaBanner.innerHTML, /term-born infants/);
});

test('preterm enteral mineral targets match ESPGHAN 2022 ranges', () => {
  preterm = true;
  const targets = context.enteralMineralTargets();
  assert.deepEqual(JSON.parse(JSON.stringify(targets.ca)), { lo: 3, hi: 5 });
  assert.deepEqual(JSON.parse(JSON.stringify(targets.p)), { lo: 2.2, hi: 3.7 });
});

test('enteral advancement prompts stay within the Malaysian protocol range', () => {
  assert.equal(context.enteralAdvance(850).start, '15–20 mL/kg/d');
  assert.equal(context.enteralAdvance(1500).start, '20–30 mL/kg/d');
});
