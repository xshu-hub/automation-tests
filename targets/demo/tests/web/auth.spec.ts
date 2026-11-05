import { test, expect } from '../../fixtures';

test('Cookie、localStorage、sessionStorage 均已注入', { tag: '@smoke' }, async ({ page }) => {
  await page.goto('/items');
  await expect(page.getByTestId('current-user')).toHaveText('admin');
  await expect(page.getByTestId('local-user')).toHaveText('admin');
  await expect(page.getByTestId('tenant')).toHaveText('local-tenant');
});

test('API Authorization 不会注入浏览器请求', async ({ page, api }) => {
  expect((await api.get('header-only')).status()).toBe(200);
  await page.goto('/items');
  const status = await page.evaluate(async () => (await fetch('/api/header-only')).status);
  expect(status).toBe(401);
});

test.describe('只读身份', () => {
  test.use({ identity: 'reader' });
  test('浏览器身份相互隔离', async ({ page }) => {
    await page.goto('/items');
    await expect(page.getByTestId('current-user')).toHaveText('reader');
    await expect(page.getByTestId('local-user')).toHaveText('reader');
  });
});

test.describe('匿名身份', () => {
  test.use({ identity: 'anonymous' });
  test('不继承 Cookie 或浏览器存储', async ({ page }) => {
    await page.goto('/items');
    await expect(page.getByTestId('current-user')).toHaveText('anonymous');
    await expect(page.getByTestId('local-user')).toHaveText('none');
    await expect(page.getByTestId('tenant')).toHaveText('none');
  });
});

test.describe('仅 API 身份', () => {
  test.use({ identity: 'header-only' });
  test('API Token 不会隐式建立浏览器会话', async ({ page, api }) => {
    expect((await api.get('me')).status()).toBe(200);
    await page.goto('/items');
    await expect(page.getByTestId('current-user')).toHaveText('anonymous');
  });
});
