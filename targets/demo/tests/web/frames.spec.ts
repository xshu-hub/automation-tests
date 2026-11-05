import { test, expect } from '../../fixtures';
import { ApprovalView } from '../../pages/approval.view';

test('多层跨 origin iframe 的视图在延迟加载和重建后保持定位作用域', async ({ page }) => {
  await page.goto('/frames');
  const outer = page.getByTitle('业务工作区', { exact: true }).contentFrame();
  const inner = outer.getByTitle('审批内容', { exact: true }).contentFrame();
  const view = new ApprovalView(page, inner);
  await outer.getByRole('button', { name: '加载审批', exact: true }).click();
  await view.submit('首次审核');
  await expect(view.root.getByRole('status')).toHaveText('首次审核');
  await expect(view.table.cell('Alice', 1)).toHaveText('待审批');
  await expect(page.getByLabel('审批意见', { exact: true })).toHaveValue('');
  await expect(page.getByTitle('备用工作区').contentFrame().getByRole('status')).toHaveText('');
  await outer.getByRole('button', { name: '重建审批', exact: true }).click();
  // Reuse the exact same view: it stores locator recipes, not a detached Frame/ElementHandle.
  await view.submit('重建后审核');
  await expect(view.root.getByRole('status')).toHaveText('重建后审核');
});

test('iframe 定位保持严格匹配，不静默选择同名 frame', async ({ page }) => {
  await page.goto('/frames');
  await page.locator('iframe').evaluateAll(frames => frames.forEach(frame => frame.setAttribute('title', '重复')));
  await expect(page.getByTitle('重复', { exact: true }).contentFrame().getByRole('heading').innerText())
    .rejects.toThrow(/strict mode violation/);
});
