import { test, expect } from '../../fixtures';
import { expectJson } from '../../../../shared/api/assertions';
import { itemSchema, invalidTitles } from '../../test-data/items';

test('创建、查询、删除事项', { tag: '@smoke' }, async ({ createItem, itemsApi }) => {
  const item = await createItem();
  const fetched = await expectJson(await itemsApi.get(item.id), { status: 200, schema: itemSchema });
  expect(fetched).toEqual(item);
  expect((await itemsApi.remove(item.id)).status()).toBe(204);
  expect((await itemsApi.get(item.id)).status()).toBe(404);
});

for (const [index, title] of invalidTitles.entries()) {
  test(`拒绝无效事项名称 ${index + 1}`, async ({ itemsApi }) => {
    const response = await itemsApi.create(title);
    expect(response.status()).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'title_required' });
  });
}

test('保留服务端错误，不自动重试', async ({ api }) => {
  const response = await api.get('unavailable');
  expect(response.status()).toBe(503);
});

test('支持 query 参数和二进制响应', async ({ api }) => {
  const response = await api.get('export', { params: { label: '接口导出' } });
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('text/csv');
  expect((await response.body()).toString()).toContain('接口导出');
});

test('支持 multipart 上传', async ({ api }) => {
  const response = await api.post('upload', {
    multipart: { file: { name: 'sample.txt', mimeType: 'text/plain', buffer: Buffer.from('sample content') } },
  });
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ uploaded: true });
});

test('默认不跟随鉴权重定向', async ({ api }) => {
  const response = await api.get('redirect');
  expect(response.status()).toBe(302);
});

test('拒绝将 API 请求发送至其他 origin', async ({ api }) => {
  await expect(api.get('https://example.invalid/')).rejects.toThrow('configured API origin');
});
