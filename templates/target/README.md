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
