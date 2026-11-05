# 交付验证记录

## 审查整改与推送前验证（2026-11-06）

本轮在 Windows 11、Node 22.23.4、npm 10.9.9、Playwright 1.64.1 与配套 Chromium 上完成。开始时本地/远端 main 均为 19c1aef；工作区包含前一轮尚未提交的多系统、具名会话与视图改动，纳入本轮复核与交付。

确认并修复的问题：

1. API 公共上下文选项可携带 HTTP Basic/client certificate，使身份来源超出外部输入协议；类型与运行时均拒绝这些选项。
2. 同源 URL 可内嵌用户名/密码；ApiClient 在发送前拒绝，错误不回显凭据。
3. storageState 的多个 origin 规范化后可重名；内联与外部状态文件均拒绝冲突。
4. CleanupStack 并发 dispose 可提前释放父资源；现在共享正在执行的清理过程，保持逆序依赖。
5. Table 遗漏 ARIA gridcell；增加语义定位支持。
6. Table.cell 的全局 nth 可掩盖重复行；改为各行内选择列，重复候选单元格保持严格匹配。

先新增回归用例复现失败，再修改实现。两条新增单元验证和三条新增 API/Web 用例覆盖以上行为；Table 用例同时验证 gridcell 与重复行。DOM 说明补充原生读取示例及能力边界，没有声称实现通用全量表格采集。

| 验证 | 结果 |
| --- | --- |
| npm ci | 成功；安全整改后重新安装锁定依赖 |
| TypeScript / ESLint / 单元验证 | 通过，47/47 单元；安全依赖调整后重新通过 |
| demo API + Chromium Web | 61/61，其中 API 33、Web 28 |
| 独立浏览器状态 | 5/5 |
| 故意失败、清理和原生报告 | 外层退出 0；内部保留 1 条预期失败、1 条清理检查通过 |
| 真实中断专项 | 6/6 |
| 无效 Chromium 路径下 API-only | 33/33，重复验证，不计新增用例 |
| 官方 npm registry 依赖审计 | 修复后 0 告警 |

依赖审计最初的 10 个中等级告警均追溯到 lint 工具链间接依赖 minimatch 10.2.6 的 [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)。上游修复版本为 11.0.1；通过 package.json override 与 lockfile 固定该版本，直接依赖未升级。覆盖超出了上游声明的主版本范围，因此实际运行了现有 lint/typecheck/单元验证，并交由仓库 Windows/Ubuntu × Node 矩阵进一步检查。上游依赖支持修复版本后复核移除 override。当前配置的 npm 镜像不实现审计 API，本次使用官方 registry 审计，未改全局 npm 配置。

本地证据均在被忽略的 artifacts 下：audit-check.log、audit-demo.log、audit-state.log、audit-failure.log、audit-interrupt.log、audit-api-only.log、audit-install.log、audit-dependencies.json。完整 demo 报告位于 `artifacts/demo/local/1793913210325-31265ed6-a092-4924-9096-54965d17a499/28df7a36-6223-4174-ad98-4f844bb7a353/`。

以上是本轮本地结果，远端 CI 以对应提交的 Actions 运行记录为准。真实业务接入、长期稳定性、复杂 UI 库适配及所有公开方法的专项运行覆盖仍未完成。

## 未发布：多系统、具名会话与嵌入视图（2026-11-06）

本次在 Windows 11 22631、Node 22.23.4、npm 10.9.9、Playwright Test 1.64.1 执行，使用 Playwright 安装的 Chromium 156.0.8078.4（revision 1248）。未触发远端 CI，以下是当前工作区的本地结果。

| 检查 | 结果 |
| --- | --- |
| npm ci | 成功，未升级依赖 |
| TypeScript / ESLint | 通过 |
| 单元验证 | 45/45，通过输入 schema 一致性、多系统身份隔离及资源释放等验证 |
| demo API + Chromium Web | 58/58，其中 API 31、Web 27 |
| 独立浏览器状态验证 | 5/5 |
| 故意失败、清理与原生报告验证 | 外层通过；内部仍为一条预期断言失败和一条清理检查通过 |
| 真实中断专项 | 6/6，正常与强制分支均通过 |
| 无效 Chromium 路径下的 API-only | 31/31，包含 apiSessions；这是重复验证，不增加用例数 |
| 运行输入 JSON Schema | 已重新导出并由单元测试比对；默认字段按输入语义保持可省略 |

多系统 demo 使用 4173/4174 两个独立本地进程。新增覆盖包括按系统选择角色、匿名与 API header 隔离、跨系统数据准备/清理、具名 API 真实 dispose、具名页面/context 真实关闭、共享浏览器会话跨 origin 导航、两层 iframe 的跨 origin/按需加载/重建/严格匹配，以及 PUT/PATCH/HEAD/OPTIONS/form 和写操作重试拒绝。

故意失败验证检查默认与具名页面均产生原生截图，具名页面清理时 API 仍可调用，原有业务数据清理证明及 HTML/JSON/JUnit/Trace 仍完整。另实际读取生成的 Trace ZIP，确认包含两个 origin 的页面记录和具名步骤；未把自定义日志称为 Trace 引擎。

本地证据（不提交 artifacts）：

