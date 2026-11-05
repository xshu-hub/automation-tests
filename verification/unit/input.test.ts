import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { loadRuntime, normalizeIdentity, resolveIdentity } from '../../shared/input/load';

const original = {
  target: 'crm', environment: 'test',
  webBaseURL: 'https://web.example.com', apiBaseURL: 'https://api.example.com/api/',
  defaultIdentity: 'admin',
  identities: { admin: { api: { headers: { Authorization: 'Bearer test-secret' } } } },
};

function fixture(t: { after: (fn: () => void) => void }, value: unknown = original) {
  const dir = mkdtempSync(resolve(tmpdir(), 'automation-input-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = resolve(dir, 'runtime.json');
  writeFileSync(file, JSON.stringify(value));
  return { file, dir };
}

test('external input cannot accidentally run against a different target', (t) => {
  const { file } = fixture(t);
  assert.throws(() => loadRuntime(file, 'other-target'), /target must be/);
});

test('anonymous context never inherits the default identity', (t) => {
  const { file } = fixture(t);
  const runtime = loadRuntime(file, 'crm');
  const anonymous = resolveIdentity(runtime, 'anonymous');
  assert.deepEqual(anonymous.api.headers, {});
  assert.deepEqual(anonymous.storageState, { cookies: [], origins: [] });
  assert.equal(resolveIdentity(runtime, 'admin').api.headers.Authorization, 'Bearer test-secret');
});

test('missing identity is an error rather than an anonymous fallback', (t) => {
  const { file } = fixture(t);
  assert.throws(() => resolveIdentity(loadRuntime(file), 'missing'), /No external login state/);
});

test('expired state fails without trying to refresh or log in', (t) => {
  const { file } = fixture(t, {
    ...original, identities: { admin: { expiresAt: '2020-01-01T00:00:00Z' } },
  });
  assert.throws(() => resolveIdentity(loadRuntime(file), 'admin'), /has expired/);
});

test('storage files resolve relative to external input, and API/browser states can differ', (t) => {
  const { file, dir } = fixture(t, {
    ...original,
    identities: { admin: { storageState: './browser.json', api: { storageState: './api.json' } } },
  });
  const state = { cookies: [], origins: [{
    origin: 'https://web.example.com', localStorage: [{ name: 'token', value: 'local-test-token' }],
  }] };
  writeFileSync(resolve(dir, 'browser.json'), JSON.stringify(state));
  writeFileSync(resolve(dir, 'api.json'), JSON.stringify({ cookies: [], origins: [] }));
  const identity = resolveIdentity(loadRuntime(file), 'admin');
  assert.deepEqual(identity.storageState, state);
  assert.deepEqual(identity.api.storageState, { cookies: [], origins: [] });
});

test('invalid external fields identify locations without printing secret values', (t) => {
  const { file } = fixture(t, {
    ...original, identities: { admin: { api: { headers: { Authorization: { token: 'hidden-secret' } } } } },
  });
  assert.throws(() => loadRuntime(file), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /identities.admin.api.headers.Authorization/);
    assert.ok(!error.message.includes('hidden-secret'));
    return true;
  });
});

test('malformed JSON does not expose input content in the error', (t) => {
  const { file } = fixture(t);
  writeFileSync(file, '{"Authorization": "secret-that-must-not-be-logged" broken');
  assert.throws(() => loadRuntime(file), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.ok(!error.message.includes('secret-that-must-not-be-logged'));
    return true;
  });
});

test('origins normalize default ports and a trailing slash without losing native storage fields', (t) => {
  const state = {
    cookies: [{
      name: 'partitioned', value: 'external-cookie', domain: 'web.example.com', path: '/',
      expires: -1, httpOnly: true, secure: true, sameSite: 'None', partitionKey: 'https://example.com',
    }],
    origins: [{
      origin: 'https://WEB.example.com:443/', localStorage: [],
      indexedDB: [{ name: 'auth', version: 1, stores: [{ name: 'tokens', records: [{ key: 'token', value: 'external-idb' }] }] }],
    }],
  };
  const { file } = fixture(t, {
    ...original,
    identities: { admin: {
      storageState: state,
      sessionStorage: { 'https://WEB.example.com:443/': { tenant: 'external-tenant' } },
    } },
  });
  const identity = resolveIdentity(loadRuntime(file), 'admin');
  assert.equal(identity.storageState.origins[0].origin, 'https://web.example.com');
  assert.deepEqual(identity.sessionStorage, { 'https://web.example.com': { tenant: 'external-tenant' } });
  assert.deepEqual(identity.storageState.cookies, state.cookies);
  assert.deepEqual(identity.storageState.origins[0], { ...state.origins[0], origin: 'https://web.example.com' });
  assert.deepEqual(normalizeIdentity({ storageState: state }).storageState, identity.storageState);
});

