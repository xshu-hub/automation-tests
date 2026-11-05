import { test, expect } from '../../fixtures';
import { uniqueName } from '../../../../shared/data/unique';
import { expectJson } from '../../../../shared/api/assertions';
import { itemSchema } from '../../test-data/items';
import type { ApiContextOptions } from '../../../../shared/api/types';

test('API 会话拒绝公共选项中的额外身份凭据', async ({ apiSessions }) => {
  const inputs = [
    { httpCredentials: { username: 'public-demo', password: 'public-demo', send: 'always' } },
    { clientCertificates: [] },
  ];
  for (const [index, apiOptions] of inputs.entries()) {
    await expect(apiSessions.create(`invalid-credentials-${index}`, {
      identity: 'anonymous', apiOptions: apiOptions as unknown as ApiContextOptions,
    })).rejects.toThrow('API credentials must come from external identity input');
  }
});

test('API 同源 URL 也不能夹带用户名和密码', async ({ api, runtime }) => {
  const url = new URL('me', runtime.apiBaseURL);
  url.username = 'public-demo';
  url.password = 'public-demo';
  await expect(api.get(url.href)).rejects.toThrow('must not contain credentials');
});

test('多系统 API 会话按系统选择身份，保持 origin 和 Cookie 隔离', async ({ apiSessions }) => {
  const primary = await apiSessions.create('primary-admin', { identity: 'admin' });
  const secondary = await apiSessions.create('secondary-reader', { system: 'secondary' });
  const anonymous = await apiSessions.create('secondary-anonymous', { system: 'secondary', identity: 'anonymous' });
  expect(await (await primary.api.get('me')).json()).toEqual({ user: 'admin' });
  expect(await (await secondary.api.get('me')).json()).toEqual({ user: 'reader' });
  expect((await anonymous.api.get('me')).status()).toBe(401);
  expect((await secondary.api.post('items', { data: { title: uniqueName() } })).status()).toBe(403);
  await expect(primary.api.get('http://127.0.0.1:4174/api/me')).rejects.toThrow('configured API origin');
  expect(() => apiSessions.create('primary-admin', { identity: 'reader' })).toThrow('already exists');
});

test('跨系统数据准备在 API 上下文释放前按逆序清理', async ({ apiSessions }) => {
  const source = await apiSessions.create('source', { identity: 'admin' });
  const destination = await apiSessions.create('destination', { system: 'secondary', identity: 'admin' });
  const title = uniqueName('cross-system');
  // Both services are independent local demos; this test explicitly transfers the business key.
  for (const session of [source, destination]) {
    apiSessions.cleanup.defer(`remove ${session.name}`, async () => {
      const entries = await expectJson(await session.api.get('items'), { status: 200, schema: itemSchema.array() });
      for (const item of entries.filter(item => item.title === title)) {
        expect((await session.api.delete(`items/${item.id}`)).status()).toBe(204);
      }
    });
    const item = await expectJson(await session.api.post('items', { data: { title } }), { status: 201, schema: itemSchema });
    expect(item.title).toBe(title);
  }
});

for (const method of ['PUT', 'PATCH', 'OPTIONS'] as const) {
  test(`${method} 保留方法和 JSON 请求体`, async ({ api }) => {
    const response = method === 'PUT' ? await api.put('echo', { data: { value: 1 } })
      : method === 'PATCH' ? await api.patch('echo', { data: { value: 1 } })
      : await api.send(method, 'echo', { data: { value: 1 } });
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ method, content: JSON.stringify({ value: 1 }) });
  });
}

test('HEAD 保留响应头且没有响应体，form 正确编码', async ({ api }) => {
  const head = await api.head('echo');
  expect(head.status()).toBe(200);
  expect(head.headers()['x-demo-method']).toBe('HEAD');
  expect((await head.body()).length).toBe(0);
  const response = await api.post('echo', { form: { text: '中文 & value', count: 2 } });
  expect(response.status()).toBe(200);
  const body = await response.json() as { contentType: string; content: string };
  expect(body.contentType).toContain('application/x-www-form-urlencoded');
  expect(new URLSearchParams(body.content).get('text')).toBe('中文 & value');
});

test('写请求明确拒绝自动重试选项', async ({ api }) => {
  await expect(api.post('echo', { maxRetries: 1 })).rejects.toThrow('not allowed for write requests');
  await expect(api.send('patch', 'echo', { maxRetries: 1 })).rejects.toThrow('not allowed for write requests');
});

test('具名 API 管理器清理后真实 context 已释放，重复收尾不重复清理', async ({ apiSessions }) => {
  const session = await apiSessions.create('lifecycle', { identity: 'admin' });
  let cleaned = 0;
  apiSessions.cleanup.defer('verify live API', async () => {
    expect((await session.api.get('me')).status()).toBe(200);
    cleaned++;
  });
  // Explicit disposal here is a lifecycle probe; normal tests let the fixture dispose.
  await apiSessions.dispose();
  await apiSessions.dispose();
  expect(cleaned).toBe(1);
  await expect(session.context.get('me')).rejects.toThrow(/disposed|closed/i);
});
