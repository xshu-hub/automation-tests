# __TARGET_ID__

由外部 Agent/执行器准备运行输入和登录态，框架只接收与注入。

1. 查看根目录 `docs/input-contract.md`，在被忽略的 `.runtime/` 中准备输入文件。
2. 在本目录 `AGENTS.md` 中填写业务说明、身份标识与必要的操作约定。
3. 在 `fixtures/index.ts` 扩展页面对象、接口客户端、数据工厂。
4. 在 `tests/api/`、`tests/web/` 增加实际业务用例；本模板没有假定业务端点。

```bash
npm test -- --target __TARGET_ID__ --input .runtime/__TARGET_ID__.json --suite api
npm test -- --target __TARGET_ID__ --input .runtime/__TARGET_ID__.json --suite web -- --grep @smoke
```

相对输入路径按终端当前目录解析；输入内的 storageState 文件路径按输入文件所在目录解析。

## 多系统、多角色与复杂页面

- 单系统使用 runtime.input.example.json；多系统参考 runtime.multi-system.input.example.json。它们只提供协议占位值，不是实际登录态。
- 单用例多角色使用 apiSessions/browserSessions；见根目录 docs/sessions-and-systems.md。API-only 只请求 apiSessions。
- 顶层页面继承 BasePage；iframe 或内嵌区域组合 BaseView，见 docs/frames-and-views.md。
- 能力与原生入口索引见 docs/capabilities.md。实际页面、API、清理规则和业务预期由本目标实现。
- 跨系统流程可由本目标统一拥有，复用其他项目的页面/API 类，不导入其他项目 spec/fixture。
