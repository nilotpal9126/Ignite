import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { createHash, randomUUID } from 'node:crypto';
import rules from '../../enrollment-validation.js';
import worker from './worker.mjs';

const sample = () => ({ studentName: 'Anika Das', studentClass: '10', school: 'QA Academy No. 2',
  board: 'CBSE', otherBoard: '', state: 'Assam', district: 'Kamrup Metropolitan',
  city: 'Guwahati', preferredLocation: 'Beltola', guardianName: 'Mira Das',
  phone: '+91 69801 23456', sameWhatsapp: true, whatsapp: '',
  email: 'qa-parent@example.invalid', consent: true, whatsappOptIn: false });

test('shared validation normalizes contact details and accepts Unicode names / numbered schools', () => {
  const result = rules.validate({ ...sample(), studentName: 'अनिका दास', guardianName: '李 明' });
  assert.equal(result.valid, true);
  assert.equal(result.data.phone, '6980123456');
  assert.equal(result.data.whatsapp, result.data.phone);
  assert.equal(rules.states.length, 36);
});

test('rejects junk, arbitrary class/board/state, formula/markup, bad phones/email and missing consent', () => {
  for (const [key, value] of [
    ['studentName', '12345'], ['studentName', 'aaaaaa'], ['studentName', 'asdf'],
    ['school', '<script>'], ['school', '=IMPORTXML(1)'], ['studentClass', '99'],
    ['board', 'made-up'], ['state', 'made-up'], ['district', '00000'],
    ['preferredLocation', 'x'.repeat(101)], ['phone', '9999999999'], ['phone', '9876543210'],
    ['phone', '1234567890'], ['phone', '6980123456abc'], ['email', 'broken@'],
    ['consent', false], ['consent', 'true'],
  ]) assert.ok(rules.validate({ ...sample(), [key]: value }).errors[key], `${key}: ${value}`);
  assert.equal(rules.validate(null).valid, false);
  assert.equal(rules.validate([]).valid, false);
  assert.ok(rules.validate({ ...sample(), board: 'Other' }).errors.otherBoard);
  assert.ok(rules.validate({ ...sample(), sameWhatsapp: false, whatsapp: '123' }).errors.whatsapp);
});

test('dedup normalization ignores case/spacing/punctuation, permits siblings and does not expose unknown fields', () => {
  const first = rules.validate(sample()).data;
  const same = rules.validate({ ...sample(), studentName: ' ANIKA   DAS ', school: 'qa academy no 2', phone: '6980123456' }).data;
  assert.equal(rules.duplicateKey(first), rules.duplicateKey(same));
  assert.notEqual(rules.duplicateKey(first), rules.duplicateKey({ ...first, studentName: 'Anil Das' }));
  assert.equal('unexpected' in rules.validate({ ...sample(), unexpected: 'secret' }).data, false);
});

