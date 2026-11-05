import { test, expect } from '../../fixtures';

test('Form通过自身根定位字段与提交按钮，不影响同名备用表单', async ({ page, playgroundPage: app }) => {
  await app.open();
  await app.form.fill({ 姓名: '测试用户', 邮箱: 'agent@example.test' });
  await app.form.check('接收通知');
  await app.form.select('地区', 'west');
  await app.form.submit('保存资料');
  await expect(page.getByTestId('form-result')).toHaveText(JSON.stringify({ name: '测试用户', email: 'agent@example.test', notify: 'on', region: 'west' }));
  await expect(page.getByRole('form', { name: '备用表单', exact: true }).getByLabel('姓名', { exact: true })).toHaveValue('备用用户');
});

test('Modal操作局限于对话框根，关闭后等待隐藏', async ({ page, playgroundPage: app }) => {
  await app.open();
  await page.getByRole('button', { name: '编辑资料', exact: true }).click();
  await app.modal.expectOpen();
  await app.modal.root.getByLabel('显示名', { exact: true }).fill('Modal user');
  await app.modal.close();
  await expect(app.modal.root).toBeHidden();
  await expect(page.getByRole('region', { name: '模态框示例', exact: true }).getByRole('button', { name: '关闭', exact: true })).toBeVisible();
});

test('Table按精确单元格定位，Pagination等待当前页改变', async ({ playgroundPage: app }) => {
  await app.open();
  await expect(app.table.rows).toHaveCount(2);
  await expect(app.table.cell('Alice', 1)).toHaveText('admin');
  await app.pagination.next();
  await expect(app.pagination.controls.current).toHaveText('2');
  await expect(app.table.rowByCell('Alice')).toHaveCount(0);
  await expect(app.table.cell('Carol', 1)).toHaveText('owner');
  await app.pagination.previous();
  await expect(app.table.cell('Bob', 1)).toHaveText('reader');
});

test('SingleSelect接受外置浮层locator，不依赖组件库CSS', async ({ playgroundPage: app }) => {
  await app.open();
  await app.stateSelect.select('已完成');
  await expect(app.stateSelect.trigger).toHaveText('已完成');
  await expect(app.stateSelect.trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(app.stateSelect.listbox).toBeHidden();
});
