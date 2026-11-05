# 多项目 API / Web 自动化测试底座

TypeScript + Playwright Test，浏览器固定 Chromium。供 Agent 编写、执行、调试并维护测试脚本。

**外部提供项目配置和登录态；框架负责注入、数据 fixtures、执行、断言与报告。** 无 MCP、SSO 或 Token 获取/刷新逻辑。

## 快速运行

需要 Node.js 22.13+（22.x）或 Node.js 24+ 与 npm。工程使用跨平台命令，CI 配置包含 Windows、Linux：

```bash
npm ci
npm run install:browser
npm test
```

Linux 若缺少浏览器系统依赖，先执行 `npx playwright install-deps chromium`。

默认执行本地 demo：自动启动两个独立的本地事项管理服务，读取随附的假登录态，运行 API 与 Chromium 用例，然后关闭服务。端口 4173、4174 在执行前应为空闲状态。第二个服务验证多系统及跨 origin iframe；示例没有真实外部服务依赖。

```bash
npm run test:api
npm run test:web
npm test -- --suite web -- --grep @e2e
npm test -- --suite web -- --headed --workers=2
npm test -- --help
```

额外 Playwright 参数位于第二个 `--` 后；业务测试失败会原样返回非零退出码。

## 已封装的基础能力

| 能力 | 实现位置 |
| --- | --- |
| 多目标、API/Web 分组、统一 Chromium 配置 | shared/config/define-target.ts |
| 外部运行输入及边界校验 | shared/input/ |
| Cookie、localStorage、额外原生状态字段 | storageState fixture |
| 按 origin 注入 sessionStorage | shared/auth/browser-state.ts |
| API 独立 Cookie、Authorization 等请求头 | apiContext fixture |
| 身份切换、匿名上下文 | identity option / authState fixture |
| 单用例多系统、多角色与资源收尾 | apiSessions / browserSessions，shared/sessions/ |
| 多层 iframe 与嵌入业务视图 | shared/web/base-view.ts，原生 FrameLocator |
| HTTP 方法、params、JSON、form、multipart、二进制 | shared/api/client.ts，保留原生请求选项 |
| 状态码 + JSON/Zod 契约校验 | shared/api/assertions.ts |
| 逆序清理、失败后继续清理 | shared/data/cleanup.ts |
| 唯一数据名 | shared/data/unique.ts |
| 页面就绪、导航状态、操作、事件同步、文件、存储和截图 | shared/web/ |
| Form、Table、Pagination、Modal、SingleSelect 组合组件 | shared/components/ |
| 页面对象、接口客户端、业务数据工厂 | targets/demo/ |
| HTML、JUnit、JSON、失败截图、失败 Trace | 公共配置 |
| 新项目模板与命令 | templates/target、scripts/create-target.ts |

API 用例只使用 api/apiContext/apiSessions 时不会启动 Chromium。浏览器与 API 使用独立上下文；API 请求头不注入浏览器。用例可直接使用 Playwright 原生能力，不需要层层包装。

先从[能力索引](docs/capabilities.md)选择入口；多角色与跨系统流程见[会话指南](docs/sessions-and-systems.md)，复杂嵌入页面见[多层 iframe 与视图](docs/frames-and-views.md)。旧的单系统输入和 fixtures 用法保持兼容。

读取表格、表单值和局部 HTML 见 [DOM 数据读取](docs/dom-reading.md)。当前使用原生 Locator/evaluate，未实现虚拟列表的通用全量采集器。

## 目录

| 路径 | 用途 |
| --- | --- |
| AGENTS.md | Agent 全局开发规范 |
| shared/ | 配置、输入协议、状态注入、通用工具与基础 fixtures |
| targets/<id>/ | 被测项目独立配置、业务封装与用例 |
| templates/target/ | 创建新项目的最小模板 |
| scripts/ | 执行、新项目创建、schema 导出及本地 demo 服务 |
| examples/ | 只含假值的演示输入 |
| docs/ | 接入协议、开发指南、架构说明 |
| verification/ | 框架自身的单元与失败链路验证 |
| artifacts/<target>/<environment>/<run-id>/<attempt-id>/ | 每次执行独立的报告与调试产物 |
| .runtime/ | 建议的外部运行输入目录，被 Git 忽略 |

