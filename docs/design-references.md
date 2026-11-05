# 开源参考与评审依据

初始交付曾由五个子代理分别评审 Web、API、输入与 fixtures、工程执行、验证覆盖。下方保留当时的参考记录；本轮扩展另列在后文。工程继续使用原生 Playwright Test。

## 实际参考的项目

| 项目 / 一手来源 | 参考内容 | 本工程采用方式 |
| --- | --- | --- |
| [Playwright POM](https://playwright.dev/docs/pom) | 业务页面对象集中定位与业务操作，保留原生 Page / Locator | 页面就绪契约、原生 Locator 与项目页面对象 |
| [Playwright fixtures](https://playwright.dev/docs/test-fixtures#execution-order) | 按显式依赖建立和释放资源 | API 清理明确依赖 API context，避免参数顺序改变生命周期 |
| [Playwright events](https://playwright.dev/docs/events) | 触发操作前监听响应、下载、popup 等事件 | 封装操作与事件同步，失败后回收监听器 |
| [CodeceptJS Playwright helper](https://github.com/codeceptjs/CodeceptJS/blob/744dba8487487e78a6d561e6045039f88d91d050/lib/helper/Playwright.js) | 页面动作分组、作用域定位、窗口与文件处理 | actions / waits / files 等组合能力，等待继续使用 Playwright 原生机制 |
| [CodeceptJS REST](https://github.com/codeceptjs/CodeceptJS/blob/4.x/lib/helper/REST.js) 与 [JSONResponse](https://github.com/codeceptjs/CodeceptJS/blob/4.x/lib/helper/JSONResponse.js) | 请求发送与响应校验分别组织，覆盖 HTTP 方法与数据契约 | 类型完整的 ApiClient、原生 APIResponse、独立 expectJson |
| [Serenity/JS PageElement](https://github.com/serenity-js/serenity-js/blob/a28a2424c5bb2bf262695fa6740a2002a6b294f0/packages/playwright/src/screenplay/models/PlaywrightPageElement.ts) 与 [组件组合说明](https://serenity-js.org/handbook/web-testing/page-element-query-language/) | 在父元素作用域内组合子元素，业务动作可复用 | 组件接收显式 Locator 根及浮层定位，供不同项目组合 |
| [SeleniumBase BaseCase](https://github.com/seleniumbase/SeleniumBase/blob/master/seleniumbase/fixtures/base_case.py) | 导航、输入、窗口、文件与诊断等基础能力覆盖 | 参考能力分类；实现使用当前 Playwright，不复制 Selenium 兼容分支 |

## 评审复现的主要问题

- API optional options 直接 Omit 导致类型退化，拼错参数也能通过编译。
- cleanup 不依赖 API context，参数顺序变化时先关闭 context 后清理。
- 持久 addInitScript 在刷新、注销、iframe 初始化时重新写 sessionStorage。
- Cookie schema 丢弃原生 partitionKey；身份状态对象被不同测试共享引用。
- 输入 origin 与浏览器规范 origin 不一致时静默不注入。
- 写入成功但响应契约错误时，数据清理尚未登记。
- 只检查聚合结果的失败验证可能接受错误原因的失败。
- 外部 run ID 未校验，产物目录可能越界；并发运行共用目录。
- launcher 使用 child.killed 判断退出，后续中断可能被吞掉。
- 页面导航未检查文档状态与业务就绪；删除只检查 DOM，可能被 cleanup 掩盖。

各项修复与定向回归在源码及验证记录中对应。完整业务结果仍由项目用例显式断言，框架不推断业务成功，不获取或刷新登录态。

## 2026-11-06：多系统、具名会话与嵌入视图

本轮查阅一手文档并核对已安装 Playwright 1.64.1 的上下文/报告集成行为，没有引入新的测试执行器或复制第三方实现。

| 来源 | 采用的设计 | 本工程取舍 |
| --- | --- | --- |
| [Playwright 多角色](https://playwright.dev/docs/auth#multiple-signed-in-roles)与[单用例多 context](https://playwright.dev/docs/browser-contexts#multiple-contexts-in-a-single-test) | 角色状态隔离、原生上下文 | 外部提供状态，具名会话管理资源；不采用示例中的登录步骤 |
| [Playwright fixture 顺序](https://playwright.dev/docs/test-fixtures#execution-order) | 显式依赖决定 teardown 顺序 | 浏览器会话依赖 API 会话，业务清理先于释放 |
| [Serenity/JS 多参与者](https://serenity-js.org/handbook/test-runners/playwright-test/multi-actor-scenarios/) | 场景中参与者有明确名字和能力 | 采用具名会话；不引入 Actor DSL；不同 create 默认独立 context，共享时显式复用返回对象 |
| [Serenity/JS 组件作用域](https://serenity-js.org/handbook/web-testing/page-element-query-language/) | 在明确的父级区域组合子元素 | BaseView 直接组合原生 Locator/FrameLocator，不重建定位语言 |
| [Playwright FrameLocator](https://playwright.dev/docs/api/class-framelocator) | frame 链式定位和严格匹配 | 按定位路径重查嵌入区域；两层跨 origin、动态重建和重复 frame 有运行验证 |

本地验证使用自有 demo 两个独立服务，不冒充真实审批/跨系统同步。跨系统身份由输入显式绑定，每个 API 客户端保留自己的 origin 约束。截图、Trace 与报告仍归原生 Playwright。
