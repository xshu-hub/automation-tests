import type { EventEmitter } from 'node:events';
import { readFile } from 'node:fs/promises';
import { test, expect } from '../../fixtures';
import { BasePage } from '../../../../shared/web/base-page';
import { resolveURL, withQuery } from '../../../../shared/web/urls';
import { PlaygroundPage } from '../../pages/playground.page';

test('页面导航保留响应、query、历史和显式URL语义', async ({ page, playgroundPage: app }) => {
  const response = await app.open({ query: { view: 'first', tag: ['a', 'b'] } });
  expect(response?.status()).toBe(200);
  await expect(page.getByTestId('view')).toHaveText('first');
  expect(new URL(page.url()).searchParams.getAll('tag')).toEqual(['a', 'b']);
  await page.getByRole('link', { name: '下一视图', exact: true }).click();
  await expect(page.getByTestId('view')).toHaveText('next');
  await app.back();
  await app.expectReady();
  await expect(page.getByTestId('view')).toHaveText('first');
  await app.forward();
  await app.expectReady();
  await expect(page.getByTestId('view')).toHaveText('next');
  expect((await app.reload())?.status()).toBe(200);
  expect(withQuery('items?keep=1&tag=old#section', { tag: ['a', 'b'], keep: undefined, remove: null }))
    .toBe('items?keep=1&tag=a&tag=b#section');
  expect(resolveURL('items', 'https://example.test/app/').href).toBe('https://example.test/app/items');
  expect(resolveURL('/items', 'https://example.test/app/').href).toBe('https://example.test/items');
});

test('错误文档默认失败，预期错误状态可以显式声明', async ({ page }) => {
  class ErrorPage extends BasePage {
    readonly path = '/playground/error';
    protected readonly ready = this.page.getByRole('heading', { name: 'Example server error', exact: true });
  }
  const errorPage = new ErrorPage(page);
  await expect(errorPage.open()).rejects.toThrow('HTTP 500');
  expect((await errorPage.open({ expectedStatus: 500 }))?.status()).toBe(500);
});

test('原生Locator动作保留输入、勾选、选择、键盘和滚动语义', async ({ page, playgroundPage: app }) => {
  await app.open();
  const input = page.getByLabel('文本', { exact: true });
  await app.actions.fill(input, 'value');
  await app.actions.press(input, 'End');
  await app.actions.press(input, 'Backspace');
  await expect(input).toHaveValue('valu');
  const checkbox = page.getByLabel('同意条款', { exact: true });
  await app.actions.check(checkbox);
  await expect(checkbox).toBeChecked();
  await app.actions.check(checkbox, false);
  await expect(checkbox).not.toBeChecked();
  expect(await app.actions.select(page.getByLabel('原生选择', { exact: true }), 'two')).toEqual(['two']);
  const bottom = page.getByRole('button', { name: '底部按钮', exact: true });
  await app.actions.scroll(bottom);
  await expect(bottom).toBeInViewport();
  await app.actions.click(bottom);
  await expect(page.getByRole('status', { name: '操作结果', exact: true })).toHaveText('已到达底部');
});

test('事件同步匹配请求并在成功、动作失败、谓词失败和超时后移除监听', async ({ page, playgroundPage: app }) => {
  await app.open();
  const emitter = page as unknown as EventEmitter;
  const counts = (): number[] => ['response', 'close', 'crash'].map((event) => emitter.listenerCount(event));
  const before = counts();
  const response = await app.waits.response(
    () => page.getByRole('button', { name: '发送查询', exact: true }).click(),
    (value) => {
      const url = new URL(value.url());
      return value.request().method() === 'GET' && url.pathname === '/health' && url.searchParams.get('source') === 'foundation';
    },
  );
  expect(response.status()).toBe(200);
  await expect(page.getByRole('status', { name: '操作结果', exact: true })).toHaveText('查询完成');
  expect(counts()).toEqual(before);
  const failure = new Error('Action failed before producing an event');
  let actions = 0;
  await expect(app.waits.response(async () => { actions++; throw failure; }, () => true)).rejects.toBe(failure);
  expect(actions).toBe(1);
  expect(counts()).toEqual(before);
  const predicateFailure = new Error('Invalid response predicate');
  await expect(app.waits.response(
    () => page.evaluate(async () => { await fetch('/health'); }),
    () => { throw predicateFailure; },
  )).rejects.toBe(predicateFailure);
  expect(counts()).toEqual(before);
  await expect(app.waits.response(async () => {}, () => false, { timeout: 30 })).rejects.toThrow('waiting for response');
  expect(counts()).toEqual(before);
});

