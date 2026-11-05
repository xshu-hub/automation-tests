import { test, expect } from '../../targets/demo/fixtures';
import { writeFile } from 'node:fs/promises';
import { FAILURE_TITLE, CLEANUP_TITLE, FAILURE_MARKER } from '../failure-report';
import type { Item } from '../../targets/demo/test-data/items';

// Executed ONLY by npm run verify:failure. A deliberate failure checks real reporting/teardown.
test(FAILURE_TITLE, async ({ cleanup, createItem, itemsApi, itemsPage }, testInfo) => {
  const probe: { item?: Item } = {};
  // LIFO: this proof runs AFTER createItem's deletion, registered later.
  cleanup.defer('verify cleanup after the failed assertion', async () => {
    const item = probe.item;
    if (!item) return;
    expect((await itemsApi.get(item.id)).status()).toBe(404);
    const proof = testInfo.outputPath('cleanup-verified.json');
    await writeFile(proof, JSON.stringify({ id: item.id, removed: true }));
    await testInfo.attach('cleanup-verified', { path: proof, contentType: 'application/json' });
  });
  const item = await createItem('failure-cleanup-probe');
  probe.item = item;
  const proof = testInfo.outputPath('created-item.json');
  await writeFile(proof, JSON.stringify({ id: item.id, title: item.title }));
  await testInfo.attach('created-item', { path: proof, contentType: 'application/json' });
  await itemsPage.open();
  expect('actual', FAILURE_MARKER).toBe('expected');
});

test(CLEANUP_TITLE, async ({ itemsApi }, testInfo) => {
  const response = await itemsApi.list();
  expect(response.status()).toBe(200);
  const items = await response.json() as { title: string }[];
  expect(items.some((item) => item.title === 'failure-cleanup-probe')).toBe(false);
  const proof = testInfo.outputPath('post-cleanup-verified.json');
  await writeFile(proof, JSON.stringify({ remaining: 0 }));
  await testInfo.attach('post-cleanup-verified', { path: proof, contentType: 'application/json' });
});
