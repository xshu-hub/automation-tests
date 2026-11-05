# 中断与回收

首次 SIGINT/SIGTERM 请求 Playwright 停止 worker、运行 fixture teardown 并完成报告。启动器分别返回 130/143；业务测试的退出码仍原样保留。默认清理期限 30000 毫秒，可用 `--shutdown-timeout` 调整。再次中断或超时会强制结束本次拥有的进程树。

```bash
node --import tsx scripts/run.ts --target demo --shutdown-timeout 30000
npm run verify:interrupt
```

## Windows 与外部执行器

Windows 的 Node `child.kill('SIGINT')`/`child.kill('SIGTERM')` 会强制终止目标，不能执行目标注册的信号处理器。现在 Playwright 位于隐藏的独立进程中，启动器通过 Node IPC 请求停止，子进程内部触发 Playwright 的原生 SIGINT 处理器。启动早期的请求会排队，直到处理器安装。

终端把 Ctrl+C 交给本启动器时走上述流程。外部 Node 执行器应直接启动 Node 入口，等待 `automation:ready` 后用 IPC 取消；不要依赖 npm、cmd 或任务管理器代转信号。

```typescript
import { spawn } from 'node:child_process';
const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/run.ts', '--target', 'demo'], {
  stdio: ['inherit', 'inherit', 'inherit', 'ipc'], windowsHide: true,
});
child.on('message', message => {
  // 收到 { type: 'automation:ready', lifecycleFile: ... } 后可发送取消请求。
});
// 需要取消时调用：
// child.send({ type: 'automation:interrupt', signal: 'SIGTERM' });
```

只有强制阶段调用系统 `taskkill.exe /PID <拥有的子进程> /T /F`，不按程序名称结束其他运行。Linux/POSIX 首次中断仍转发原生 SIGINT；受管子进程拥有独立进程组，强制阶段用 ps 枚举本次后代的进程组后结束它们，包括 Playwright 另起组的 browser 和 webServer。

## 数据与报告的边界

- 协作中断运行 fixture 清理，但清理本身仍可能失败。退出 130/143 不是业务清理成功的证明。
- 强制结束无法执行死进程中的 JavaScript、finally、fixture 或报告收尾。可能遗留业务数据，以及不完整的 JSON/HTML/JUnit/Trace。框架不会重放未知写请求或猜测删除数据。
- 外部直接结束启动器、系统崩溃、断电、不可响应的进程和操作系统拒绝终止，均无法保证优雅清理。
- 保留已经落盘的本次产物和其他 attempt，不自动删除外部提供的登录态输入。
- 启动器记录 `artifacts/_launcher/<target>/<run-id>/<attempt-id>/status.json`，打印其路径。它包含 PID、中断原因、forced、退出码及强制阶段错误，不替代原生报告。

## 专项验证

`npm run verify:interrupt` 包含六项真实进程验证：Node 子进程清理处理器、较晚安装处理器的 IPC 请求排队、真实 CLI 的 SIGINT、SIGTERM、清理超时和再次中断。POSIX CI 的 SIGTERM 场景实际发送原生信号。

正常中断断言独立 API 服务中的测试数据删除、原生报告明确为 interrupted，JSON/HTML/JUnit、截图和 Trace 保留。强制场景故意阻塞删除，断言该数据仍存在，再由验证器清理自己持有的内存数据；不会把验证器的应急清理算成被终止进程清理成功。两类场景都检查观测到的 launcher、runner、worker、webServer、后代及真实 Chromium 进程已退出，旧 attempt 和当前部分产物未被覆盖。只删除验证器创建的临时 target 和 runtime 输入，保留证据。

Windows 用系统 PowerShell/CIM 读取进程树，Linux 用 ps，无额外安装。本次在 Windows 11、Node 22.23.4、本机 Chrome 156（Chromium 引擎）实测；Linux/其他 Node 版本和 Playwright 配套 Chromium 由 CI 矩阵继续验证，本 Windows 环境没有执行该矩阵。

参考：[Node 子进程信号](https://nodejs.org/api/child_process.html#subprocesskillsignal)、[Playwright webServer 关闭约定](https://playwright.dev/docs/api/class-testconfig#test-config-web-server)。
