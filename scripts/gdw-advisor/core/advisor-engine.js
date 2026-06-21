import { detectFactConflicts, extractFactsFromDocs } from "../adapters/feishu-adapter.js";

export class AdvisorEngine {
  respond(input = {}) {
    const event = input.event || {};
    const projectContext = input.projectContext || {};
    const feishuResults = input.feishuResults || [];
    const confirmedKnowledge = input.confirmedKnowledge || [];
    const topic = detectTopic(event.text || "");
    const command = event.metadata?.command || "advise";
    const feishuFacts = extractFactsFromDocs(feishuResults);
    const conflicts = detectFactConflicts(projectContext.facts || {}, feishuFacts);

    return {
      topic,
      command,
      conclusion: buildConclusion({ topic, command, conflicts }),
      why: buildWhy({ projectContext, feishuResults, confirmedKnowledge, conflicts }),
      risks: buildRisks({ topic, conflicts }),
      nextSteps: buildNextSteps({ topic, command, event }),
      questions: buildQuestions({ topic, conflicts }),
      feishuSnippets: buildFeishuSnippets(feishuResults),
      evidence: buildEvidence({ projectContext, feishuResults, confirmedKnowledge }),
      codexTask: command === "codex_task" ? buildCodexTask({ event, projectContext, feishuResults }) : null,
      claudePrompt: command === "codex_task" ? buildClaudePrompt({ event, projectContext }) : null,
      conflicts
    };
  }
}

export function formatAdvisorResponse(response) {
  const parts = [
    "结论",
    response.conclusion,
    "",
    "为什么",
    bulletList(response.why),
    "",
    "主要风险",
    bulletList(response.risks),
    "",
    "建议下一步",
    numberedList(response.nextSteps),
    "",
    "需要你们确认的问题",
    bulletList(response.questions)
  ];

  if (response.conflicts?.length) {
    parts.push("", "事实冲突", bulletList(response.conflicts.map((item) => `${item.key}: 仓库=${item.repo}; 飞书=${item.feishu}`)));
  }

  if (response.codexTask) {
    parts.push("", "Codex 任务包", response.codexTask);
  }

  if (response.claudePrompt) {
    parts.push("", "Claude 讨论 Prompt", response.claudePrompt);
  }

  if (response.feishuSnippets?.length) {
    parts.push("", "飞书文档摘录", bulletList(response.feishuSnippets));
  }

  parts.push("", "证据来源", bulletList(response.evidence));
  return parts.join("\n");
}

export function detectTopic(text) {
  const value = String(text || "");
  if (/硬件|传感器|BLE|WIT|IMU|定制|减震器/.test(value)) return "hardware";
  if (/小程序|代码|页面|云函数|数据|Session|Rally|Hit|分享|邀请/.test(value)) return "software";
  if (/BP|商业计划|融资|合伙|股权|投资/.test(value)) return "business_plan";
  if (/渠道|俱乐部|教练|场馆|种子用户|地推/.test(value)) return "channel";
  if (/增长|留存|转化|裂变|邀请|分享率/.test(value)) return "growth";
  if (/品牌|命名|视觉|logo|海报|包装/.test(value)) return "brand";
  if (/本周|排期|计划|优先级|下一步/.test(value)) return "weekly_plan";
  return "general";
}

function buildConclusion({ topic, command, conflicts }) {
  if (conflicts.length) {
    return "先不要直接拍板。飞书与仓库存在事实冲突，需要确认来源后再进入执行。";
  }
  if (command === "challenge") {
    return "这个方案应先被拆成可验证假设，不适合直接按完整方案推进。";
  }
  if (command === "codex_task") {
    return "可以生成工程任务，但任务边界应限定为可验收的单步改动，并把产品事实来源写清楚。";
  }

  const conclusions = {
    hardware: "硬件先服务于 Session 记录可信度验证，不急着定义完整 GDW 自有硬件路线。",
    software: "软件优先围绕当前 V1.2 主链路做可观测、可验收的增量，不把 PRD 讨论和代码事实混在一起。",
    business_plan: "BP 先写清阶段证据、角色分工和关键假设，不把未验证事项包装成确定能力。",
    channel: "渠道先找能带来真实打球记录和反馈的种子场景，而不是一开始铺大规模合作。",
    growth: "增长先验证记录、查看、分享、邀请这条链路的真实转化，再设计更重的活动机制。",
    brand: "品牌表达应围绕“刚打完”的生活记录感，不提前承诺训练评分或 AI 教练能力。",
    weekly_plan: "本周应围绕一个最大未知量推进：让 V1.2 的记录、作品、分享和反馈形成闭环。",
    general: "先把问题落到一个可验证的产品或商业假设，再决定是否需要工程、渠道或 BP 动作。"
  };
  return conclusions[topic];
}

