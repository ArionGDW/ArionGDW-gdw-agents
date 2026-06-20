# GDW Advisor Agent 架构

## 目标

构建一个“专业建议优先”的 Advisor Agent，用于你和城宇推进「刚打完」时随时参与讨论。首版不做全量监听，也不做多 Agent 组织架构；以一个核心 Advisor 为中心，通过企业微信 / Qclaw 可替换入口响应 @ 提问，并把确认后的进展、判断和建议沉淀为项目知识。

## 核心模块

```text
ChannelAdapter  -> EventSchema -> AdvisorEngine -> fixed response
MeetingAdapter  -> EventSchema -> KnowledgeStore
FeishuAdapter   -> search/draft -> AdvisorEngine
RepoContext     -> read-only project facts
```

### AdvisorEngine

基于硬件、软件、BP、渠道、增长、品牌、周计划等 playbook 生成建议。输出必须区分：

- 已确认事实
- 推测
- 建议
- 风险
- 需要用户确认的问题

### KnowledgeStore

只持久化确认后的摘要、决策、建议。未确认群聊、会议转录、临时讨论只能作为 ephemeral 输入，不默认入库。

### RepoContext

只读网球 APP 仓库的 `docs/product-context.md`、`docs/project-summary.md`、`docs/next-context.md` 和 `README.md`。该模块不写入产品仓库。

### FeishuAdapter

首版默认使用 `data/mock/feishu-docs.json`。飞书写回只生成草稿，且必须经过 `可以写回飞书` 确认。

## 事实优先级

- PRD、阶段摘要、产品决策：飞书优先。
- 当前代码、页面、数据模型、自动化脚本：网球 APP 仓库优先。
- 飞书与仓库冲突时：必须标明冲突来源，并请求你确认。

## 非目标

- 不让群聊机器人直接改代码。
- 不长期保存普通微信群/会议完整原文。
- 不默认做会中全程监听。
- 不默认建立 PMO Agent 或 8 个职能 Agent。
