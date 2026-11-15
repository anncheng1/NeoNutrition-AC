'use strict';

// Growth regression tests reflect the conservative official Fenton Plotter workflow.
// They verify software behaviour, not independent clinical validation of growth references.
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

const context = {
  entries: [],
  GA_WK: 28,
  GA_DY: 0,
  growthTarget: () => ({ range: 'reference', band: 'reference' }),
  Math,
};
vm.createContext(context);
vm.runInContext(extractFunction('computeWeightVelocity'), context);

test('app does not expose approximate digitised Fenton LMS calculations', () => {
  assert.equal(html.includes('const FENTON ='), false);
  assert.equal(html.includes('function fentonRowInterp('), false);
  assert.equal(html.includes('function zFromRow('), false);
  assert.equal(html.includes('function zNumeric('), false);
  assert.ok(html.includes('Birth-size classification requires official calculation'));
  assert.ok(html.includes('https://fentongrowth.ca/'));
});

test('Fenton CSV export selects BirthSize for term-born infants and Growth for preterm infants', () => {
  const exportFn = extractFunction('exportFentonCsv');
  assert.ok(exportFn.includes("gaBirth >= 37 ? 'BirthSize' : 'Growth'"));
  assert.ok(exportFn.includes('GA (weeks)'));
  assert.ok(exportFn.includes('Weight (g)'));
  assert.ok(exportFn.includes('Head (cm)'));
  assert.ok(exportFn.includes('Length (cm)'));
  assert.ok(exportFn.includes('Fenton2025_growth_data.csv'));
});

test('weight velocity uses the latest two distinct DOLs when latest day has duplicate records', () => {
  context.entries = [
    { dol: 1, wt: 900 },
    { dol: 5, wt: 1000 },
    { dol: 5, wt: 1020 },
    { dol: 8, wt: 1100 },
    { dol: 8, wt: 1120 },
  ];
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
  assert.ok(html.includes('eMax: tgt.eMin'));
  assert.ok(html.includes('pMax: tgt.pMin'));
  assert.ok(html.includes('Cumulative energy balance vs minimum phase target'));
  assert.ok(html.includes('Days below protein target'));
});