- 完整 demo：`artifacts/demo/local/1793911744073-07351405-6920-4b3d-954d-6e1701a48a7e/8bfd9740-7dba-4ffc-a99a-cae44cd31e73/`
- API-only 复测：`artifacts/demo/local/1793911795386-90cf53bf-d610-4d9b-81c9-8d59ea997ff7/f0f72a3b-2c7e-480f-a428-06d56487931b/`
- 最终失败链路日志：`artifacts/final-failure-verification.log`
- 最终中断专项日志：`artifacts/final-interruption-verification.log`

仍未验证真实业务、真实第三方登录态、第三方跨站存储策略的全部组合、复杂 UI 库和长期稳定性。此次不同端口属于跨 origin，不等同于跨站第三方 Cookie 的全面验证。部分既有页面工具仍没有专项运行覆盖；不能声称所有公开方法均经过全面验证。旧版本 CI 通过不代表本轮未提交变更已在远端通过。

## v0.1.1 Windows 中断修复复验（2026-11-05）

独立环境：Windows 11 22631、Node 22.23.4、npm 10.9.9、Playwright Test 1.64.1，本机 Chrome 156.0.8078.80（Chromium 引擎）。没有安装浏览器或系统软件。

类型检查、ESLint、39 项单元验证、45 项 demo API/Web、5 项状态验证、预期失败链路及 6 项中断专项验证通过。专项检查实际 CLI、独立 API 数据服务、Chromium/worker/webServer/后代退出、完整/部分报告与历史 attempt 保留；强制场景明确断言被阻塞的业务清理没有完成，随后由验证器独立清理自己的数据。

受限 runner 的 tsx 启动会遇到 os.userInfo/uv_os_get_passwd 错误，上述 Node 测试在正常 Windows 环境执行，未修改依赖跳过检查。Playwright 配套 Chromium、Linux/Node 版本矩阵、真实业务及长期稳定性本次仍未实测。Linux 专项已加入 CI，不声称本次 Windows 环境执行了 Linux 验证。详情见 interruption.md。

以下为原 v0.1.0 的历史交付记录，保留其原验证边界。

## 验证环境

- Node.js 24.22.1，Linux。
- Playwright Test 1.64.1；TypeScript 6.0.3；依赖精确版本见 package-lock.json。
- 浏览器验证使用 Chromium Headless Shell 153.0.8010.0，通过 CHROMIUM_EXECUTABLE_PATH 显式指定。
- 当前环境的标准浏览器 CDN 下载返回无效压缩包，系统完整 Chromium 启动受 Unix socket 限制；Headless Shell 可实际运行。本工程仍默认使用 Playwright 标准 Chromium 安装，环境专用浏览器包未加入项目依赖。

## 已通过的检查

| 检查 | 结果 |
| --- | --- |
| TypeScript 类型检查 | 通过 |
| ESLint | 通过 |
| 基础验证：输入、清理、报告、CLI、输出隔离、模板 | 37/37 通过 |
| demo API | 23/23 通过 |
| demo Chromium Web 与组件 | 22/22 通过 |
| 独立 Chromium 状态生命周期 | 5/5 通过 |
| 新项目模板生成、注入运行输入、API + Web | 2/2 通过 |
| 已存在项目防覆盖 | 正确拒绝 |
| 目标 ID 与输入不匹配 | 正确拒绝 |
| API 不启动浏览器 | 使用无效浏览器路径执行 13 条 API 用例，全部通过 |
| 故意失败链路 | 失败退出码、截图、Trace、HTML/JUnit 全部存在 |
| 故意失败后数据清理 | 后续用例确认无残留事项 |
| 错误身份的负向失败验证 | reader 返回403时，验证器明确拒绝假通过 |
| 源码压缩包解压后重新安装 | npm ci --offline 成功 |
| 新版压缩包解压后验证 | npm ci --offline、类型检查、ESLint、37 条基础验证全部通过 |

故意失败验证包含两条用例：一条按设计失败，一条检查清理结果。外层 `npm run verify:failure` 验证预期行为后返回 0。

本轮验证器还读取逐用例 JSON 及创建/删除证明文件，要求失败确实来自 EXPECTED_FAILURE_PROBE，而非任意失败。`FAILURE_PROBE_IDENTITY=reader` 用于负向验证，必须因错误的403前置失败被拒绝。

## 本轮环境问题与修正

Chromium 153.0.8010.0 与当前 Playwright 组合中，最小独立探针发现：带 no-store 的 POST 响应如果页面不消费 body，原生 waitForResponse 之后读取 body 可能缺少 requestfinished 并挂起。对照排除了本工程事件工具和 sessionStorage bootstrap；页面消费返回 JSON 或去掉 no-store 时正常。此结论只针对实际验证环境。

本地 demo 创建操作现消费并校验201返回的事项后刷新列表；页面对象仍检查201、完整schema、DOM展示，E2E仍验证后端创建与删除404。未给框架添加请求重放、吞错或额外延迟。

## 验证边界

测试覆盖随工程提供的本地示例及外部输入协议，尚未接入用户真实项目、真实第三方登录态和实际业务接口。Windows 执行未在本环境实机验证；CI 已配置 Windows/Linux 与 Node22.13/24 矩阵，需在实际仓库运行后取得远端结果。

源码包不包含 node_modules、浏览器二进制、测试运行产物或实际凭据。使用前按 README 安装依赖与 Chromium。