function buildWhy({ projectContext, feishuResults, confirmedKnowledge, conflicts }) {
  const facts = projectContext.facts || {};
  const liveDocs = feishuResults.filter((doc) => doc.source === "feishu_live");
  const mockDocs = feishuResults.filter((doc) => doc.source !== "feishu_live");
  const items = [
    `仓库阶段显示为 ${facts.stage || "unknown"}，目标是 ${facts.primaryGoal || "unknown"}。`,
    "当前规则是飞书负责 PRD/阶段/产品决策，仓库负责代码、页面、数据模型和自动化事实。"
  ];

  if (liveDocs.length) {
    items.push(`本次读取了 ${liveDocs.length} 个飞书真实文档：${liveDocs.map((doc) => doc.title).join("、")}。`);
  } else {
    items.push(`本次检索到 ${mockDocs.length} 条飞书候选资料。`);
  }
  items.push(`已沉淀确认知识 ${confirmedKnowledge.length} 条。`);

  if (conflicts.length) {
    items.push("存在冲突字段，Advisor 不能把任一来源直接当成最终事实。");
  }
  return items;
}

function buildRisks({ topic, conflicts }) {
  const common = [
    "把未确认讨论写回飞书或知识库，会污染后续判断。",
    "让群机器人直接改代码，会绕过必要的验收和上下文审查。"
  ];

  const topicRisks = {
    hardware: ["过早定制硬件会掩盖传感器计数可信度这个核心未知量。"],
    software: ["只看 PRD 不看仓库，容易误判当前页面、数据模型和云函数状态。"],
    business_plan: ["把顾问、渠道、技术支持直接写成创始团队角色，可能超出真实承诺。"],
    channel: ["渠道合作如果没有记录/分享数据回流，无法判断用户价值。"],
    growth: ["活动设计早于基础分享链路，容易得到虚假的热闹数据。"],
    brand: ["品牌承诺超过产品能力，会伤害首批用户信任。"],
    weekly_plan: ["周计划如果同时覆盖太多方向，会稀释对最大未知量的验证。"],
    general: ["没有明确验收指标时，建议会停留在讨论层面。"]
  };

  if (conflicts.length) common.unshift("事实冲突未确认前继续执行，会导致飞书和仓库双线分叉。");
  return [...(topicRisks[topic] || topicRisks.general), ...common];
}

function buildNextSteps({ topic, command, event }) {
  if (command === "codex_task") {
    return [
      "把任务范围限制为一个页面、一个模块或一个文档交付物。",
      "在任务 prompt 中写清事实来源、验收标准和禁止自动写回飞书。",
      "完成后用 `@GDW Advisor 更新进展: ...` 回流确认摘要。"
    ];
  }

  if (event.artifactType === "decision") {
    return [
      "检查结论是否已经由你确认。",
      "保存为 confirmed decision，不保存原始讨论。",
      "如需进入飞书，另行生成写回草稿并等待 `可以写回飞书`。"
    ];
  }

  const topicSteps = {
    hardware: [
      "列出本周必须验证的传感器/硬件假设。",
      "把实测数据和用户反馈分开记录，不把体验判断混入原始数据。",
      "只有在数据可信度过关后，再讨论自有硬件形态。"
    ],
    software: [
      "先运行或更新仓库摘要，确认当前页面、数据模型和事件表事实。",
      "选一个 V1.2 主链路缺口做可验收改动。",
      "用 Session 入库、作品曝光、详情查看、分享点击作为验收线索。"
    ],
    business_plan: [
      "先把已验证事实、假设、待验证项分栏。",
      "把外部协作者映射到 BP 具体章节，不急着定创始人标签。",
      "补齐时间投入、资源边界和结果证明。"
    ],
    channel: [
      "锁定 1-2 个能产生真实打球 Session 的种子场景。",
      "约定反馈字段：是否愿意记录、是否查看作品、是否分享、是否愿意下次再用。",
      "把渠道反馈整理成确认摘要后再入库。"
    ],
    growth: [
      "先检查分享入口和邀请入口是否可被记录。",
      "只做一个能提升分享或邀请的最小实验。",
      "实验结束后用事件数据和用户反馈一起判断。"
    ],
    brand: [
      "明确刚打完要表达的是网球生活作品，不是训练评分工具。",
      "先产出 2-3 条可用于分享卡片和介绍页的文案方向。",
      "用种子用户反馈筛掉过度技术化的表达。"
    ],
    weekly_plan: [
      "本周只选一个证据目标：V1.2 记录-作品-分享闭环是否跑通。",
      "把硬件、软件、渠道动作都服务于这个目标。",
      "周末只沉淀确认事实和下周最大未知量。"
    ],
    general: [
      "把当前问题改写成一个待验证假设。",
      "确认事实来源：飞书、仓库、会议，还是人工判断。",
      "产出一个可执行动作和一个验收标准。"
    ]
  };

  return topicSteps[topic] || topicSteps.general;
}

