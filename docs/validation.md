# 交付验证记录

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