各项目内部使用 tests/api、tests/web、pages、api、fixtures、test-data、specs。完整业务流程保留在 tests/web，用 @e2e 标签筛选。

## 接入真实项目

```bash
npm run target:new -- crm
```

然后由外部 Agent/执行器通过其自身工具获取项目地址、身份和登录态，转换成 [外部输入协议](docs/input-contract.md)，写入 `.runtime/crm.json`。框架不关心信息从哪里获得。

```bash
npm test -- --target crm --input .runtime/crm.json --suite api
npm test -- --target crm --input .runtime/crm.json --suite web -- --grep @smoke
```

生成器不会覆盖已有项目，也不假定真实业务的健康检查、登录接口或页面选择器。Agent 根据实际项目补充 fixtures 和业务用例。

只使用 API 的项目可保留空的 tests/web；只使用 Web 的项目可保留空的 tests/api，并通过 --suite 选择实际存在的测试。

## 编写用例

```typescript
import { test, expect } from '../../fixtures';

test('普通用户查看本人资料', { tag: '@smoke' }, async ({ api }) => {
  const response = await api.get('users/me');
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ active: true });
});
```

更多示例见 [Agent 开发指南](docs/agent-guide.md)、[页面与组件封装](docs/web-foundation.md)。设计取舍见 [开源参考与评审依据](docs/design-references.md)，真实可运行的页面、数据工厂与 API 测试见 targets/demo。

## 验证与调试

```bash
npm run check
npm test -- -- --workers=2
npm run verify:failure
npm run verify:state
npm run verify:interrupt
```

`check` 执行类型检查、ESLint、输入/清理/报告语义、CLI 与模板等单元验证。`verify:failure` 故意制造一条断言失败，精确检查预期失败原因、真实创建/清理证明、截图、Trace、报告和非零退出码；外层验证命令通过时退出 0。其输出中的一条失败是预期结果。`verify:state` 用真实 Chromium 验证 sessionStorage 生命周期、分区 Cookie、IndexedDB 等。

`verify:interrupt` 验证实际 CLI、真实子进程和 Playwright 的中断回收，包括首次中断、第二次中断、清理超时、测试数据与完整/部分报告保留。详见 [中断与回收约定](docs/interruption.md)。

报告位置由 Playwright 在执行后输出，也可按 artifacts 中本次运行路径打开：

```bash
npx playwright show-report artifacts/<target>/<environment>/<run-id>/<attempt-id>/report
npx playwright show-trace artifacts/<target>/<environment>/<run-id>/<attempt-id>/results/<test>/trace.zip
```

需要使用已经安装的 Chromium 时，可显式设置 `CHROMIUM_EXECUTABLE_PATH` 为其可执行文件路径。默认使用 Playwright 下载的 Chromium。

PowerShell 示例：

```powershell
$env:CHROMIUM_EXECUTABLE_PATH = 'C:\path\to\chromium\chrome.exe'
npm test
```

默认 2 个 worker，不重试测试、不自动刷新状态、不忽略 HTTPS 错误。若需修改原生 Playwright 选项，可在目标配置基于 defineTarget 返回值进行扩展。

API 上下文选项可在配置 `use.apiOptions` 或用例 `test.use({ apiOptions: ... })` 设置，例如 timeout、proxy、userAgent。目标地址、Cookie 和请求头始终由外部运行输入提供，避免与角色状态混用。ApiClient 固定不跟随重定向；特殊重定向测试可显式使用原生 apiContext。

## 当前接入范围

本工程以本地 demo 验证基础能力，尚未接入你的真实项目或第三方登录态样本。接入时主要工作是外部输入映射、项目页面/接口封装与业务用例。
