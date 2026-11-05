# 自动化测试脚本框架：Agent 工作约定

## 范围

- TypeScript + 原生 Playwright Test。API 和 Web；浏览器只使用 Chromium。
- 项目信息、环境、角色和登录态由外部 Agent/执行器准备，参见 docs/input-contract.md。
- 本仓库不实现 MCP 客户端、项目发现、账号申请、SSO 登录、鉴权服务、Token 获取或刷新。
- 外部工具返回值由调用方转换为统一 JSON；框架只读取、注入、运行和报告。

## 先读什么

1. 本文件。
2. 目标项目 targets/<id>/AGENTS.md 与 specs 中相关计划。
3. 项目 fixtures、页面对象、API 客户端和已有相邻用例。
4. 接口不确定时查 Playwright 官方文档 https://playwright.dev/docs/intro。

## 编写约定

- 测试从目标项目 fixtures 导入 test / expect。
- API 用例放 tests/api，页面功能和完整业务流程放 tests/web。
- @smoke 表示冒烟；@e2e 表示完整业务流程；它们可以同时使用。
- 优先使用 getByRole / getByLabel / getByTestId，必要时使用稳定的业务选择器。
- 断言放在用例或清晰命名的业务校验中。禁止删断言、改预期、随意 skip 来消除失败。
- 使用 Playwright 自动等待及 expect；不使用固定 sleep 或 networkidle 等待业务完成。
- 页面操作和 API 封装只提取实际重复的能力，原生 Page/APIRequestContext 可直接使用。
- 页面继承 BasePage 时必须定义 ready Locator，必要时覆盖 expectReady；通用操作/事件/组件先复用 shared/web 与 shared/components。
- 单用例多角色/跨系统优先使用 apiSessions/browserSessions；输入 systems 显式绑定系统身份，API-only 不请求 browserSessions。清理顺序见 docs/sessions-and-systems.md。
- 内嵌业务区域使用 BaseView + 原生 FrameLocator，明确每层作用域；不缓存易失效的 Frame/ElementHandle，不自动选第一个匹配 frame。
- 唯一数据使用 shared/data/unique；依赖数据使用 fixture。创建后及时登记 cleanup。
- 不自动重试写操作，不对 401/403 静默刷新登录态。
- 不记录外部 Token/Cookie，不把运行输入或认证状态提交到代码库。
- 不默认开启浏览器请求头注入；API headers 只传给独立 API 上下文。
- 每次任务聚焦一个目标项目。公共能力变更后运行相关公共验证和 demo 回归。

## 命令

```bash
npm ci
npm run install:browser
npm run check
npm run verify:interrupt
npm test -- --target demo --suite api
npm test -- --target demo --suite web -- --workers=2
npm test -- --target <id> --input .runtime/<id>.json --suite web -- --grep @smoke
npm run target:new -- <id>
```

原生 Playwright 参数放在额外的 `--` 后。失败时先看错误、截图和 Trace，再修改实现；不盲目增加超时。

中断先等待 fixture 清理和报告；默认 30 秒，`--shutdown-timeout` 可调整。再次中断或超时会强制回收本次创建的进程树，不能保证业务清理或完整报告。自动化控制 Windows 运行时，使用 Node IPC 取消协议，见 docs/interruption.md；不要把 child.kill('SIGINT') 当成优雅信号。

## 层次

- shared：公共配置、输入协议、注入、API 基础能力和数据工具；不依赖 targets。
- targets：各项目页面、接口、fixtures、业务用例和测试计划。
- templates：新项目最小模板；新增项目不复制 demo 的业务。
- scripts：创建目标与启动测试的薄入口；不调用外部服务。
- verification：框架自身验证，不属于真实业务测试。
- artifacts：按项目/环境/运行批次/独立执行生成，被 Git 忽略。
