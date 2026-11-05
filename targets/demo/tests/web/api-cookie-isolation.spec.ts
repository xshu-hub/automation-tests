import { test, expect } from '../../fixtures';

test.use({ identity: 'split-cookie' });

test('浏览器与独立 API 的初始 Cookie 和响应 Cookie 双向隔离', async ({ page, api }) => {
  const expectApiUser = async (user: string) => {
    const response = await api.get('me');
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ user });
  };

  await page.goto('/items');
  await expect(page.getByTestId('current-user')).toHaveText('admin');
  await expectApiUser('reader');

  // page.request intentionally shares the browser cookie jar.
  const browserRotation = await page.request.post('/api/rotate-cookie', { data: { user: 'reader' } });
  expect(browserRotation.status()).toBe(200);
  await page.reload();
  await expect(page.getByTestId('current-user')).toHaveText('reader');

  const apiRotation = await api.post('rotate-cookie', { data: { user: 'admin' } });
  expect(apiRotation.status()).toBe(200);
  await expectApiUser('admin');
  await page.reload();
  await expect(page.getByTestId('current-user')).toHaveText('reader');

  // Emit a browser Set-Cookie while the independent API has a different user.
  const secondBrowserRotation = await page.request.post('/api/rotate-cookie', { data: { user: 'reader' } });
  expect(secondBrowserRotation.status()).toBe(200);
  await page.reload();
  await expect(page.getByTestId('current-user')).toHaveText('reader');
  await expectApiUser('admin');
});
