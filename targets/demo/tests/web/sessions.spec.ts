import { test, expect } from '../../fixtures';
import { resolveSystem } from '../../../../shared/input/load';

test('同一用例多角色 Web/API 会话独立，API Authorization 不进入页面', async ({ browserSessions, apiSessions }) => {
  const admin = await browserSessions.create('admin', { identity: 'admin' });
  const reader = await browserSessions.create('reader', { system: 'secondary', identity: 'reader' });
  const api = await apiSessions.create('secondary-api', { system: 'secondary', identity: 'admin' });
  const adminPage = await admin.newPage();
  const readerPage = await reader.newPage();
  await admin.step('核对申请人身份', async () => {
    await adminPage.goto('/items');
    await expect(adminPage.getByTestId('current-user')).toHaveText('admin');
  });
  await readerPage.goto('/items');
  await expect(readerPage.getByTestId('current-user')).toHaveText('reader');
  await expect(readerPage.getByTestId('tenant')).toHaveText('secondary-tenant');
  expect(await (await api.api.get('me')).json()).toEqual({ user: 'admin' });
  expect(await readerPage.evaluate(async () => (await fetch('/api/header-only')).status)).toBe(401);
  await readerPage.evaluate(() => sessionStorage.setItem('demo_tenant', 'rotated'));
  await readerPage.reload();
  await expect(readerPage.getByTestId('tenant')).toHaveText('rotated');
  await expect(adminPage.getByTestId('tenant')).toHaveText('local-tenant');
  // Browser cleanup can still use all named API contexts.
  browserSessions.cleanup.defer('API is alive during browser cleanup', async () => {
    expect((await api.api.get('me')).status()).toBe(200);
    await expect(readerPage.getByTestId('current-user')).toHaveText('reader');
  });
});

test('同一会话可跨系统导航并创建独立页面，匿名会话不继承状态', async ({ browserSessions, runtime }) => {
  const session = await browserSessions.create('portal', { identity: 'admin' });
  const first = await session.newPage();
  await first.goto('/items');
  await first.evaluate(() => sessionStorage.setItem('demo_tenant', 'current-tab'));
  const second = await session.newPage();
  await second.goto('/items');
  await expect(second.getByTestId('tenant')).toHaveText('local-tenant');
  await first.goto(`${resolveSystem(runtime, 'secondary').webBaseURL}/items`);
  // Cookie domains do not include ports; the externally supplied cookie covers both local servers.
  await expect(first.getByTestId('current-user')).toHaveText('admin');
  await first.goto(`${runtime.webBaseURL}/items`);
  await expect(first.getByTestId('tenant')).toHaveText('current-tab');
  const anonymous = await browserSessions.create('anonymous', { identity: 'anonymous' });
  const page = await anonymous.newPage();
  await page.goto('/items');
  await expect(page.getByTestId('current-user')).toHaveText('anonymous');
  await expect(page.getByTestId('tenant')).toHaveText('none');
});

test('具名浏览器管理器关闭全部真实页面和 context', async ({ browserSessions, browser }) => {
  const session = await browserSessions.create('lifecycle', { identity: 'admin' });
  const first = await session.newPage();
  const second = await session.newPage();
  let cleaned = false;
  browserSessions.cleanup.defer('pages remain open for cleanup', () => {
    expect(first.isClosed()).toBe(false);
    expect(second.isClosed()).toBe(false);
    cleaned = true;
  });
  await browserSessions.dispose();
  expect(cleaned).toBe(true);
  expect(first.isClosed()).toBe(true);
  expect(second.isClosed()).toBe(true);
  expect(browser.contexts()).not.toContain(session.context);
});
