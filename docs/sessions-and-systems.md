# 多系统与多角色会话

本文用于 Agent 编写跨系统 API/Web 流程。框架只读取外部状态，不申请账号、不登录、不刷新 Token。一个目标目录可以拥有一组跨系统流程；外部输入的 target 仍与这个目录一致。

## 概念与选择

| 概念 | 含义 |
| --- | --- |
| target | 执行所属的测试项目/流程集合，决定用例与报告目录 |
| system | 一组 Web/API 地址和该系统的具名身份；根输入是 default 系统 |
| identity | 外部已准备的账号/租户状态；角色名称不能替代实际身份 |
| session | 单条用例内的具名上下文；不同会话即使选择同一身份，也有独立客户端状态 |

单角色测试继续使用 page、api、cleanup。一个用例需要多个角色或系统时，使用 apiSessions 和 browserSessions。两者分别按需建立；仅请求 apiSessions 不启动 Chromium。

## 外部输入

旧的单系统 JSON 不需要修改。第二个系统放入 systems：

```json
{
  "target": "approval",
  "environment": "test",
  "webBaseURL": "https://portal.example.com",
  "apiBaseURL": "https://portal.example.com/api/",
  "defaultIdentity": "applicant",
  "identities": {
    "applicant": {
      "storageState": "./applicant.json",
      "api": { "headers": { "Authorization": "Bearer EXTERNAL_PORTAL_TOKEN" } }
    }
  },
  "systems": {
    "finance": {
      "webBaseURL": "https://finance.example.com",
      "apiBaseURL": "https://finance.example.com/api/",
      "defaultIdentity": "reviewer",
      "identities": {
        "reviewer": {
          "storageState": "./finance-reviewer.json",
          "sessionStorage": { "https://finance.example.com": { "tenant": "EXTERNAL_TENANT" } },
          "api": { "headers": { "Authorization": "Bearer EXTERNAL_FINANCE_TOKEN" } }
        }
      }
    }
  }
}
```

以上只有协议占位值。账号、页面和端点由目标项目提供。systems 的 key 使用小写字母、数字和连字符，最长 128 字符；default 保留给根系统。每个系统遵循相同身份协议，所有状态文件相对同一个输入 JSON 目录解析。系统或身份不存在、所选状态已过期时明确失败，不回退到其他系统的同名身份。anonymous 也必须选择实际存在的系统。

`--identity` / `test.use({ identity })` 只控制旧的默认 fixtures。具名会话以 create 的 identity 为准，省略时使用所选系统的 defaultIdentity，不受默认 fixture 身份覆盖影响。

## 可直接运行的本地示例

以下用例可放入 demo 的 tests/web。4173 和 4174 是独立的本地进程，使用公开假凭据。示例验证角色状态和多系统访问，不模拟真实审批规则或系统间自动同步。

```typescript
import { test, expect } from '../../fixtures';

test('同时核对两个系统的角色', async ({ apiSessions, browserSessions }) => {
  const applicant = await browserSessions.create('applicant', {
    system: 'default', identity: 'admin',
  });
  const reviewer = await browserSessions.create('reviewer', {
    system: 'secondary', identity: 'reader',
  });
  const financeApi = await apiSessions.create('finance-api', {
    system: 'secondary', identity: 'admin',
  });

  const applicantPage = await applicant.newPage();
  const reviewerPage = await reviewer.newPage();
  await applicant.step('核对提交方', async () => {
    await applicantPage.goto('/items');
    await expect(applicantPage.getByTestId('current-user')).toHaveText('admin');
  });
  await reviewerPage.goto('/items');
  await expect(reviewerPage.getByTestId('current-user')).toHaveText('reader');
  const response = await financeApi.api.get('me');
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ user: 'admin' });
});
```

把返回的原生 Page 传给目标页面对象，把 ApiClient 传给目标 API 对象即可组合业务。会话名使用字母、数字、下划线或连字符，最长 80 字符，不放凭据；同一个管理器内重复名称会拒绝，包括并发创建。保留返回对象复用，不使用全局“当前角色”，不自动切换页面。

## 生命周期与清理

