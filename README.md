# GDW Agents

独立的 GDW Advisor Agent 仓库，用来承载「刚打完」项目的专业建议、确认后知识沉淀、飞书写回草稿、会议/群聊事件转换，以及给 Codex / Claude 的任务包。

首版原则：

- 一个核心 Advisor，不做 8 个常驻 Agent，也不加 PMO 层。
- 不直接修改网球 APP 仓库，只按 `GDW_PRODUCT_REPO` 读取上下文。
- 飞书维护 PRD、阶段摘要、产品决策；代码事实以网球 APP 仓库为准。
- 默认只保存确认后的摘要、决策和建议，不长期保存完整群聊或会议转录。
- 飞书写回默认关闭，且必须出现 `可以写回飞书` 才会生成可写回草稿。

## Quick Start

```bash
npm run advisor:context
npm run advisor:simulate -- --message "@GDW Advisor 建议: V1.2 本周怎么推进？"
npm run advisor:feishu:search -- V1.2
npm test
```

## 目录

```text
docs/                         架构、工作流、飞书集成说明
scripts/gdw-advisor/          Advisor 核心代码和 CLI
.agents/skills/gdw-advisor/   Codex 可用的项目技能
data/mock/                    模拟飞书文档
data/confirmed/               确认后的结论、摘要、决策
data/snapshots/               最小化上下文快照
test/                         node:test 测试
```

## CLI

- `npm run advisor:context`：读取网球 APP 仓库摘要，输出 Advisor 可用事实。
- `npm run advisor:simulate -- --message "..."`
  解析群内 `@GDW Advisor ...` 命令，读取 mock 飞书和仓库上下文，生成建议。
- `npm run advisor:feishu:search -- 关键词`
  搜索本地 mock 飞书资料，后续可替换成真实飞书检索。
- `npm test`：验证敏感最小化、飞书写回确认、群命令、会议事件和任务包生成。

## 数据边界

运行时生成的数据默认被 `.gitignore` 忽略。需要沉淀的结论请通过明确的 `记录结论` / `更新进展` 入口生成，并确保内容已经由你确认。
