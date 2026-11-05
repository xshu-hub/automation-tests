# 工程分层

| 层 | 职责 | 依赖 |
| --- | --- | --- |
| 外部 Agent/执行器 | 获取项目元数据、角色、登录态，交付输入 | 第三方工具；不属于本框架 |
| shared/input | 校验及读取外部 JSON、状态文件 | Zod、文件系统 |
| shared/auth | 浏览器状态注入 | Playwright |
| shared/fixtures | 独立浏览器/API 上下文、身份、清理 | 输入、注入、通用工具 |
| 项目 pages/api | 实际业务操作和请求 | 原生 Playwright、ApiClient |
| 项目 fixtures | 项目页面对象、数据工厂和清理 | 基础 fixtures、业务封装 |
| tests | 场景、步骤、断言 | 本项目 fixtures |
| scripts/run | 选择目标及分组，调用原生执行器 | Playwright CLI |

单仓库共用一份依赖锁文件。每个项目独立配置与业务代码。原生 Playwright projects 仅分 api/web；完整业务流程通过标签筛选。

运行输入由地址和状态共同组成，可切换环境而无需复制测试。报告以目标、环境、运行批次隔离。

目前只建立实际需要的层。跨项目业务流程出现时，可增加 integrations/<flow> 独立配置，复用各项目公开的页面/接口客户端；不通过导入其他项目的 spec 文件串联测试。
