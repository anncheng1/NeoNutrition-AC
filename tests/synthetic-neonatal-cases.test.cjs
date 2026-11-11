'use strict';

// End-to-end synthetic nutrition scenarios against the app's real computeNutrition()
// function. Expected values below are independently worked out in the test comments.
// Run: node --test tests/synthetic-neonatal-cases.test.cjs
// Synthetic software verification only; not clinical validation or prescribing advice.

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

const presetMatch = /const FEED_PRESETS = (\{[\s\S]*?\n  \});/.exec(html);
assert.ok(presetMatch, 'Could not locate feed presets in application');
const elements = {};
for (const id of ['nWt','nVol','nFeed','nKcal100','nProt100','nAA','nLipid','nGIR','pnToggle','nutReadouts','optNote']) {
  elements[id] = { value: '', checked: false, innerHTML: '' };
}

const context = {
  document: { getElementById: id => elements[id] || (elements[id] = { value: '', checked: false, innerHTML: '' }) },
  FEED_PRESETS: {},
  entries: [],
  fmt: (value, decimals = 0) => Number(value).toFixed(decimals),
  nutritionTargetForWeight: () => ({ eMin: 110, eMax: 140, pMin: 3, pMax: 4, label: 'Synthetic test target' }),
  computeWeightVelocity: () => ({ velocity: null, velTarget: null }),
  renderOptimization: () => {},
  Math,
};
vm.createContext(context);
vm.runInContext('FEED_PRESETS = ' + presetMatch[1] + ';\n' + extractFunction('proteinEnergyRatioStatus') + '\n' + extractFunction('computeNutrition'), context);

function runCase(input) {
  Object.assign(elements.nWt, { value: String(input.weightG) });
  Object.assign(elements.nVol, { value: String(input.feedVolume) });
  Object.assign(elements.nFeed, { value: input.feed });
  Object.assign(elements.nKcal100, { value: String(input.customKcal ?? 0) });
  Object.assign(elements.nProt100, { value: String(input.customProtein ?? 0) });
  Object.assign(elements.nAA, { value: String(input.aa ?? 0) });
  Object.assign(elements.nLipid, { value: String(input.lipid ?? 0) });
  Object.assign(elements.nGIR, { value: String(input.gir ?? 0) });
  elements.pnToggle.checked = Boolean(input.pn);
  elements.nutReadouts.innerHTML = '';
  context.computeNutrition();
  const values = [...elements.nutReadouts.innerHTML.matchAll(/class="rvalue">([^<]+)</g)].map(m => m[1]);
  return { html: elements.nutReadouts.innerHTML, energy: values[0], protein: values[1], ratio: values[2] };
}

test('Case A: ELBW day-one minimal EBM plus starter PN', () => {
  // Independent arithmetic:
  // EBM: 20 x 67/100 = 13.4 kcal/kg/d; protein = 20 x 1.4/100 = 0.28 g/kg/d.
  // PN: AA 2.5 x 4 = 10; lipid 2 x 10 = 20;
  // glucose = GIR 6 x 1.44 x 3.4 = 29.376 kcal/kg/d.
  // Total energy = 72.776; total protein = 2.78.
  const r = runCase({ weightG: 850, feedVolume: 20, feed: 'ebm', pn: true, aa: 2.5, lipid: 2, gir: 6 });
  assert.equal(r.energy, '73 kcal/kg/d');
  assert.equal(r.protein, '2.78 g/kg/d');
  assert.equal(r.ratio, '3.82');
});

test('Case B: VLBW transition with standard-fortified EBM and PN', () => {
  // Independent arithmetic:
  // Enteral = 80 x 80/100 = 64 kcal; protein = 80 x 2/100 = 1.6 g.
  // PN = AA 2 x 4 + lipid 2 x 10 + (GIR 5 x 1.44 x 3.4)
  // = 8 + 20 + 24.48 = 52.48 kcal. Total = 116.48 kcal and 3.6 g protein.
  const r = runCase({ weightG: 1200, feedVolume: 80, feed: 'ebmStdFort', pn: true, aa: 2, lipid: 2, gir: 5 });
  assert.equal(r.energy, '116 kcal/kg/d');
  assert.equal(r.protein, '3.60 g/kg/d');
  assert.equal(r.ratio, '3.09');
});

test('Case C: preterm infant on high-fortified EBM without PN', () => {
  // Independent arithmetic: 150 x 85/100 = 127.5 kcal; 150 x 2.8/100 = 4.2 g protein.
  const r = runCase({ weightG: 1500, feedVolume: 150, feed: 'ebmHiFort', pn: false });
  assert.equal(r.energy, '128 kcal/kg/d');
  assert.equal(r.protein, '4.20 g/kg/d');
  assert.equal(r.ratio, '3.29');
});

test('Case D: term infant on term formula without PN', () => {
  // Independent arithmetic: 120 x 67/100 = 80.4 kcal; 120 x 1.4/100 = 1.68 g protein.
  const r = runCase({ weightG: 3200, feedVolume: 120, feed: 'termFormula', pn: false });
  assert.equal(r.energy, '80 kcal/kg/d');
  assert.equal(r.protein, '1.68 g/kg/d');
  assert.equal(r.ratio, '2.09');
});

test('Case E: zero enteral volume with PN only', () => {
  // Independent arithmetic: AA 3 x 4 + lipid 3 x 10 + GIR 8 x 1.44 x 3.4
  // = 12 + 30 + 39.168 = 81.168 kcal/kg/d; protein = 3 g/kg/d.
  const r = runCase({ weightG: 900, feedVolume: 0, feed: 'ebm', pn: true, aa: 3, lipid: 3, gir: 8 });
  assert.equal(r.energy, '81 kcal/kg/d');
  assert.equal(r.protein, '3.00 g/kg/d');
  assert.equal(r.ratio, '3.70');
});
