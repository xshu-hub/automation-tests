import { z } from 'zod';
import { test, expect } from '../../fixtures';
import { expectJson } from '../../../../shared/api/assertions';
import type { RequestOptions } from '../../../../shared/api/client';

test('JSON 断言支持异步 schema refinement', async ({ api }) => {
  const schema = z.object({
    user: z.string().refine(async (value) => value === 'admin'),
  });
  const body = await expectJson(await api.get('me'), { status: 200, schema });
  expect(body).toEqual({ user: 'admin' });
});

test('JSON 解析错误不会回显响应中的敏感值', async ({ api }) => {
  const response = await api.get('plain-text');
  const assertion = expectJson(response, { status: 200, schema: z.object({}) });
  await expect(assertion).rejects.toThrow('Could not read a JSON response body (HTTP 200)');
  await expect(assertion).rejects.not.toThrow('sensitive-body-demo-value');
});

test('schema 错误保留字段和错误类型并隐藏自定义消息', async ({ api }) => {
  const secret = 'sensitive-schema-demo-value';
  const schema = z.object({
    user: z.string().refine(() => false, { message: secret }),
  });
  const assertion = expectJson(await api.get('me'), { status: 200, schema });
  await expect(assertion).rejects.toThrow('user: custom');
  await expect(assertion).rejects.not.toThrow(secret);
});

test('未类型化请求选项也不能开启客户端重定向', async ({ api }) => {
  const options = { maxRedirects: 1, timeout: 5_000 } as RequestOptions;
  const response = await api.get('redirect', options);
  expect(response.status()).toBe(302);
  expect(response.headers().location).toBe('/items');
});

test('原生 API 上下文默认保留重定向响应', async ({ apiContext }) => {
  const response = await apiContext.get('redirect');
  expect(response.status()).toBe(302);
  expect(response.headers().location).toBe('/items');
});

test.describe('API 上下文配置', () => {
  const userAgent = 'automation-foundation-regression';
  test.use({ apiOptions: { userAgent } });

  test('apiOptions 的原生选项实际应用于请求', async ({ api }) => {
    const response = await api.get('request-info');
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ userAgent });
  });
});
