# 0.1.1

修复 Windows 启动器用 child.kill('SIGINT') 强制结束 Playwright、跳过 teardown 的问题。首次中断改用本地 IPC 请求清理，重复中断或超时才回收本次拥有的进程树。Linux 保留原生 SIGINT，并隔离和枚举拥有的进程组以供强制回收。

新增清理期限选项、外部执行器 IPC 取消入口、持久化启动器状态，以及六项真实进程/CLI/Chromium/数据/报告专项验证。原始 v0.1.0 ZIP 保留。

强制结束不能保证业务清理及报告收尾，详见 docs/interruption.md。
