# 飞书集成说明

## 首版策略

首版使用 mock 飞书资料，接口形态保持可替换：

- `checkConnection()`：用 `FEISHU_APP_ID` / `FEISHU_APP_SECRET` 换取 tenant access token，验证凭据是否可用。
- `readDocumentFromUrl(url)`：解析 Wiki / docx 链接，读取新版文档文本预览。
- `search(query)`：搜索 PRD、阶段摘要、产品决策。
- `buildWriteDraft(...)`：生成写回草稿。
- `extractFactsFromDocs(...)`：提取可与仓库事实比对的结构化字段。

## 写回规则

默认 `FEISHU_WRITE_ENABLED=false`。即使未来打开真实写回，也必须满足：

1. 用户明确说出 `可以写回飞书`。
2. 内容是确认后的摘要、决策或建议。
3. 草稿中标明来源和时间。
4. 若飞书与仓库事实冲突，先请求用户确认，不自动覆盖。

## 当前限制

本仓库没有接入真实飞书 API，也不会保存密钥。真实接入时应单独补充：

- 飞书自建应用权限范围。
- tenant access token 刷新。
- 云文档搜索 API。
- 文档读取 API。
- 写回审批或人工确认流程。

## 事件回调服务

本地启动：

```bash
npm run advisor:feishu:server
```

默认监听：

```text
http://127.0.0.1:8787/health
http://127.0.0.1:8787/feishu/events
```

飞书后台需要公网 HTTPS 回调地址。开发阶段可以用 ngrok、Cloudflare Tunnel 或其他内网穿透工具把本地 `8787` 端口暴露出去，再把公网地址的 `/feishu/events` 配到「事件与回调」。
