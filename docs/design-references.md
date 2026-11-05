# 开源参考与评审依据

本次由五个子代理分别评审 Web、API、输入与 fixtures、工程执行、验证覆盖。先阅读实际实现，再用定向探针验证问题；下列项目用于设计参考，工程继续使用原生 Playwright Test。

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
