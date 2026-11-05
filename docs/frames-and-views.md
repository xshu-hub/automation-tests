# 多层 iframe 与嵌入视图

顶层页面使用 BasePage，内嵌业务区域使用 BaseView。二者保留原生 Page/Locator；BaseView 不导航、不创建浏览器、不选择身份。

## 逐层作用域

```typescript
import { BaseView } from '../../../shared/web/base-view';
import { Form } from '../../../shared/components/form';

export class ApprovalView extends BaseView {
  protected readonly ready = this.root.getByRole('heading', { name: '审批表单', exact: true });
  readonly form = new Form(this.root.getByRole('form', { name: '审批表单', exact: true }));

  async submit(opinion: string): Promise<void> {
    await this.expectReady();
    await this.form.fill({ 审批意见: opinion });
    await this.form.submit('提交');
  }
}
```

```typescript
// 在目标用例或页面 fixture 中：
const workspace = page.getByTitle('业务工作区', { exact: true }).contentFrame();
const content = workspace.getByTitle('审批内容', { exact: true }).contentFrame();
const view = new ApprovalView(page, content);
await view.submit('同意');
await expect(content.getByRole('status')).toHaveText('同意');
```

root 可以是原生 Page、FrameLocator 或业务容器 Locator。`view.frame('iframe[data-testid="editor"]')` 从当前 root 继续进入下一层；传入明确的 iframe Locator 时保留其作用域。层数不写死，优先使用 title/testId 等稳定标识，不按 iframe 顺序选择，不遍历后点击第一个同名按钮。

BaseView 保存定位逻辑，不缓存 Frame/ElementHandle。iframe 被替换后原路径可以重新解析，但新结构必须继续满足定位契约。本地验证覆盖两层嵌入、内层跨 origin、点击后加载、frame 重建、同名元素隔离及重复 frame 报错；不代表所有实际门户/组件库都已验证。

## 就绪与业务完成

expectReady 默认只检查 ready 可见。复杂页面覆盖它，等待 loading 隐藏或关键控件可用。iframe 出现、文档加载、业务数据就绪是不同条件，不用固定 sleep/networkidle 推断完成。

```typescript
async expectReady(): Promise<void> {
  await super.expectReady();
  await expect(this.root.getByTestId('loading')).toBeHidden();
  await expect(this.root.getByRole('button', { name: '提交', exact: true })).toBeEnabled();
}
```

业务断言放在用例或清晰命名的业务校验中。组件关闭浮层、页码发生变化，不代表后台业务完成。

## 弹窗、事件与存储

- 浮层在当前 iframe 的 body 时，在该 FrameLocator 下构造 listbox/modal Locator；由父页面渲染时，显式传入父页面 Locator，不猜测文档归属。
- PageWaits 监听整个 Page。多个 frame 请求同一端点时，同时匹配 origin、路径、方法和业务标识，必要时核对 request.frame()。
- 事件 timeout 只限制等待匹配事件的阶段。动作仍受原生 actionTimeout/测试总期限约束，不会被 helper 取消。
- actions/files 接收本作用域的 Locator；JS dialog/popup 是 Page 级事件，DOM Modal 是组件。
- BaseView 不暴露 PageStorage，避免误操作顶层 origin。frame 存储通过 frame 内 Locator.evaluate 或原生 Frame.evaluate 显式操作，顶层 page.evaluate 不会进入 iframe。
- iframe 共享所属 BrowserContext。外部状态在应用导航前交付，各 origin 的 sessionStorage 可按现有协议一次准备，不在 iframe 重载时回灌旧值。

## 调试顺序

1. 从截图/Trace 确认系统和角色。
2. 检查每层 iframe 标识是否唯一、是否已挂载或被重建。
3. 确认组件与浮层所属文档。
4. 检查业务就绪和请求匹配条件，保留真实失败，不靠固定等待消除症状。

完整示例：targets/demo/pages/approval.view.ts 与 targets/demo/tests/web/frames.spec.ts。日期、树、级联、虚拟列表按真实项目 Locator 契约适配，再提取重复能力。
