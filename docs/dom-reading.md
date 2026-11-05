# DOM 与组件数据读取

当前框架保留原生 Page、FrameLocator 和 Locator。Table 提供行与单元格 Locator，没有全量数据采集器。下面的方法属于 Playwright 原生能力，不是项目自研 DOM 引擎。

## 选择读取入口

| 需求 | 原生入口 | 边界 |
| --- | --- | --- |
| 元素文本 | innerText / textContent | 前者按渲染文本语义，后者可能包含隐藏文本 |
| 一组元素文本 | allInnerTexts / allTextContents | 当前匹配元素的快照，不保证列表加载完成 |
| 当前输入值 | inputValue | 不用 HTML value 属性替代当前值 |
| 属性与业务 ID | getAttribute | 读取明确、稳定的属性 |
| 局部 HTML | innerHTML / evaluate(el => el.outerHTML) | 不包含完整组件运行状态 |
| 自定义结构化读取 | evaluate / evaluateAll | 回调在浏览器内运行，参数显式传入 |

测试从目标 fixtures 导入 test/expect。优先使用可重试的 expect(locator) 断言；批量数据提取前，先等待目标明确的业务就绪条件，例如加载标记消失、数据版本更新或预期记录出现。仅 table 可见不代表数据加载完成。不要固定 sleep。

## 多层 iframe 中读取标准表格

以下选择器是接入示意，须换成目标项目的稳定定位；ready 条件由业务页面定义。

```typescript
const frame = page
  .frameLocator('iframe[data-testid="workspace"]')
  .frameLocator('iframe[data-testid="business"]');
const table = frame.getByTestId('order-table');
await expect(table).toHaveAttribute('data-load-state', 'ready');

const rows = await table.evaluate(element => {
  if (!(element instanceof HTMLTableElement)) {
    throw new Error('Expected a standard HTML table');
  }
  return Array.from(element.rows, row =>
    Array.from(row.cells, cell => cell.innerText.trim()),
  );
});
```

结果包括当前标准表格的表头和数据行；没有扩展 rowspan/colspan，也没有计算分页外的行。div/ARIA grid 应按其行列结构适配，编辑单元格还需区分显示文本和 input/select 的当前值。

通过目标 frame 的 Locator 读取，适用于框架现有嵌入视图。不要在顶层 page.evaluate 中通过 contentWindow 穿越跨 origin iframe。page.content() 是当前主文档的 HTML，不会递归展开所有 iframe 文档；DOM 序列化也不等于完整 Shadow DOM 或组件内存状态。

## 尚未渲染的数据

- 分页和虚拟列表：DOM 只包含已挂载部分。需要全量 UI 数据时，项目适配器显式翻页/滚动，按稳定业务键去重，并定义终止条件和上限。
- 接口结果：可用 PageWaits 捕获相关响应，或用独立 API fixture 查询。接口断言与页面展示断言分别保留，不能用后端正确替代前端正确。
- Canvas：内部图形没有普通 DOM 单元格。使用目标公开的数据接口、可访问性节点或视觉断言；不读取未承诺稳定的 React/Vue 内部对象。
- DOM/HTML 附件可能包含业务数据和凭据。仅在需要时显式附加选定区域，框架不自动上传整页 DOM，也不声称能够完整脱敏。

原生接口：[Locator](https://playwright.dev/docs/api/class-locator)、[执行页面 JavaScript](https://playwright.dev/docs/evaluating)。
