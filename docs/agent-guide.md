# Agent 开发指南

## 一次任务的输入

明确项目 ID、环境、身份和需要覆盖的功能。外部工具的查询与登录态获取发生在框架之外，交付统一运行输入后再执行测试。

## 最小工作流

1. 读取根目录及目标目录 AGENTS.md。
2. 检查外部运行输入能匹配目标项目。
3. 查看已有 fixtures、页面对象、API 客户端，避免重复封装。
4. 在项目 specs 中整理实际步骤与业务预期。
5. 写测试；创建数据后及时登记清理。
6. 运行新用例，再运行相关回归。
7. 对失败读取错误、截图与 Trace；保留真实业务失败，不通过改断言使其通过。

## 项目级 fixture 示例

```typescript
import { test as base } from '../../../shared/fixtures/base.fixture';
import { UsersPage } from '../pages/users.page';

export const test = base.extend<{ usersPage: UsersPage }>({
  usersPage: async ({ page }, use) => {
    await use(new UsersPage(page));
  },
});
export { expect } from '../../../shared/fixtures/base.fixture';
```

## 数据准备示例

```typescript
test('页面能搜索到创建的用户', async ({ api, page, cleanup }) => {
  const response = await api.post('users', { data: { name: uniqueName('user') } });
  expect(response.status()).toBe(201);
  const user = await response.json();
  cleanup.defer(`delete user ${user.id}`, async () => {
    const removed = await api.delete(`users/${user.id}`);
    expect([204, 404]).toContain(removed.status());
  });
  await page.goto('/users');
  await page.getByRole('textbox', { name: '搜索用户' }).fill(user.name);
  await expect(page.getByText(user.name, { exact: true })).toBeVisible();
});
```

导入 `uniqueName` 自 shared/data/unique。相同准备逻辑重复出现后，提取为项目 fixture，参考 demo 的 createItem。

公共 cleanup 用于 API 业务数据清理，显式依赖 API context，保证无论测试参数顺序如何，清理时 context 仍可用。若清理依赖浏览器或其他资源，应建立声明这些资源依赖的项目 fixture。写操作可能已成功而返回契约错误，优先在写之前按唯一业务键登记可收敛的清理。

## 断言与同步

- 接口状态码必须明确，业务字段使用 expect 或 expectJson + Zod 验证。
- 原生 APIResponse 可读取 headers/body/json；不要丢失错误响应细节。
- 页面使用原生 Locator；点击导致请求时，先设置 waitForResponse 再执行点击。
- 异步后台状态可使用 expect.poll；仅对读取/查询进行轮询，避免重复提交。
- 上传使用 locator.setInputFiles；下载使用 saveDownload，写入 testInfo.outputPath。

## 多身份

同一文件中用 test.describe + test.use({ identity: 'reader' }) 划分测试组。
若一个用例需要同时使用多身份，优先使用 apiSessions/browserSessions；输入 systems 描述附加系统。登录态仍必须由外部提供。具体 API、共享浏览器会话、清理顺序与报告边界见[多系统与多角色会话](sessions-and-systems.md)。手动创建原生 context 时，由调用方负责注入和释放。

多层 iframe 的业务区域使用 BaseView，避免重复写 frame 路径或让内嵌表单承担顶层导航。见[嵌入视图指南](frames-and-views.md)和[能力索引](capabilities.md)。

## 修改公共能力

```bash
npm run check
npm test -- -- --workers=2
npm run verify:failure
```

不要生成万能 SSO、自动刷新、业务 API 自动重试、自动吞错或自动跳过失败的逻辑。
