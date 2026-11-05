# demo 约定

先读根目录 AGENTS.md。本项目是随工程交付的本地验证示例，不代表真实项目。

- Web/API 服务在 127.0.0.1:4173，由 Playwright webServer 自动启动、关闭。
- examples/demo.input.json 模拟外部工具交付的登录态，所有 Cookie/Token 都是公开的假值。
- 身份：admin、reader、cookie-only、header-only；anonymous 由基础 fixture 提供。
- admin 可创建和删除事项；reader 只读；匿名请求返回 401。
- 页面事项与 API 数据共用本地内存存储，服务重启即清空。
- 数据创建使用 createItem fixture 或登记 cleanup；不要假设并行测试时列表为空。
- 不加入实际登录接口；示例验证的是外部状态注入。

```bash
npm test
npm test -- --suite api
npm test -- --suite web -- --grep @e2e
```