function sheetHarness(options = {}) {
  const rows = [];
  let held = false;
  let flushes = 0;
  const sheet = {
    getLastRow: () => rows.length,
    setFrozenRows() {},
    getRange(row, col, height, width) {
      return {
        getValues: () => Array.from({ length: height }, (_, i) => rows[row - 1 + i].slice(col - 1, col - 1 + width)),
        setNumberFormat() { return this; },
        setValues(values) { assert.equal(held, true, 'writes must be inside ScriptLock'); values.forEach((value, i) => { rows[row - 1 + i] = [...value]; }); return this; },
      };
    },
  };
  const spreadsheet = { getSheetByName: () => rows.length ? sheet : null, insertSheet: () => sheet };
  const context = createContext({
    PropertiesService: { getScriptProperties: () => ({ getProperty: (key) => ({ SHEETS_AUTH_SECRET: 'synthetic-secret', SPREADSHEET_ID: 'synthetic-sheet' })[key] }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (text) => ({ setMimeType: () => JSON.parse(text) }) },
    Utilities: { DigestAlgorithm: { SHA_256: 'sha256' }, computeDigest: (alg, value) => [...createHash(alg).update(value).digest()], getUuid: randomUUID },
    LockService: { getScriptLock: () => ({ tryLock: () => { if (options.busy) return false; assert.equal(held, false); held = true; return true; }, hasLock: () => held, releaseLock: () => { held = false; } }) },
    SpreadsheetApp: { openById: () => spreadsheet, flush: () => { flushes++; } },
  });
  runInContext(readFileSync(new URL('../../enrollment-validation.js', import.meta.url), 'utf8'), context);
  runInContext(readFileSync(new URL('./Code.gs', import.meta.url), 'utf8'), context);
  return { rows, get flushes() { return flushes; }, send(data, secret = 'synthetic-secret') {
    return context.doPost({ postData: { contents: JSON.stringify({ data, secret }) } });
  } };
}

test('Sheet creates one row, confirms only after flushing, deduplicates retries and permits siblings', () => {
  const sheet = sheetHarness();
  const data = { ...sample(), requestId: randomUUID() };
  const first = sheet.send(data);
  assert.equal(first.ok, true);
  assert.equal(sheet.flushes, 1);
  assert.match(first.reference, /^IGN-[A-F0-9]{12}$/);
  const retry = sheet.send(data);
  assert.equal(retry.reference, first.reference);
  assert.equal(retry.duplicate, true);
  const anotherBrowser = sheet.send({ ...data, requestId: randomUUID(), studentName: 'ANIKA DAS', school: 'QA academy no 2' });
  assert.equal(anotherBrowser.reference, first.reference);
  assert.equal(sheet.rows.length, 2, 'header + one student');
  assert.equal(sheet.send({ ...data, requestId: randomUUID(), studentName: 'Anil Das' }).ok, true);
  assert.equal(sheet.rows.length, 3);
  assert.equal(sheet.rows[1][13], "'+916980123456", 'phone is written as text, never as a formula');
});

test('Sheet rejects invalid submissions and unknown callers without adding rows', () => {
  const sheet = sheetHarness();
  assert.equal(sheet.send({ ...sample(), requestId: randomUUID() }, 'wrong-secret').ok, false);
  assert.equal(sheet.send({ ...sample(), requestId: randomUUID(), phone: '123' }).ok, false);
  assert.equal(sheet.rows.length, 0);
});

test('busy Sheet lock returns a retryable failure without writing or claiming success', () => {
  const sheet = sheetHarness({ busy: true });
  const response = sheet.send({ ...sample(), requestId: randomUUID() });
  assert.equal(response.ok, false);
  assert.equal(response.code, 'busy');
  assert.equal(sheet.rows.length, 0);
  assert.equal(sheet.flushes, 0);
});

test('an id reused for a different child and an altered Sheet schema fail without overwriting records', () => {
  const sheet = sheetHarness();
  const data = { ...sample(), requestId: randomUUID() };
  assert.equal(sheet.send(data).ok, true);
  assert.equal(sheet.send({ ...data, studentName: 'Another Student' }).code, 'request_conflict');
  assert.equal(sheet.rows.length, 2);
  sheet.rows[0][0] = 'Unexpected header';
  assert.equal(sheet.send({ ...data, requestId: randomUUID(), studentName: 'Another Student' }).code, 'sheet_schema_mismatch');
  assert.equal(sheet.rows.length, 2);
});

test('health indicates configuration presence without disclosing secrets or claiming student authentication', async () => {
  const request = new Request('https://api.example/health');
  const missing = await worker.fetch(request, {});
  assert.equal(missing.status, 503);
  const configured = await worker.fetch(request, { ALLOWED_ORIGIN: 'https://ignite.example',
    SHEETS_WEB_APP_URL: 'https://script.google.com/macros/s/synthetic/exec',
    SHEETS_AUTH_SECRET: 'synthetic-secret', TURNSTILE_SECRET_KEY: 'synthetic-turnstile' });
  assert.equal(configured.status, 200);
  const result = await configured.json();
  assert.equal(result.studentAuthentication, false);
  assert.equal(JSON.stringify(result).includes('synthetic-secret'), false);
});

test('overlapping Worker submissions keep separate students separate and collapse duplicate enquiries', async () => {
  const nativeFetch = globalThis.fetch;
  const sheet = sheetHarness();
  const env = { ALLOWED_ORIGIN: 'https://ignite.example', SHEETS_WEB_APP_URL: 'https://script.google.com/macros/s/synthetic/exec',
    SHEETS_AUTH_SECRET: 'synthetic-secret', TURNSTILE_SECRET_KEY: 'synthetic-turnstile' };
  const distinct = Array.from({ length: 20 }, (_, i) => ({ ...sample(),
    studentName: i === 0 ? 'Anika Das' : `Student ${String.fromCharCode(65 + i)}`, requestId: randomUUID(), turnstileToken: randomUUID() }));
  const duplicate = Array.from({ length: 5 }, () => ({ ...distinct[0], requestId: randomUUID(), turnstileToken: randomUUID() }));
  const sibling = { ...distinct[0], studentName: 'Anil Das', requestId: randomUUID(), turnstileToken: randomUUID() };
  let inFlight = 0;
  let peak = 0;
  try {
    globalThis.fetch = async (url, init) => {
      inFlight++; peak = Math.max(peak, inFlight);
      await new Promise(resolve => setTimeout(resolve, 2));
      try {
        return new Response(JSON.stringify(String(url).includes('siteverify')
          ? { success: true, action: 'enrollment', hostname: 'ignite.example' }
          : sheet.send(JSON.parse(init.body).data)));
      } finally { inFlight--; }
    };
    const responses = await Promise.all([...distinct, ...duplicate, sibling].map(async (data) => {
      const response = await worker.fetch(new Request('https://api.example/enrollments', {
        method: 'POST', headers: { Origin: env.ALLOWED_ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      }), env);
      assert.equal(response.status, 200);
      return response.json();
    }));
    assert.ok(peak > 1, 'requests actually overlap in the Worker test');
    assert.equal(responses.length, 26);
    assert.equal(responses.filter(r => r.duplicate).length, 5);
    assert.equal(new Set(responses.map(r => r.reference)).size, 21);
    assert.equal(sheet.rows.length, 22, 'header + 21 unique students');
  } finally { globalThis.fetch = nativeFetch; }
});

test('Worker enforces origin, validation, server Turnstile check and a confirmed upstream receipt', async () => {
  const nativeFetch = globalThis.fetch;
  const env = { ALLOWED_ORIGIN: 'https://ignite.example', SHEETS_WEB_APP_URL: 'https://script.google.com/macros/s/synthetic/exec',
    SHEETS_AUTH_SECRET: 'synthetic-secret', TURNSTILE_SECRET_KEY: 'synthetic-turnstile' };
  const request = (data, origin = env.ALLOWED_ORIGIN) => new Request('https://api.example/enrollments', {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  });
  const data = { ...sample(), requestId: randomUUID(), turnstileToken: 'synthetic-token' };
  let calls = 0;
  try {
    globalThis.fetch = async () => { calls++; throw new Error('No external calls expected'); };
    assert.equal((await worker.fetch(request(data, 'https://other.example'), env)).status, 403);
    assert.equal((await worker.fetch(request({ ...data, phone: '123' }), env)).status, 422);
    assert.equal((await worker.fetch(request(data), {})).status, 403);
    assert.equal(calls, 0);
    globalThis.fetch = async () => new Response(JSON.stringify({ success: false }));
    assert.equal((await worker.fetch(request(data), env)).status, 403);
    globalThis.fetch = async (url, init) => {
      if (String(url).includes('siteverify')) return new Response(JSON.stringify({ success: true, action: 'enrollment', hostname: 'ignite.example' }));
      const payload = JSON.parse(init.body);
      assert.equal(payload.secret, env.SHEETS_AUTH_SECRET);
      assert.equal(payload.data.phone, '6980123456');
      assert.equal(payload.data.requestId, data.requestId);
      assert.equal('turnstileToken' in payload.data, false);
      return new Response(JSON.stringify({ ok: true, duplicate: true, reference: 'IGN-012345ABCDEF' }));
    };
    const response = await worker.fetch(request(data), env);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), env.ALLOWED_ORIGIN);
    assert.equal((await response.json()).duplicate, true);
    globalThis.fetch = async (url) => String(url).includes('siteverify')
      ? new Response(JSON.stringify({ success: true, action: 'enrollment', hostname: 'ignite.example' }))
      : new Response('not a receipt');
    assert.equal((await worker.fetch(request(data), env)).status, 503);
  } finally { globalThis.fetch = nativeFetch; }
});
