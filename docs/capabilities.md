# 能力索引与选用指南

项目统一输入、身份、作用域、生命周期与诊断约定。原生 Page/Locator/expect/APIResponse 和报告由 Playwright 提供。

| 需求 | 首选入口 | 说明/边界 |
| --- | --- | --- |
| 单身份 Web/API | 本项目 fixtures 的 page/api | 从目标 fixtures 导入 test/expect |
| 单流程多系统、多角色 | apiSessions / browserSessions | [会话指南](sessions-and-systems.md) |
| 顶层页面 | BasePage | 文档状态 + ready，复杂就绪覆盖 expectReady |
| 多层 iframe、嵌入区域 | BaseView + FrameLocator | [嵌入视图指南](frames-and-views.md) |
| 表单、基础列表操作 | Form/Table/Pagination/Modal/SingleSelect | Locator 契约，不绑定 UI 库，业务完成由目标断言 |
| DOM、属性、表单值、已渲染表格数据 | 原生 Locator 的读取/evaluate 方法 | [DOM 读取说明](dom-reading.md)，当前无通用全量采集器 |
| 点击、填写、勾选、键盘、滚动 | actions 或原生 Locator | hover/dblclick/dragTo 可直接用原生能力 |
| 请求/响应、popup、dialog、文件事件 | waits / files | 先监听后操作，不重放动作 |
| HTTP 请求 | ApiClient | GET/POST/PUT/PATCH/DELETE/HEAD/send，保留原生选项与响应 |
| JSON 契约 | expectJson | 状态码 + JSON 解析 + 异步 Zod，不是通用 JSON Schema 引擎 |
| 空响应、文本、headers、文件内容 | 原生 APIResponse + expect | 明确状态码与格式，不强迫解析 JSON |
| 后台异步状态 | expect.poll | 只轮询读取，不把写入放入自动重试块 |
| 唯一数据与依赖清理 | uniqueName + fixture + CleanupStack | 数据工厂属于项目，登记清理不等于清理已完成 |
| 报告与中断 | 原生报告 + 受管 CLI | [中断说明](interruption.md) |

## API 使用片段

以下使用 demo 的 echo 验证端点，真实端点由目标项目定义：

```typescript
const updated = await api.put('echo', { data: { value: 1 } });
expect(updated.status()).toBe(200);
expect(await updated.json()).toMatchObject({ method: 'PUT' });

const form = await api.post('echo', { form: { text: '中文 & value' } });
expect(form.status()).toBe(200);

const head = await api.head('echo');
expect(head.status()).toBe(200);
expect((await head.body()).length).toBe(0);
```

send('OPTIONS', ...) 支持没有快捷方法的 HTTP 动词。ApiClient 不跟随重定向，所有方法默认不重试。GET/HEAD/OPTIONS 可显式设置原生 maxRetries；其他方法拒绝非零 maxRetries。原生重试针对网络错误，不是 HTTP 401/403/5xx 业务重试。直接用 apiContext 时仍须遵守“不自动重试写入”的约定。

```typescript
// 业务组织示意：payload 和 jobs 端点由项目定义；创建前还应登记业务清理。
const created = await api.post('jobs', { data: payload });
expect(created.status()).toBe(202);
const { id } = await created.json();
await expect.poll(async () => {
  const response = await api.get(`jobs/${encodeURIComponent(id)}`);
  expect(response.status()).toBe(200);
  return (await response.json()).status;
}, { timeout: 30_000, message: '后台任务完成' }).toBe('completed');
```

## 当前范围

本地回归包含基础 API/Web、多角色、多系统、两层跨 origin iframe、状态生命周期与真实中断。计数和环境见[验证记录](validation.md)，不把静态类型检查或重复运行算成新增业务用例。

日期范围、多选、树、级联、远程搜索、虚拟滚动和复杂表格编辑仍需目标适配。数据库连接/事务、账号池、外部登录、MCP 客户端和报告平台不在当前公共实现中。先检查原生能力和实际重复场景，再决定是否新增公共函数。
