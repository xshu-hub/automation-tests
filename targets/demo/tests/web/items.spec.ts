import { readFile } from 'node:fs/promises';
import { test, expect } from '../../fixtures';
import { saveDownload } from '../../../../shared/web/download';
import { uniqueName } from '../../../../shared/data/unique';

test('接口准备数据，页面确认展示', { tag: '@smoke' }, async ({ createItem, itemsPage }) => {
  const item = await createItem();
  await itemsPage.open();
  await expect(itemsPage.row(item.title)).toBeVisible();
});

test('页面创建事项，接口核对结果', { tag: '@e2e' }, async ({ itemsPage, itemsApi, cleanup }) => {
  const title = uniqueName('web');
  // Register cleanup before the action; it also runs when the later assertion fails.
  cleanup.defer('delete item created through web', async () => {
    const response = await itemsApi.list();
    expect(response.status()).toBe(200);
    const items = await response.json() as { id: string; title: string }[];
    for (const item of items.filter((entry) => entry.title === title)) {
      expect((await itemsApi.remove(item.id)).status()).toBe(204);
    }
  });
  await itemsPage.open();
  const item = await itemsPage.create(title);
  const response = await itemsApi.list();
  expect(await response.json()).toEqual(expect.arrayContaining([expect.objectContaining({ title })]));
  const removed = await itemsPage.remove(title, item.id);
  expect(removed.status()).toBe(204);
  expect((await itemsApi.get(item.id)).status()).toBe(404);
});

test('下载文件保存到本用例产物目录', async ({ page }, testInfo) => {
  await page.goto('/items');
  const file = testInfo.outputPath('items.csv');
  await saveDownload(page, () => page.getByRole('link', { name: '导出 CSV' }).click(), file);
  expect(await readFile(file, 'utf8')).toContain('id,title');
});

test('上传文件', async ({ page }) => {
  await page.goto('/items');
  await page.getByLabel('上传文件').setInputFiles({
    name: 'example.txt', mimeType: 'text/plain', buffer: Buffer.from('example'),
  });
  await page.getByRole('button', { name: '上传', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('上传成功');
});