| 清理入口 | 适用资源 | 保证 |
| --- | --- | --- |
| cleanup.defer | 默认 API，以及具名 API | 这些 API 上下文释放前执行；不保证浏览器仍打开 |
| apiSessions.cleanup.defer | 具名 API 业务数据 | 所有具名 API 上下文释放前执行 |
| browserSessions.cleanup.defer | 具名页面及具名 API 的联合清理 | 具名页面和具名 API 均仍可使用 |

同一栈内逆序清理，某项抛错后继续其余项，最后汇总错误；业务清理失败仍尝试释放全部受管上下文。浏览器会话 fixture 显式依赖 API 会话 fixture，因此先完成浏览器清理/关闭，再清理并释放具名 API。不要把依赖浏览器的操作放在 apiSessions.cleanup 中。

同一 CleanupStack 的并发 dispose 共用当前清理过程，防止子资源仍在清理时另一个调用先释放父资源。清理回调不能 await 自己所属栈的 dispose；正常使用仍交给 fixture 统一收尾。

写操作前按唯一业务键登记可收敛的清理。跨系统依赖按父对象、子对象的创建顺序登记，逆序删除。不能撤销的数据按项目协议处理，框架不猜测补偿操作。`targets/demo/tests/api/sessions.spec.ts` 提供跨系统创建和清理示例。

每次创建和操作必须 await，并发创建使用 await Promise.all。scope 会等待已开始的上下文创建再收尾，但不是后台任务调度器。不要启动脱离用例生命周期的操作。正常用例由 fixture 自动收尾，不要提前 dispose/close 后还让清理栈使用这些资源。清理自身一直不返回时，仍受 Playwright teardown 和启动器中断期限约束，并不保证剩余清理能执行。

## 共享浏览器会话与跨系统页面

同一用户从门户跳转子系统时，可以复用一个 BrowserSession。外部须在所选身份中一次提供所需各 origin 的 storageState/sessionStorage；框架不合并其他身份或重新登录。

```typescript
import { resolveSystem } from '../../../../shared/input/load';

// 在用例中，browserSessions 和 runtime 来自目标 fixtures：
const session = await browserSessions.create('portal', { identity: 'admin' });
const page = await session.newPage();
await page.goto(resolveSystem(runtime, 'secondary').webBaseURL);
```

相对导航基址仍是会话创建时系统的 Web 地址；跨系统导航使用绝对地址。同一会话的新独立页面调用 session.newPage()，在导航前一次性注入 sessionStorage。直接 context.newPage() 会绕过此步骤。有 opener 的 popup 按浏览器原生规则复制当时的 sessionStorage，不自动回灌初始值。

一个页面内的 iframe 属于同一 BrowserContext，不能单独指定另一个登录会话。同 origin 两个不同用户应使用不同会话。跨站 Cookie、存储分区和第三方嵌入限制遵循浏览器实际行为，不关闭安全机制来模拟通过。

## 配置与报告

- `apiSessions.create(name, { apiOptions })` 覆盖全局 use.apiOptions 的非身份选项，如 timeout/userAgent；地址、storageState、headers 最后由选定系统身份写入。httpCredentials/clientCertificates 被拒绝，不能绕过外部身份协议。
- `browserSessions.create(name, { contextOptions })` 可覆盖 viewport/locale 等。上下文沿用 Playwright 配置；地址和状态归输入所有，浏览器 headers、HTTP credentials、client certificates 清空，不继承默认会话凭据。当前身份协议不提供浏览器 HTTP Basic/client certificate 身份字段。
- BrowserSession 使用原生 browser fixture，复用 worker 的 Chromium，每个角色有独立 context。
- session.step 和具名 API 步骤识别参与者。HTML/JSON/JUnit、失败截图和 Trace 由 Playwright 生成；verify:failure 检查默认与具名页面均有失败截图，以及失败后具名资源仍可清理。
- 当前公共配置关闭视频；具名会话没有额外录像归档功能。不能假定仅打开 video 配置就会给手动创建的上下文归档录像。
- 服务端账号数据仍可能共享，外部应提供并行安全的账号与数据。客户端隔离不替代账号池。

## 多项目组织

项目页面/API 保持在对应 targets 目录。跨系统流程选择一个拥有者目标，例如 targets/order-flow，在 specs 中列出系统、角色、数据依赖和断言。流程可复用其他目标导出的页面/API 类，但不导入其他目标的 spec 或整套 fixture，不让 shared 依赖 targets。当前 CLI 仍只运行 targets/<id>，不需要新增执行引擎。