test('identity resolution isolates mutable headers, session storage and IndexedDB between tests and contexts', (t) => {
  const { file } = fixture(t, {
    ...original,
    identities: { admin: {
      storageState: { cookies: [], origins: [{
        origin: 'https://web.example.com', localStorage: [{ name: 'token', value: 'original' }],
        indexedDB: [{ name: 'auth', stores: [{ records: [{ value: 'original' }] }] }],
      }] },
      sessionStorage: { 'https://web.example.com': { tenant: 'original' } },
      api: { headers: { Authorization: 'Bearer original' } },
    } },
  });
  const runtime = loadRuntime(file);
  const first = resolveIdentity(runtime, 'admin');
  first.api.headers.Authorization = 'Bearer changed';
  first.sessionStorage['https://web.example.com'].tenant = 'changed';
  first.storageState.origins[0].localStorage[0].value = 'changed';
  const indexedDB = (first.storageState.origins[0] as { indexedDB?: { stores: { records: { value: string }[] }[] }[] }).indexedDB!;
  indexedDB[0].stores[0].records[0].value = 'changed';
  assert.equal(first.api.storageState.origins[0].localStorage[0].value, 'original');
  const second = resolveIdentity(runtime, 'admin');
  assert.equal(second.api.headers.Authorization, 'Bearer original');
  assert.equal(second.sessionStorage['https://web.example.com'].tenant, 'original');
  assert.equal(second.storageState.origins[0].localStorage[0].value, 'original');
  assert.deepEqual((second.storageState.origins[0] as { indexedDB?: unknown }).indexedDB,
    [{ name: 'auth', stores: [{ records: [{ value: 'original' }] }] }]);
});

test('session and native storage reject paths, queries, fragments and credentials in origins', () => {
  const invalid = [
    'https://web.example.com/path', 'https://web.example.com/..', 'https://web.example.com\\..',
    'https://web.example.com?tenant=a', 'https://web.example.com?', 'https://web.example.com/#part',
    'https://web.example.com/#', 'https://user:secret@web.example.com', 'https://@web.example.com',
  ];
  for (const origin of invalid) {
    assert.throws(() => normalizeIdentity({ sessionStorage: { [origin]: { token: 'value' } } }),
      /invalid external login state/);
    assert.throws(() => normalizeIdentity({ storageState: { cookies: [], origins: [{ origin, localStorage: [] }] } }),
      /invalid external login state/);
  }
  assert.throws(() => normalizeIdentity({ sessionStorage: {
    'https://web.example.com': { token: 'one' },
    'https://web.example.com:443/': { token: 'two' },
  } }), /invalid external login state/);
});

test('base URLs reject credentials, queries and fragments while retaining API paths', (t) => {
  for (const field of ['webBaseURL', 'apiBaseURL']) {
    for (const suffix of ['?tenant=a', '?', '#section', '#']) {
      const { file } = fixture(t, { ...original, [field]: `https://web.example.com/api/${suffix}` });
      assert.throws(() => loadRuntime(file), new RegExp(`Check fields: ${field}`));
    }
    for (const authority of ['user:hidden-password@web.example.com', '@web.example.com']) {
      const { file } = fixture(t, { ...original, [field]: `https://${authority}/api/` });
      assert.throws(() => loadRuntime(file), (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, new RegExp(`Check fields: ${field}`));
        assert.ok(!error.message.includes('hidden-password'));
        return true;
      });
    }
  }
  const { file } = fixture(t, { ...original, apiBaseURL: 'https://web.example.com/api/@users/' });
  assert.equal(loadRuntime(file).apiBaseURL, 'https://web.example.com/api/@users/');
});

test('invalid origin keys do not expose embedded credentials in validation errors', (t) => {
  const { file } = fixture(t, {
    ...original,
    identities: { admin: { sessionStorage: { 'https://user:hidden-password@web.example.com': { token: 'hidden-token' } } } },
  });
  assert.throws(() => loadRuntime(file), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /identities.admin.sessionStorage.<origin>/);
    assert.ok(!error.message.includes('hidden-password'));
    assert.ok(!error.message.includes('hidden-token'));
    return true;
  });
});