function buildQuestions({ topic, conflicts }) {
  if (conflicts.length) {
    return ["以飞书还是仓库为准？如果是阶段/PRD，以哪份飞书文档为最终版本？"];
  }

  const questions = {
    hardware: ["这次讨论要验证的是数据可信度、佩戴体验，还是硬件商业化形态？"],
    software: ["本次改动的验收页面、函数或指标是哪一个？"],
    business_plan: ["这部分要写进 BP 的 Team、Go-to-market、Operations 还是 Strategic resources？"],
    channel: ["目标渠道能否带来实际 Session 记录和反馈，而不仅是口头兴趣？"],
    growth: ["你想优先提升 Session 分享率、用户分享率，还是邀请绑定转化率？"],
    brand: ["这次品牌输出是给用户看的，还是给合作方/BP看的？"],
    weekly_plan: ["本周最大未知量是记录可信度、分享意愿，还是种子用户反馈？"],
    general: ["这条建议最终要变成决策、工程任务、飞书摘要，还是会议讨论材料？"]
  };
  return questions[topic] || questions.general;
}

function buildEvidence({ projectContext, feishuResults, confirmedKnowledge }) {
  const docs = Object.values(projectContext.docs || {})
    .filter((doc) => doc.exists)
    .map((doc) => `仓库: ${doc.relativePath}`);
  const feishu = feishuResults.map((doc) => {
    const prefix = doc.source === "feishu_live" ? "飞书真实文档" : "飞书候选";
    return `${prefix}: ${doc.title}`;
  });
  const knowledge = confirmedKnowledge.slice(0, 3).map((item) => `确认知识: ${item.artifactType} ${item.occurredAt}`);
  return [...docs, ...feishu, ...knowledge].slice(0, 10);
}

function buildFeishuSnippets(feishuResults) {
  return feishuResults
    .filter((doc) => doc.source === "feishu_live" && doc.snippet)
    .slice(0, 3)
    .map((doc) => `${doc.title}: ${compact(doc.snippet, 240)}`);
}

function buildCodexTask({ event, projectContext, feishuResults }) {
  const facts = projectContext.facts || {};
  const sourceList = [
    "飞书用于 PRD/阶段/产品决策",
    "网球 APP 仓库用于当前代码/页面/数据模型事实",
    ...feishuResults.slice(0, 3).map((doc) => `${doc.source === "feishu_live" ? "飞书真实文档" : "飞书候选"}: ${doc.title}`)
  ];

  return [
    "任务：",
    event.text || "请基于 GDW 当前上下文完成一个可验收改动。",
    "",
    "背景：",
    `- 项目：${facts.projectName || "刚打完（GDW）"}`,
    `- 阶段：${facts.stage || "unknown"}`,
    `- 目标：${facts.primaryGoal || "unknown"}`,
    "",
    "事实来源：",
    bulletList(sourceList),
    "",
    "约束：",
    "- 不直接写回飞书。",
    "- 不修改 GDW Advisor 仓库以外的内容，除非任务明确要求。",
    "- 输出验收结果和后续回流摘要。"
  ].join("\n");
}

function buildClaudePrompt({ event, projectContext }) {
  const facts = projectContext.facts || {};
  return [
    `请作为 GDW 项目的方案讨论助手，围绕以下问题提出反方风险和更小的验证路径：${event.text || ""}`,
    `当前阶段：${facts.stage || "unknown"}`,
    `目标：${facts.primaryGoal || "unknown"}`,
    "要求：区分已确认事实、推测、建议；不要默认引入 PMO 或多 Agent 组织架构。"
  ].join("\n");
}

function bulletList(items) {
  if (!items?.length) return "- none";
  return items.map((item) => `- ${item}`).join("\n");
}

function numberedList(items) {
  if (!items?.length) return "1. none";
  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

function compact(text, maxLength) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}
