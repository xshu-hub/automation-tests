# 事项管理验证计划

| 场景 | 操作与预期 |
| --- | --- |
| 外部状态注入 | 页面识别 Cookie 用户、localStorage 身份、sessionStorage 租户 |
| API 身份 | 请求头与 Cookie 分别可鉴权，401/403 原样保留 |
| 身份隔离 | admin / reader / anonymous 使用独立上下文 |
| API 数据生命周期 | 创建事项、查询一致、删除后返回 404；echo 单独验证 PUT/PATCH/HEAD/form |
| 非法参数 | 空名称与空白名称均返回 400 |
| 数据准备 | API 创建事项，页面可见；测试后清理 |
| 完整流程 | 页面创建事项，API 核对，再删除 |
| 文件 | API multipart、页面上传、API CSV、页面下载 |
| 失败可诊断 | 原生 Trace、截图、HTML、JUnit 与非零退出码 |
| 失败后清理 | 断言失败后仍运行 fixture 清理，下一条用例不见遗留数据 |
| 多系统与角色 | 独立服务、独立 API origin、各系统身份、匿名会话、浏览器/API headers 隔离 |
| 会话生命周期 | 清理时页面及具名 API 仍可用；失败后默认和具名页面均生成原生截图 |
| 多层 iframe | 内层跨 origin、点击后加载、重建后重用定位、同名元素隔离、重复 frame 报错 |
| API 凭据边界 | 同源请求 URL 不能内嵌用户名/密码；公共 apiOptions 不能传入 Basic/mTLS 身份 |
| 表格严格定位 | HTML cell 与 ARIA gridcell 均可定位；重复行的同列单元格仍报严格匹配错误 |
