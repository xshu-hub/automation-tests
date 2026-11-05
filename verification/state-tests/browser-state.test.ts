import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { after, before, test } from 'node:test';
import { chromium, type Browser } from '@playwright/test';
import { injectSessionStorage } from '../../shared/auth/browser-state';
import { normalizeIdentity } from '../../shared/input/load';

let browser: Browser;
let application: Server;
let alternate: Server;
let origin: string;
let otherOrigin: string;
const receivedRequests: string[] = [];

async function serveApplication(): Promise<{ server: Server; origin: string }> {
  const server = createServer((request, response) => {
    receivedRequests.push(`${request.headers.host}${request.url}`);
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end(`<!doctype html><body><script>
      document.body.dataset.token = sessionStorage.getItem('token') ?? '<missing>';
      document.body.dataset.removable = sessionStorage.getItem('removable') ?? '<missing>';
    </script></body>`);
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

before(async () => {
  ({ server: application, origin } = await serveApplication());
  ({ server: alternate, origin: otherOrigin } = await serveApplication());
  const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH;
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
});

after(async () => {
  await browser?.close();
  await Promise.all([application, alternate].filter(Boolean).map((server) =>
    new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  ));
});

test('bootstrap sends no application traffic and preserves rotation, removal and clear across reloads and frames', async (t) => {
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();
  const requestsBefore = receivedRequests.length;
  await injectSessionStorage(page, { [origin]: { token: 'initial', removable: 'initial' } });
  assert.equal(page.url(), 'about:blank');
  assert.equal(receivedRequests.length, requestsBefore);

  await page.goto(`${origin}/app`);
  assert.equal(await page.locator('body').getAttribute('data-token'), 'initial');
  await page.evaluate(() => {
    sessionStorage.setItem('token', 'rotated');
    sessionStorage.removeItem('removable');
  });
  await page.reload();
  assert.equal(await page.locator('body').getAttribute('data-token'), 'rotated');
  assert.equal(await page.locator('body').getAttribute('data-removable'), '<missing>');

  await page.evaluate(() => new Promise<void>((resolve) => {
    const frame = document.createElement('iframe');
    frame.src = '/frame';
    frame.onload = () => resolve();
    document.body.append(frame);
  }));
  const frame = page.frames().find((entry) => entry.parentFrame());
  assert.ok(frame);
  assert.equal(await frame.evaluate(() => sessionStorage.getItem('token')), 'rotated');
  await frame.evaluate(() => sessionStorage.setItem('token', 'rotated-in-frame'));
  await frame.goto(`${origin}/next-frame`);
  assert.equal(await frame.evaluate(() => sessionStorage.getItem('token')), 'rotated-in-frame');
  await page.reload();
  assert.equal(await page.locator('body').getAttribute('data-token'), 'rotated-in-frame');

  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  assert.equal(await page.evaluate(() => sessionStorage.length), 0);
  assert.equal(await page.locator('body').getAttribute('data-token'), '<missing>');
});

test('origins and independent pages keep separate state while native opener popups inherit current state', async (t) => {
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();
  const requestsBefore = receivedRequests.length;
  await injectSessionStorage(page, {
    [`${origin}/`]: { token: 'first-origin' },
    [otherOrigin]: { token: 'second-origin' },
  });
  assert.equal(receivedRequests.length, requestsBefore);
  await page.goto(`${origin}/app`);
  assert.equal(await page.evaluate(() => sessionStorage.getItem('token')), 'first-origin');
  await page.evaluate(() => sessionStorage.setItem('token', 'current-opener-token'));
  await page.goto(`${otherOrigin}/app`);
  assert.equal(await page.evaluate(() => sessionStorage.getItem('token')), 'second-origin');
  await page.goto(`${origin}/app`);
  assert.equal(await page.evaluate(() => sessionStorage.getItem('token')), 'current-opener-token');

  const popupPromise = page.waitForEvent('popup');
  await page.evaluate(() => { window.open('/popup'); });
  const popup = await popupPromise;
  await popup.waitForLoadState();
  assert.equal(await popup.evaluate(() => sessionStorage.getItem('token')), 'current-opener-token');
  await popup.evaluate(() => sessionStorage.setItem('token', 'popup-only'));
  assert.equal(await page.evaluate(() => sessionStorage.getItem('token')), 'current-opener-token');

  const independent = await context.newPage();
  await independent.goto(`${origin}/app`);
  assert.equal(await independent.evaluate(() => sessionStorage.getItem('token')), null);
  const prepared = await context.newPage();
  await injectSessionStorage(prepared, { [origin]: { token: 'explicitly-prepared' } });
  await prepared.goto(`${origin}/app`);
  assert.equal(await prepared.evaluate(() => sessionStorage.getItem('token')), 'explicitly-prepared');
});

test('empty state leaves a page untouched and nonempty state rejects an application page', async (t) => {
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();
  await injectSessionStorage(page, {});
  assert.equal(page.url(), 'about:blank');
  await page.goto(`${origin}/app`);
  const requestsBefore = receivedRequests.length;
  await injectSessionStorage(page, {});
  await injectSessionStorage(page, { [origin]: {} });
  await assert.rejects(injectSessionStorage(page, { [origin]: { token: 'late' } }), /fresh about:blank/);
  assert.equal(page.url(), `${origin}/app`);
  assert.equal(receivedRequests.length, requestsBefore);
});

test('failed seeding retains its error and removes the exact bootstrap route', async (t) => {
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();
  let bootstrapURL = '';
  page.on('request', (request) => { bootstrapURL = request.url(); });
  const requestsBefore = receivedRequests.length;
  await assert.rejects(injectSessionStorage(page, { [origin]: { oversized: 'x'.repeat(10 * 1024 * 1024) } }),
    /QuotaExceededError/);
  assert.equal(receivedRequests.length, requestsBefore);
  assert.ok(bootstrapURL.startsWith(`${origin}/__automation_session_storage__/`));
  await page.goto(bootstrapURL);
  assert.ok(receivedRequests.slice(requestsBefore).some((request) => request.endsWith(new URL(bootstrapURL).pathname)));
});

test('native IndexedDB and partitioned cookie state survives normalization and a new browser context', async (t) => {
  const source = await browser.newContext();
  t.after(() => source.close());
  await source.addCookies([{
    name: 'partitioned', value: 'external-cookie', domain: 'web.example.com', path: '/',
    expires: -1, httpOnly: true, secure: true, sameSite: 'None', partitionKey: 'https://top.example.com',
  }]);
  const page = await source.newPage();
  await page.goto(`${origin}/app`);
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('external-auth', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('tokens');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const transaction = request.result.transaction('tokens', 'readwrite');
      transaction.objectStore('tokens').put('external-idb-token', 'access');
      transaction.oncomplete = () => { request.result.close(); resolve(); };
      transaction.onerror = () => reject(transaction.error);
    };
  }));
  const nativeState = await source.storageState({ indexedDB: true });
  const nativeCookie = nativeState.cookies[0] as typeof nativeState.cookies[number] & { partitionKey?: string };
  assert.ok(nativeCookie.partitionKey);
  const identity = normalizeIdentity({ storageState: nativeState });
  assert.deepEqual(identity.storageState, nativeState);
  const restored = await browser.newContext({ storageState: identity.storageState });
  t.after(() => restored.close());
  assert.equal((await restored.cookies())[0].partitionKey, nativeCookie.partitionKey);
  const restoredPage = await restored.newPage();
  await restoredPage.goto(`${origin}/app`);
  const token = await restoredPage.evaluate(() => new Promise<unknown>((resolve, reject) => {
    const request = indexedDB.open('external-auth');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const transaction = request.result.transaction('tokens', 'readonly');
      const result = transaction.objectStore('tokens').get('access');
      result.onsuccess = () => resolve(result.result);
      result.onerror = () => reject(result.error);
      transaction.oncomplete = () => request.result.close();
    };
  }));
  assert.equal(token, 'external-idb-token');
});
