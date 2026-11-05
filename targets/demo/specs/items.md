# 事项管理验证计划

| 场景 | 操作与预期 |
| --- | --- |
| 外部状态注入 | 页面识别 Cookie 用户、localStorage 身份、sessionStorage 租户 |
| API 身份 | 请求头与 Cookie 分别可鉴权，401/403 原样保留 |
| 身份隔离 | admin / reader / anonymous 使用独立上下文 |
| API CRUD | 创建事项、查询一致、删除后返回 404 |
| 非法参数 | 空名称与空白名称均返回 400 |
| 数据准备 | API 创建事项，页面可见；测试后清理 |
| 完整流程 | 页面创建事项，API 核对，再删除 |
| 文件 | API multipart、页面上传、API CSV、页面下载 |
| 失败可诊断 | 原生 Trace、截图、HTML、JUnit 与非零退出码 |
| 失败后清理 | 断言失败后仍运行 fixture 清理，下一条用例不见遗留数据 |
