import { test, expect } from '../../fixtures';

test('外部 API 请求头已注入', { tag: '@smoke' }, async ({ api }) => {
  const response = await api.get('header-only');
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ user: 'admin' });
});

test.describe('Cookie 鉴权', () => {
  test.use({ identity: 'cookie-only' });
  test('浏览器 Cookie 状态可用于独立 API 上下文', async ({ api }) => {
    const response = await api.get('me');
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ user: 'admin' });
  });
});

test.describe('只读身份', () => {
  test.use({ identity: 'reader' });
  test('API 读取到指定身份', async ({ api }) => {
    const response = await api.get('me');
    expect(await response.json()).toMatchObject({ user: 'reader' });
  });
  test('403 不会触发登录或重试', async ({ itemsApi }) => {
    expect((await itemsApi.create('forbidden')).status()).toBe(403);
  });
});

test.describe('匿名身份', () => {
  test.use({ identity: 'anonymous' });
  test('清空默认登录态并保留 401', async ({ api }) => {
    expect((await api.get('me')).status()).toBe(401);
  });
});
