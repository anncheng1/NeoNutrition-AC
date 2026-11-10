'use strict';

// Fluid-accounting regression tests execute the app's actual renderFluids()
// function and inspect its displayed total. These tests do not validate clinical
// fluid targets or prescribe a fluid regimen.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function extractFunction(name) {
  const match = new RegExp('function\\s+' + name + '\\s*\\(').exec(html);
  assert.ok(match, 'Missing application function ' + name);
  const open = html.indexOf('{', match.index);
  let depth = 0;
  for (let i = open; i < html.length; i++) {
    if (html[i] === '{') depth++;
    if (html[i] === '}' && --depth === 0) return html.slice(match.index, i + 1);
  }
  throw new Error('Unclosed function ' + name);
}

const ids = ['ivResetAutoBtn','lipidResetAutoBtn','ivAutoTag','lipidAutoTag','fluidReadouts','fRefSrc','bWt','vol','ivType','ivRate','lipidRate','kvoType','kvoRate','day','kvoBox'];
const els = Object.fromEntries(ids.map(id => [id, { value: '', textContent: '', innerHTML: '', style: {}, open: false }]));
const context = {
  document: { getElementById: id => els[id] || (els[id] = { value: '', textContent: '', innerHTML: '', style: {}, open: false }) },
  window: { __nutMode: 'tpn' },
  ivRateUserOverridden: false,
  lipidRateUserOverridden: false,
  IV_FLUID_LABELS: { none: 'None', D10: 'D10', tpnPreterm: 'Preterm PN' },
  KVO_FLUID_LABELS: { none: 'None', NS: 'Normal saline', heparinSaline: 'Heparin saline' },
  tpnMode: () => context.window.__nutMode !== 'enteral',
  getRefWeight: () => Number(els.bWt.value),
  totalFluidTarget: () => ({ lo: 150, hi: 170 }),
  fmt: (n, d = 0) => Number(n).toFixed(d),
  fmtRate: n => String(Math.round(Number(n) * 10) / 10),
  renderNutritionSummary: () => {},
  isNaN,
};
vm.createContext(context);
vm.runInContext(extractFunction('renderFluids'), context);

function setCase({ weightG, feeds, ivType = 'D10', ivRate = 0, lipidRate = 0, kvoType = 'none', kvoRate = 0, day = 3 }) {
  els.bWt.value = String(weightG);
  els.fRefSrc.value = 'birth';
  els.vol.value = String(feeds);
  els.ivType.value = ivType;
  els.ivRate.value = String(ivRate);
  els.lipidRate.value = String(lipidRate);
  els.kvoType.value = kvoType;
  els.kvoRate.value = String(kvoRate);
  els.day.value = String(day);
  els.fluidReadouts.innerHTML = '';
  context.renderFluids();
  return els.fluidReadouts.innerHTML;
}

test('feeds + IV + lipid + KVO are all included once in total fluid', () => {
  // 1 kg: feeds 40 mL/kg/d + IV 2 mL/h*24 = 48
  // + lipid 0.2 mL/h*24 = 4.8 + KVO 0.1 mL/h*24 = 2.4
  // Expected total = 95.2 mL/day = 95.2 mL/kg/day.
  const out = setCase({ weightG: 1000, feeds: 40, ivType: 'D10', ivRate: 2, lipidRate: 0.2, kvoType: 'NS', kvoRate: 0.1 });
  assert.match(out, /95 mL\\/day/);
  assert.match(out, />95\.2</);
  assert.match(out, /Feeds/);
  assert.match(out, /D10/);
  assert.match(out, /Lipid 20%/);
  assert.match(out, /Normal saline/);
});

test('weight conversion is correct for a 2 kg infant', () => {
  // 2 kg: feeds 60 mL/kg/d = 120 mL/day; IV 1 mL/h = 24 mL/day;
  // lipid 0.25 mL/h = 6 mL/day; total 150 mL/day = 75 mL/kg/day.
  const out = setCase({ weightG: 2000, feeds: 60, ivType: 'D10', ivRate: 1, lipidRate: 0.25 });
  assert.match(out, /150 mL\/day/);
  assert.match(out, />75</);
});

test('zero IV and zero KVO do not add hidden volume', () => {
  // 900 g infant: feeds 50 mL/kg/d = 45 mL/day, with no IV, lipid or KVO.
  const out = setCase({ weightG: 900, feeds: 50, ivType: 'none', ivRate: 0, lipidRate: 0, kvoType: 'none', kvoRate: 0 });
  assert.match(out, /45 mL\/day/);
  assert.match(out, />50</);
  assert.doesNotMatch(out, /Heparin saline|Normal saline/);
});

test('KVO is added to the total and opens its detail panel', () => {
  // 1.5 kg: feeds 80 mL/kg/d = 120 mL/day; IV 0.5 mL/h = 12;
  // KVO 0.2 mL/h = 4.8; total 136.8 mL/day = 91.2 mL/kg/day.
  const out = setCase({ weightG: 1500, feeds: 80, ivType: 'D10', ivRate: 0.5, lipidRate: 0, kvoType: 'heparinSaline', kvoRate: 0.2 });
  assert.match(out, /137 mL\\/day/);
  assert.match(out, />91\.2</);
  assert.equal(els.kvoBox.open, true);
});

test('enteral-only mode clears the IV fluid readout', () => {
  els.fluidReadouts.innerHTML = 'stale';
  context.window.__nutMode = 'enteral';
  context.renderFluids();
  assert.equal(els.fluidReadouts.innerHTML, '');
  context.window.__nutMode = 'tpn';
});
