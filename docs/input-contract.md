# 外部输入协议

框架不调用 MCP、HTTP 登录接口、SSO 或 Token 刷新。外部 Agent/执行器负责取得信息并交付 JSON；框架读取 JSON、注入状态并运行测试。

## 最小输入

将文件放入 `.runtime/crm.json`，实际凭据不要写入示例或仓库。

```json
{
  "target": "crm",
  "environment": "test",
  "webBaseURL": "https://crm.example.com",
  "apiBaseURL": "https://api.example.com/api/",
  "defaultIdentity": "admin",
  "identities": {
    "admin": {
      "storageState": "./crm-admin.storage.json",
      "sessionStorage": {
        "https://crm.example.com": { "tenantId": "example-tenant" }
      },
      "api": {
        "headers": { "Authorization": "Bearer EXTERNAL_TOKEN" }
      }
    }
  }
}
```

`storageState` 为 Playwright 原生状态文件路径或内联对象。相对路径以输入 JSON 所在目录为基准。对象示例：

```json
{
  "cookies": [
    {
      "name": "session", "value": "EXTERNAL_COOKIE", "domain": "crm.example.com",
      "path": "/", "expires": -1, "httpOnly": true, "secure": true, "sameSite": "Lax"
    }
  ],
  "origins": [
    {
      "origin": "https://crm.example.com",
      "localStorage": [{ "name": "access_token", "value": "EXTERNAL_TOKEN" }]
    }
  ]
}
```

额外的 Playwright 原生状态字段（例如已导出的 IndexedDB）原样传递。框架不从浏览器导出或刷新状态。

## 字段与默认行为

| 字段 | 用途 |
| --- | --- |
| `target` | 被测项目 ID，必须与目标目录及配置一致 |
| `environment` | 本次环境名称，进入报告目录 |
| `webBaseURL` | 页面导航地址 |
| `apiBaseURL` | API 地址；API 客户端按标准 URL 规则解析相对路径 |
| `defaultIdentity` | 默认身份，缺省为 `default` |
| `identities.<name>.storageState` | 浏览器 Cookie、localStorage 等 |
| `identities.<name>.sessionStorage` | 按 origin 一次性注入；尾斜杠/默认端口规范化，路径/query/hash/凭据及规范重复被拒绝 |
| `identities.<name>.api.headers` | 仅用于 API 请求，不自动加入浏览器请求 |
| `identities.<name>.api.storageState` | 可选的 API 独立 Cookie 状态；缺省复用浏览器状态 |
| `identities.<name>.expiresAt` | 可选 ISO 时间；已过期则明确失败，由外部更新 |
| `metadata` | 外部提供的业务元数据，可在 runtime fixture 中读取 |

不需要浏览器状态时可省略 `storageState`。匿名运行可传 `identities: {}` 并设置 `defaultIdentity: "anonymous"`。

## 身份选择

```typescript
import { test, expect } from '../../fixtures';

test.use({ identity: 'reader' });

test('只读角色无创建权限', async ({ api }) => {
  const response = await api.post('users', { data: { name: 'example' } });
  expect(response.status()).toBe(403);
});
```

`anonymous` 是保留身份：不继承任何 Cookie、API 请求头或浏览器存储。CLI 的 `--identity` / 环境变量 `AUTOMATION_IDENTITY` 可覆盖默认身份；文件/测试组的 `test.use` 优先。

每条用例创建独立上下文；相同身份仍可能指向同一个服务端账号。会修改账号级共享设置的并行用例，应由外部提供独立身份后分组执行，或对该组使用单 worker。框架不分配或申请账号。

## API 与浏览器状态边界

- API 使用独立的 APIRequestContext，其响应 Cookie 不会自动回写浏览器。
- sessionStorage 在默认 page 创建后、应用导航前一次性准备，不在刷新、iframe 或注销后重新写入。额外独立 Page 的准备方法见 [页面封装说明](web-foundation.md)。
- localStorage / sessionStorage 中的 Token 不会自动推断成 Authorization；外部应明确提供 API headers。
- `page.request` 是 Playwright 原生的浏览器会话请求入口；项目若需要共享浏览器当前 Cookie，可显式使用它。
- 客户端 `api.get('users')` 在 `https://host/api/` 下访问 `/api/users`；`api.get('/users')` 访问根路径 `/users`。建议统一使用相对路径。
- ApiClient 固定不跟随重定向以维持同 origin 约束；原生 apiContext 默认也不跟随，特殊场景可显式传原生请求选项。默认不自动重试，不捕获 401/403 后登录，也不重放有副作用的请求。
- 上传、下载、params、data、form、multipart 等保留 Playwright 原生请求选项；响应保留原生 APIResponse。

Web/API 基址必须是无用户凭据、无 query/fragment 的 HTTP(S) URL。查询参数通过各次请求传入。

## 输入交付

```bash
npm test -- --target crm --input .runtime/crm.json --suite web
```

也可以设置 `AUTOMATION_INPUT`，然后直接调用原生 Playwright：

```bash
npx playwright test -c targets/crm/playwright.config.ts --project=api
```

`AUTOMATION_INPUT` 的相对路径以当前工作目录为基准。框架不复制输入文件到报告目录。

JSON Schema 在 `docs/runtime.schema.json`；修改协议后运行 `npm run schema` 重新生成。

认证信息可能出现在 Playwright 原生 Trace、截图、响应及附件中；这些调试产物与输入文件都应按测试凭据管理，不要作为公开报告上传。框架不默认附加完整请求头/请求体，也不声称能对原生 Trace 完整脱敏。