test('JS dialog显式处理，popup返回自己的Page', async ({ page, playgroundPage: app }) => {
  await app.open();
  const confirm = await app.actions.dialog(
    () => page.getByRole('button', { name: '确认操作', exact: true }).click(),
    { action: 'dismiss' },
  );
  expect(confirm).toMatchObject({ type: 'confirm', message: '继续执行？' });
  await expect(page.getByRole('status', { name: '操作结果', exact: true })).toHaveText('已取消');
  await app.actions.dialog(
    () => page.getByRole('button', { name: '输入备注', exact: true }).click(),
    { action: 'accept', promptText: '已审核' },
  );
  await expect(page.getByRole('status', { name: '操作结果', exact: true })).toHaveText('已审核');
  const popup = await app.actions.popup(() => page.getByRole('link', { name: '打开新页面', exact: true }).click());
  try {
    await new PlaygroundPage(popup).expectReady();
    await expect(popup.getByTestId('view')).toHaveText('popup');
    expect(page.url()).not.toBe(popup.url());
  } finally {
    await popup.close();
  }
});

test('文件输入、file chooser和下载使用本用例文件路径', async ({ page, playgroundPage: app }, testInfo) => {
  await app.open();
  await app.files.input(page.getByLabel('直接上传', { exact: true }), {
    name: 'direct.txt', mimeType: 'text/plain', buffer: Buffer.from('direct'),
  });
  await expect(page.getByTestId('file-list')).toHaveText('direct.txt');
  await app.files.chooser(() => page.getByRole('button', { name: '选择文件', exact: true }).click(), {
    name: 'chosen.txt', mimeType: 'text/plain', buffer: Buffer.from('chosen'),
  });
  await expect(page.getByTestId('file-list')).toHaveText('chosen.txt');
  const destination = testInfo.outputPath('foundation', 'items.csv');
  const download = await app.files.download(() => page.getByRole('link', { name: '下载 CSV', exact: true }).click(), destination);
  expect(download.suggestedFilename()).toBe('items.csv');
  expect(await readFile(destination, 'utf8')).toContain('id,title');
});

test('storage仅操作当前origin，iframe保留独立Locator作用域', async ({ page, playgroundPage: app }) => {
  await app.open();
  for (const area of ['local', 'session'] as const) {
    await app.storage.set(area, 'foundation-probe', `${area}-value`);
    expect(await app.storage.get(area, 'foundation-probe')).toBe(`${area}-value`);
    expect(await app.storage.entries(area)).toMatchObject({ 'foundation-probe': `${area}-value` });
    await app.storage.remove(area, 'foundation-probe');
    expect(await app.storage.get(area, 'foundation-probe')).toBeNull();
  }
  const frame = app.frame(page.getByTitle('嵌入组件', { exact: true }));
  await app.actions.fill(frame.getByLabel('框内文本', { exact: true }), 'frame-value');
  await app.actions.click(frame.getByRole('button', { name: '确认框内输入', exact: true }));
  await expect(frame.getByRole('status')).toHaveText('frame-value');
  await expect(page.getByLabel('文本', { exact: true })).toHaveValue('');
});

test('业务step保留返回值并可将截图附加到本用例', async ({ page, playgroundPage: app }, testInfo) => {
  const title = await app.step('打开并确认基础能力页面', async () => {
    await app.open();
    return page.title();
  });
  expect(title).toBe('Browser foundation playground');
  const screenshot = await app.screenshot('foundation-page');
  expect(screenshot.subarray(1, 4).toString()).toBe('PNG');
  expect(testInfo.attachments).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'foundation-page', contentType: 'image/png' })]));
});
