export interface PlaygroundResponse {
  status: number;
  body: string;
}

/** Local DOM contracts for foundation/component verification; no login or external service. */
export function demoPlayground(pathname: string): PlaygroundResponse | undefined {
  if (pathname === '/frames') {
    return { status: 200, body: `<!doctype html><title>Nested frame probe</title>
      <h1>嵌入工作台</h1><label>审批意见<input></label><button>提交</button>
      <iframe title="业务工作区" src="/frames/outer"></iframe>
      <iframe title="备用工作区" src="/frames/inner"></iframe>` };
  }
  if (pathname === '/frames/outer') {
    return { status: 200, body: `<!doctype html><h2>业务工作区</h2>
      <button id="load">加载审批</button><button id="replace">重建审批</button><section id="slot"></section>
      <script>
      function load(){const frame=document.createElement('iframe');frame.title='审批内容';
        frame.src='http://127.0.0.1:4174/frames/inner';document.querySelector('#slot').replaceChildren(frame);}
      document.querySelector('#load').onclick=load;document.querySelector('#replace').onclick=load;
      </script>` };
  }
  if (pathname === '/frames/inner') {
    return { status: 200, body: `<!doctype html><h2>审批表单</h2>
      <form aria-label="审批表单"><label>审批意见<input name="opinion"></label><button>提交</button><output role="status"></output></form>
      <table aria-label="审核记录"><tr><th>人员</th><th>状态</th></tr><tr><td>Alice</td><td>待审批</td></tr></table>
      <script>document.querySelector('form').onsubmit=e=>{e.preventDefault();document.querySelector('output').textContent=e.target.elements.opinion.value;};</script>` };
  }
  if (pathname === '/playground/error') {
    return { status: 500, body: '<!doctype html><html lang="en"><body><h1>Example server error</h1></body></html>' };
  }
  if (pathname === '/playground/frame') {
    return { status: 200, body: `<!doctype html><html lang="zh-CN"><body>
      <label>框内文本 <input></label><button type="button">确认框内输入</button><p role="status"></p>
      <script>document.querySelector('button').onclick=()=>{document.querySelector('[role="status"]').textContent=document.querySelector('input').value;};</script>
      </body></html>` };
  }
  if (pathname !== '/playground') return undefined;
  return { status: 200, body: `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>Browser foundation playground</title>
<style>
body{font:16px system-ui,sans-serif;margin:24px;color:#202938}main{max-width:900px;margin:auto}
section,form,nav{margin:20px 0;padding:16px;border:1px solid #d1d5db}label{display:block;margin:10px 0}
button,input,select{font:inherit;margin:4px;padding:5px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px;text-align:left}
[role="listbox"]{position:fixed;top:20px;right:20px;background:white;border:1px solid #888;padding:16px;z-index:10;list-style:none}
[role="option"]{padding:8px;cursor:pointer}iframe{width:100%;height:150px}dialog{border:1px solid #888}
</style></head><body><main>
<h1>基础能力验证</h1><p>视图：<span data-testid="view"></span></p>
<a href="/playground?view=next">下一视图</a> <a href="/playground?view=popup" target="_blank">打开新页面</a>
<section aria-label="基础输入">
 <label>文本 <input name="text"></label><label>同意条款 <input type="checkbox"></label>
 <label for="native-select">原生选择</label><select id="native-select"><option value="one">选项一</option><option value="two">选项二</option></select>
 <button type="button" id="confirm">确认操作</button><button type="button" id="prompt">输入备注</button>
 <button type="button" id="request">发送查询</button><p role="status" aria-label="操作结果"></p>
</section>
<section aria-label="文件操作">
 <label>直接上传 <input type="file" id="direct-file" multiple></label>
 <input type="file" id="chooser-file" hidden><button type="button" id="choose-file">选择文件</button>
 <p data-testid="file-list"></p><a href="/api/export" download="items.csv">下载 CSV</a>
</section>
<iframe title="嵌入组件" src="/playground/frame"></iframe>
<form aria-label="资料表单">
 <label>姓名 <input name="name" required></label><label>邮箱 <input name="email" type="email" required></label>
 <label>接收通知 <input name="notify" type="checkbox"></label>
 <label for="region-select">地区</label><select id="region-select" name="region"><option value="east">华东</option><option value="west">西部</option></select>
 <button>保存资料</button><output data-testid="form-result"></output>
</form>
<form aria-label="备用表单"><label>姓名 <input value="备用用户"></label><button type="button">保存资料</button></form>
<section aria-label="模态框示例"><button type="button" id="open-modal">编辑资料</button><button type="button">关闭</button></section>
<dialog aria-label="编辑资料"><label>显示名 <input></label><button type="button" id="close-modal">关闭</button></dialog>
<table aria-label="成员列表"><thead><tr><th>姓名</th><th>角色</th></tr></thead><tbody></tbody></table>
<nav aria-label="成员分页"><button type="button" id="previous-page">上一页</button><span data-testid="current-page">1</span><button type="button" id="next-page">下一页</button></nav>
<section aria-label="状态选择"><button type="button" role="combobox" aria-label="任务状态" aria-expanded="false" aria-controls="state-options">待处理</button></section>
<div style="height:900px" aria-hidden="true"></div><button type="button" id="bottom">底部按钮</button>
</main>
<!-- The listbox intentionally lives outside the select's section, like a portal. -->
<ul role="listbox" aria-label="任务状态选项" id="state-options" hidden>
 <li role="option" aria-selected="true">待处理</li><li role="option" aria-selected="false">已完成</li>
</ul>
<script>
const status=document.querySelector('[aria-label="操作结果"]');
document.querySelector('[data-testid="view"]').textContent=new URL(location.href).searchParams.get('view')||'initial';
document.querySelector('#confirm').onclick=()=>{status.textContent=confirm('继续执行？')?'已确认':'已取消';};
document.querySelector('#prompt').onclick=()=>{status.textContent=prompt('请输入备注','默认备注')||'未填写';};
document.querySelector('#request').onclick=async()=>{const response=await fetch('/health?source=foundation');status.textContent=response.ok?'查询完成':'查询失败';};
for(const input of document.querySelectorAll('input[type="file"]'))input.onchange=()=>{document.querySelector('[data-testid="file-list"]').textContent=Array.from(input.files).map(file=>file.name).join(',');};
document.querySelector('#choose-file').onclick=()=>document.querySelector('#chooser-file').click();
document.querySelector('[aria-label="资料表单"]').onsubmit=event=>{event.preventDefault();const data=new FormData(event.target);document.querySelector('[data-testid="form-result"]').textContent=JSON.stringify(Object.fromEntries(data));};
const modal=document.querySelector('dialog');document.querySelector('#open-modal').onclick=()=>modal.showModal();document.querySelector('#close-modal').onclick=()=>modal.close();
let currentPage=1;const pages=[[['Alice','admin'],['Bob','reader']],[['Carol','owner'],['Dan','reader']]];
function renderTable(){const body=document.querySelector('tbody');body.replaceChildren();for(const values of pages[currentPage-1]){const row=document.createElement('tr');for(const value of values){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}body.append(row);}document.querySelector('[data-testid="current-page"]').textContent=String(currentPage);document.querySelector('#previous-page').disabled=currentPage===1;document.querySelector('#next-page').disabled=currentPage===pages.length;}
document.querySelector('#previous-page').onclick=()=>{currentPage--;renderTable();};document.querySelector('#next-page').onclick=()=>{currentPage++;renderTable();};renderTable();
const trigger=document.querySelector('[role="combobox"]');const listbox=document.querySelector('[role="listbox"]');trigger.onclick=()=>{listbox.hidden=!listbox.hidden;trigger.setAttribute('aria-expanded',String(!listbox.hidden));};
for(const option of listbox.querySelectorAll('[role="option"]'))option.onclick=()=>{for(const entry of listbox.children)entry.setAttribute('aria-selected',String(entry===option));trigger.textContent=option.textContent;trigger.setAttribute('aria-expanded','false');listbox.hidden=true;};
document.querySelector('#bottom').onclick=()=>{status.textContent='已到达底部';};
</script></body></html>` };
}
