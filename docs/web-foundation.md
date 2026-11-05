# 页面基础能力与组件

页面基类统一导航与页面就绪，其他能力通过组合暴露。实现参考 CodeceptJS 的能力分组和 Serenity/JS 的父子组件作用域，继续使用原生 Playwright Locator 和等待。

## BasePage

```typescript
import { BasePage } from '../../../shared/web/base-page';

export class UsersPage extends BasePage {
  readonly path = 'users';
  protected readonly ready = this.page.getByRole('heading', { name: '用户管理', exact: true });
}
```

`open()` 返回原生文档 Response，默认接受 2xx，再检查 ready 可见；如应用还需等待数据或 hydration，可覆盖 `expectReady()` 并调用父实现。错误文档可以显式提供 `expectedStatus`，或使用原生 page.goto。

| 入口 | 能力 |
| --- | --- |
| `open({ query, expectedStatus, timeout })` | 查询参数、文档状态、就绪检查，保留 Response |
| `reload()` | 刷新并检查当前页面就绪 |
| `back()` / `forward()` | 历史导航；目标可能是其他页面，由调用方检查目标就绪 |
| `frame(locatorOrSelector)` | iframe 内部定位，返回 FrameLocator |
| `step(name, action)` | 业务步骤报告 |
| `screenshot(name, options)` | PNG 截图并附加到当前用例报告，返回 Buffer |
| `page` | 保留原生 Page |

路径遵循标准 URL 规则：webBaseURL 为 `https://host/app/` 时，`path='users'` 打开 `/app/users`，`path='/users'` 打开 origin 根路径 `/users`。保持项目路由约定一致。

## 组合能力

| 对象 | 方法 |
| --- | --- |
| `actions` | click、fill、check、select、press、key、scroll、popup、dialog |
| `waits` | response、request、popup、download、fileChooser、dialog |
| `files` | input、chooser、download |
| `storage` | get、set、remove、clear、entries；显式选择 local/session |

元素操作接收 Locator，保留原生 actionability、strictness 和选项，不猜测选择器，不自动取第一个匹配项。

操作与事件同步的例子：

```typescript
const response = await usersPage.waits.response(
  () => usersPage.actions.click(saveButton),
  response => {
    const url = new URL(response.url());
    return url.origin === expectedOrigin && url.pathname === '/api/users'
      && response.request().method() === 'POST';
  },
  { timeout: 10_000 },
);
expect(response.status()).toBe(201);
```

监听在操作前建立；成功、超时、操作失败或页面关闭后会移除监听器和定时器。响应到达仅代表网络事件已发生，业务结果仍由页面/用例明确验证。并发同端点请求应再按业务标识匹配。

文件示例：

```typescript
await usersPage.files.input(uploadInput, './fixtures/sample.csv');
await usersPage.files.chooser(() => chooseButton.click(), './fixtures/sample.csv');
const download = await usersPage.files.download(
  () => exportButton.click(), testInfo.outputPath('users.csv'),
);
expect(download.suggestedFilename()).toMatch(/\.csv$/);
```

popup 返回原生 Page，调用方负责目标页面就绪。JS alert/confirm/prompt 用 `actions.dialog` 显式 accept/dismiss；DOM 模态框用下述 Modal。

## Locator 组件

| 组件 | 作用与边界 |
| --- | --- |
| `Form` | 在表单根内按 label 填写、勾选、原生 select 与提交；提交后业务结果由用例检查 |
| `Table` | 语义 table 内按单元格找行、按列下标取 cell；保持重复匹配报错 |
| `Pagination` | 显式注入 previous/next/current，点击后等待页码实际变化 |
| `Modal` | 显式注入 dialog 根和关闭按钮，检查打开与关闭 |
| `SingleSelect` | 显式注入 trigger 与 listbox，支持被挂到 body 的 portal 浮层 |

这些组件定义语义/定位契约，不内置 Element Plus、Ant Design 等库的 CSS。不同 UI 库在各项目组件中适配 Locator，页面组合需要的组件。可运行的完整组合见 `targets/demo/pages/playground.page.ts`。

## 外部 sessionStorage 的一次性注入

默认 page fixture 在应用导航前，为各 origin 访问由精确路由拦截并返回空 HTML 的临时 bootstrap URL，写入外部 sessionStorage，然后回到 about:blank。此过程不向真实应用发送请求，之后移除路由。

状态在实际页面中按浏览器原生生命周期变化，刷新、iframe、应用轮换和 clear 都不会触发旧值回灌。对于额外的独立新页面：

```typescript
const another = await context.newPage();
await injectSessionStorage(another, externalState.sessionStorage);
await another.goto(targetURL);
```

helper 必须用于 fresh about:blank 页面。有 opener 的同源 popup 按浏览器原生语义复制当前 sessionStorage；noopener 或独立页面不自动获取状态，调用方需显式准备。Cookie/localStorage 等仍在 context 创建时通过 storageState 注入。
