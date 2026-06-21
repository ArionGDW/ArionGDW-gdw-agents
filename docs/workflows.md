# GDW Advisor 工作流

## 群内命令

支持的首版命令：

- `@GDW Advisor 建议: ...`
- `@GDW Advisor 反驳一下这个方案: ...`
- `@GDW Advisor 记录结论: ...`
- `@GDW Advisor 更新进展: ...`
- `@GDW Advisor 本周怎么排: ...`
- `@GDW Advisor 生成 Codex 任务: ...`

回复结构固定为：

1. `结论`
2. `为什么`
3. `主要风险`
4. `建议下一步`
5. `需要你们确认的问题`

## 会议链路

首版把腾讯会议作为事件来源，而不是全程监听器：

- 会议开始/结束事件可以转成 `meeting_note`。
- 会后纪要或人工摘要可以转成 Advisor 输入。
- 只有确认后的会议摘要才允许进入 `data/confirmed/`。

## Codex / Claude 任务包

Advisor 不直接改代码。需要工程执行时，输出：

- Codex 构建任务 prompt
- Claude Code 方案讨论 prompt
- 事实来源和验收标准
- 不允许自动写回飞书的提醒

工程执行结果通过 `@GDW Advisor 更新进展: ...` 回流知识库。

## 使用真实飞书文档生成建议

```bash
npm run advisor:simulate -- \
  --message "@GDW Advisor 建议: V1.2 本周怎么推进？" \
  --feishu-url "https://your-domain.feishu.cn/wiki/..."
```

没有传 `--feishu-url` 时，CLI 继续使用本地 mock 飞书资料。传入飞书链接时，Advisor 会读取真实 Wiki / docx 文档，并在输出中列出飞书文档摘录和证据来源。

也可以在 `.env` 固定配置权威上下文文档：

```env
FEISHU_CONTEXT_URLS=https://your-domain.feishu.cn/wiki/xxx,https://your-domain.feishu.cn/wiki/yyy
```

配置后，`advisor:simulate` 不需要每次传 `--feishu-url`，会自动读取这些真实飞书文档。mock 资料只保留给本地开发测试使用。
