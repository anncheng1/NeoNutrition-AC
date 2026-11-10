'use strict';

// Exercise the same backup-validation and merge helpers used by the browser UI.
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

const context = {};
vm.createContext(context);
vm.runInContext([
  extractFunction('isFiniteBackupNumber'),
  extractFunction('validatePatientBackup'),
  extractFunction('mergePatientRecords'),
].join('\n'), context);

function validRecord(pid = 'TEST-001') {
  return {
    sex: 'boy',
    fields: { bPid: pid, bWt: '900', gGaWk: '28' },
    toggles: { includeEnteral: true, includeLipid: false },
    mode: 'tpn',
    entries: [{ _id: 1, dol: 1, wt: 900, len: null, hc: null }],
    energyLog: [{ _id: 2, dol: 1, totalKcalKg: 70, totalProtKg: 2.5, eMax: 90, pMax: 3 }],
    savedAt: 1000,
    label: pid + ' (900g)',
  };
}

function envelope(patients) {
  return { app: 'NeoNutrition', backupVersion: 1, createdAt: '2026-11-10T00:00:00.000Z', patients };
}

test('accepts a complete v1 backup record', () => {
  const imported = context.validatePatientBackup(envelope({ patient_1: validRecord() }));
  assert.equal(Object.keys(imported).length, 1);
  assert.equal(imported.patient_1.fields.bPid, 'TEST-001');
});

test('accepts legacy records without optional entries and energy logs', () => {
  const legacy = { fields: { bPid: 'OLD', bWt: '1200' } };
  assert.equal(context.validatePatientBackup(envelope({ legacy })).legacy.fields.bPid, 'OLD');
});

test('rejects unsupported backup envelope and empty patient list', () => {
  assert.throws(() => context.validatePatientBackup({ app: 'Other', backupVersion: 1, patients: { a: validRecord() } }));
  assert.throws(() => context.validatePatientBackup(envelope({})), /no patient records/i);
});

test('rejects malformed record fields without importing a partial backup', () => {
  const malformed = validRecord();
  malformed.fields.bWt = { unexpected: 'object' };
  assert.throws(() => context.validatePatientBackup(envelope({ good: validRecord(), bad: malformed })));
});

test('rejects non-array growth and nutrition logs', () => {
  const record = validRecord();
  record.entries = {};
  assert.throws(() => context.validatePatientBackup(envelope({ patient_1: record })), /entries data/i);
  const second = validRecord();
  second.energyLog = 'not-an-array';
  assert.throws(() => context.validatePatientBackup(envelope({ patient_1: second })), /energyLog data/i);
});

test('rejects growth entries without a valid day or weight', () => {
  const missingDay = validRecord();
  missingDay.entries = [{ dol: null, wt: 900 }];
  assert.throws(() => context.validatePatientBackup(envelope({ patient_1: missingDay })));
  const missingWeight = validRecord();
  missingWeight.entries = [{ dol: 1, wt: null }];
  assert.throws(() => context.validatePatientBackup(envelope({ patient_1: missingWeight })));
});

test('rejects incomplete nutrition log snapshots', () => {
  const record = validRecord();
  record.energyLog[0].pMax = null;
  assert.throws(() => context.validatePatientBackup(envelope({ patient_1: record })), /incomplete/i);
});

test('rejects unsafe object keys', () => {
  const patients = JSON.parse('{"__proto__":{"fields":{}}}');
  assert.throws(() => context.validatePatientBackup(envelope(patients)), /invalid patient record key/i);
});

test('merge adds new records and skips duplicates without overwriting local data', () => {
  const local = { patient_1: { fields: { bPid: 'LOCAL' } } };
  const imported = { patient_1: { fields: { bPid: 'BACKUP' } }, patient_2: validRecord('NEW') };
  const result = context.mergePatientRecords(local, imported);
  assert.equal(result.added, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.patients.patient_1.fields.bPid, 'LOCAL');
  assert.equal(result.patients.patient_2.fields.bPid, 'NEW');
});

test('merge does not mutate the original local records object', () => {
  const local = { patient_1: { fields: { bPid: 'LOCAL' } } };
  const before = JSON.stringify(local);
  context.mergePatientRecords(local, { patient_2: validRecord('NEW') });
  assert.equal(JSON.stringify(local), before);
});
