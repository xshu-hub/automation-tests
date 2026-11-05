import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { demoPlayground } from './demo-playground';

interface Item { id: string; title: string; owner: string }
const items = new Map<string, Item>();
const port = 4173;

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}

function actor(request: IncomingMessage): string | undefined {
  const token = request.headers.authorization?.replace(/^Bearer /, '')
    || /(?:^|;\s*)demo_session=([^;]+)/.exec(request.headers.cookie || '')?.[1];
  return token === 'demo-admin' ? 'admin' : token === 'demo-reader' ? 'reader' : undefined;
}

async function body(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>事项管理 · 测试示例</title>
<style>
body{font:15px system-ui,sans-serif;background:#f5f6f8;color:#202938;margin:0;padding:48px 20px}
main{max-width:760px;margin:auto;background:white;padding:32px;border:1px solid #e5e7eb;border-radius:14px}
h1{font-size:24px;margin:0 0 24px} form,section{margin:20px 0} input,button,a{font:inherit}
input{padding:9px;border:1px solid #cbd0d8;border-radius:6px} button{padding:9px 14px;border:0;background:#2459b8;color:white;border-radius:6px;cursor:pointer}
li{display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid #eee}
li button{background:#eef1f7;color:#344054} ul{padding:0;list-style:none} .meta{display:flex;gap:16px;color:#626e80;font-size:13px;flex-wrap:wrap} a{color:#2459b8}
</style></head>
<body><main><h1>事项管理</h1>
<div class="meta"><span>会话：<strong data-testid="current-user">loading</strong></span>
<span>本地身份：<strong data-testid="local-user">none</strong></span>
<span>租户：<strong data-testid="tenant">none</strong></span></div>
<form id="create"><label>事项名称 <input name="title" required autocomplete="off"></label> <button>添加事项</button></form>
<ul aria-label="事项列表" id="items"></ul>
<section><a href="/api/export" download="items.csv">导出 CSV</a></section>
<section><label>上传文件 <input type="file" id="file"></label> <button id="upload">上传</button></section>
<p role="status"></p></main>
<script>
const status = document.querySelector('[role="status"]');
document.querySelector('[data-testid="local-user"]').textContent=localStorage.getItem('demo_user')||'none';
document.querySelector('[data-testid="tenant"]').textContent=sessionStorage.getItem('demo_tenant')||'none';
fetch('/api/me').then(async r=>{ const d=await r.json();document.querySelector('[data-testid="current-user"]').textContent=d.user||'anonymous';});
async function refresh(){
 const r=await fetch('/api/items'); if(!r.ok)return;
 const entries=await r.json();const list=document.querySelector('#items');list.replaceChildren();
 for(const item of entries){const li=document.createElement('li');const title=document.createElement('span');title.textContent=item.title;li.append(title);
 const button=document.createElement('button');button.textContent='删除';button.onclick=async()=>{await fetch('/api/items/'+item.id,{method:'DELETE'});await refresh();};li.append(button);list.append(li);}
}
document.querySelector('#create').onsubmit=async e=>{e.preventDefault();const field=e.target.elements.title;const title=field.value;
 const r=await fetch('/api/items',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title})});
 if(r.status===201){const item=await r.json();if(typeof item.id!=='string'||item.title!==title){status.textContent='创建响应无效';return;}field.value='';await refresh();}else status.textContent='创建失败';};
document.querySelector('#upload').onclick=async()=>{const file=document.querySelector('#file').files[0];if(!file)return;
 const form=new FormData();form.append('file',file);const r=await fetch('/api/upload',{method:'POST',body:form});status.textContent=r.ok?'上传成功':'上传失败';};
refresh();
</script></body></html>`;

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://127.0.0.1:${port}`);
    const path = url.pathname;
    const playground = demoPlayground(path);
    if (playground) {
      response.writeHead(playground.status, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(playground.body); return;
    }
    if (path === '/health') return send(response, 200, { ok: true });
    if (path === '/' || path === '/items') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(html);
      return;
    }
    if (path === '/api/redirect') {
      response.writeHead(302, { Location: '/items' }); response.end(); return;
    }
    const user = actor(request);
    if (!user) return send(response, 401, { error: 'unauthorized' });
    if (path === '/api/me') return send(response, 200, { user });
    if (path === '/api/plain-text') {
      response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('sensitive-body-demo-value'); return;
    }
    if (path === '/api/request-info') return send(response, 200, { userAgent: request.headers['user-agent'] });
    if (path === '/api/rotate-cookie' && request.method === 'POST') {
      const input = JSON.parse((await body(request)).toString()) as { user: string };
      if (!['admin', 'reader'].includes(input.user)) return send(response, 400, { error: 'invalid_identity' });
      response.setHeader('Set-Cookie', `demo_session=demo-${input.user}; Path=/; HttpOnly; SameSite=Lax`);
      return send(response, 200, { user: input.user });
    }
    if (path === '/api/header-only') {
      return send(response, request.headers.authorization ? 200 : 401, { user });
    }
    if (path === '/api/unavailable') return send(response, 503, { error: 'service_unavailable' });
    if (path === '/api/export') {
      response.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="items.csv"' });
      response.end(`id,title\n${url.searchParams.get('label') || 'demo'},export\n`);
      return;
    }
    if (path === '/api/upload' && request.method === 'POST') {
      const uploaded = (await body(request)).includes(Buffer.from('filename='));
      return send(response, uploaded ? 200 : 400, { uploaded });
    }
    if (path === '/api/items' && request.method === 'GET') {
      return send(response, 200, [...items.values()].filter((item) => item.owner === user));
    }
    if (path === '/api/items' && request.method === 'POST') {
      if (user !== 'admin') return send(response, 403, { error: 'forbidden' });
      const input = JSON.parse((await body(request)).toString()) as { title?: unknown };
      if (typeof input.title !== 'string' || !input.title.trim()) return send(response, 400, { error: 'title_required' });
      const item = { id: randomUUID(), title: input.title, owner: user };
      items.set(item.id, item);
      if (item.title.startsWith('__invalid-response__-')) return send(response, 201, { id: item.id, title: item.title });
      return send(response, 201, item);
    }
    const match = /^\/api\/items\/([^/]+)$/.exec(path);
    if (match) {
      const item = items.get(match[1]);
      if (!item || item.owner !== user) return send(response, 404, { error: 'not_found' });
      if (request.method === 'DELETE') {
        if (user !== 'admin') return send(response, 403, { error: 'forbidden' });
        items.delete(item.id); response.writeHead(204); response.end(); return;
      }
      if (request.method === 'GET') return send(response, 200, item);
    }
    send(response, 404, { error: 'not_found' });
  } catch {
    send(response, 400, { error: 'invalid_request' });
  }
});

server.listen(port, '127.0.0.1', () => console.log(`Local demo ready on http://127.0.0.1:${port}`));
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
