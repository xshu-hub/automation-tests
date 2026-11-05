import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test, expect } from '../../../shared/fixtures/base.fixture';

test('interrupt an active Chromium test after creating external data', async ({ api, cleanup, page }, testInfo) => {
  const proof = process.env.INTERRUPTION_PROOF!;
  const response = await api.post('items', { data: { name: 'interruption-probe' } });
  expect(response.status()).toBe(201);
  const item = await response.json() as { id: string };
  cleanup.defer('delete probe resource using the still-live API context', async () => {
    expect((await api.delete(`items/${item.id}`)).status()).toBe(204);
    const file = testInfo.outputPath('cleanup-verified.json');
    await writeFile(file, JSON.stringify({ id: item.id, removed: true }));
    await testInfo.attach('cleanup-verified', { path: file, contentType: 'application/json' });
    await writeFile(resolve(proof, 'cleanup-completed'), item.id);
  });
  if (process.env.INTERRUPTION_STALL === '1') {
    cleanup.defer('deliberately stall teardown before deletion', async () => {
      await writeFile(resolve(proof, 'cleanup-started'), item.id);
      await new Promise<void>(() => {});
    });
  }
  await page.goto('/');
  await expect(page.getByRole('heading')).toHaveText('Probe is ready');
  await testInfo.attach('created-item', { body: JSON.stringify(item), contentType: 'application/json' });
  await writeFile(testInfo.outputPath('before-interrupt.txt'), item.id);
  await writeFile(resolve(proof, 'test-ready.json'), JSON.stringify({ id: item.id, worker: process.pid }));
  // The verifier interrupts this actual in-flight browser operation, not a timer.
  await page.getByRole('button', { name: 'Never present: wait for interruption' }).click({ timeout: 0 });
});
