import { test, expect } from '../../fixtures';
import { expectJson } from '../../../../shared/api/assertions';
import { uniqueName } from '../../../../shared/data/unique';
import { itemSchema } from '../../test-data/items';

test.describe('数据清理回归', () => {
  test.describe.configure({ mode: 'serial' });

  const cleanupOrderTitle = uniqueName('cleanup-order');
  const invalidResponseTitle = uniqueName('__invalid-response__');

  test('先请求 cleanup fixture 仍能在 teardown 中使用 API', async ({ cleanup, api }) => {
    const item = await expectJson(await api.post('items', { data: { title: cleanupOrderTitle } }), {
      status: 201, schema: itemSchema,
    });
    cleanup.defer('delete cleanup-order probe', async () => {
      expect((await api.delete(`items/${item.id}`)).status()).toBe(204);
    });
  });

  test('cleanup 参数顺序探针未留下事项', async ({ itemsApi }) => {
    const items = await expectJson(await itemsApi.list(), { status: 200, schema: itemSchema.array() });
    expect(items.some((item) => item.title === cleanupOrderTitle)).toBe(false);
  });

  test('服务端已创建但响应 schema 错误时保留校验失败', async ({ createItem }) => {
    await expect(createItem(invalidResponseTitle)).rejects.toThrow(/schema.*owner/i);
  });

  test('响应 schema 失败后仍清理了已创建事项', async ({ itemsApi }) => {
    const items = await expectJson(await itemsApi.list(), { status: 200, schema: itemSchema.array() });
    expect(items.some((item) => item.title === invalidResponseTitle)).toBe(false);
  });
});
