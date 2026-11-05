# 未发布

增加兼容旧输入的 systems、多角色 apiSessions/browserSessions 与 BaseView。具名资源按 fixture 依赖先完成业务清理，再释放上下文；保持 API-only 不启动 Chromium。增加双服务、多角色及跨 origin 嵌套 iframe demo 和使用说明，补充 PUT/PATCH/HEAD/form 运行验证。ApiClient 对写操作拒绝非零 maxRetries。原生报告与外部登录态职责边界保持不变。

运行输入 JSON Schema 改为按输入语义导出，defaultIdentity、metadata 和 systems 等带默认值的字段保持可省略；单元验证检查导出文件与代码一致。

审查整改：API 上下文拒绝公共选项中的 Basic/mTLS 凭据，ApiClient 拒绝 URL 内嵌凭据；storageState 拒绝规范化后重复的 origin；CleanupStack 并发收尾保持依赖顺序；Table 支持 ARIA gridcell 并修复按列选择时掩盖重复行的问题。补充 DOM 数据读取与能力边界说明。

为 lint 工具链的间接依赖增加 minimatch 11.0.1 override，修复 GHSA-g3hv-75wg-m249；直接依赖版本不变。上游支持修复版本后应复核并移除此兼容 override。

CI 的 checkout/setup-node 更新为使用 Node 24 Action 运行时的 v5；测试矩阵仍为 Windows/Ubuntu × Node 22.13.0/24。

# 0.1.1

修复 Windows 启动器用 child.kill('SIGINT') 强制结束 Playwright、跳过 teardown 的问题。首次中断改用本地 IPC 请求清理，重复中断或超时才回收本次拥有的进程树。Linux 保留原生 SIGINT，并隔离和枚举拥有的进程组以供强制回收。

新增清理期限选项、外部执行器 IPC 取消入口、持久化启动器状态，以及六项真实进程/CLI/Chromium/数据/报告专项验证。原始 v0.1.0 ZIP 保留。

强制结束不能保证业务清理及报告收尾，详见 docs/interruption.md。
