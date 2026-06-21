import test from "node:test";
import assert from "node:assert/strict";
import { AdvisorEngine, formatAdvisorResponse } from "../scripts/gdw-advisor/core/advisor-engine.js";
import { createEvent } from "../scripts/gdw-advisor/core/event-schema.js";

const projectContext = {
  facts: {
    projectName: "刚打完（GDW）",
    currentVersion: "v1.2.0",
    stage: "V1.2 产品转向落地",
    primaryGoal: "验证用户是否愿意记录、查看、分享并持续使用网球生活作品"
  },
  docs: {
    "docs/product-context.md": { exists: true, relativePath: "docs/product-context.md" }
  }
};

test("formats advisor response with required sections", () => {
  const event = createEvent({
    artifactType: "advice_request",
    text: "本周怎么排？",
    metadata: { command: "weekly_plan" }
  });
  const response = new AdvisorEngine().respond({
    event,
    projectContext,
    feishuResults: [],
    confirmedKnowledge: []
  });
  const formatted = formatAdvisorResponse(response);

  assert.match(formatted, /结论/);
  assert.match(formatted, /为什么/);
  assert.match(formatted, /主要风险/);
  assert.match(formatted, /建议下一步/);
  assert.match(formatted, /需要你们确认的问题/);
});

test("generates Codex task package", () => {
  const event = createEvent({
    artifactType: "codex_task",
    text: "实现分享点击事件验收",
    metadata: { command: "codex_task" }
  });
  const response = new AdvisorEngine().respond({
    event,
    projectContext,
    feishuResults: [{ title: "GDW V1.2 PRD 阶段摘要", facts: {} }],
    confirmedKnowledge: []
  });

  assert.ok(response.codexTask);
  assert.match(response.codexTask, /任务/);
  assert.match(response.codexTask, /不直接写回飞书/);
});

test("includes live Feishu document snippets in formatted response", () => {
  const event = createEvent({
    artifactType: "advice_request",
    text: "V1.2 本周怎么推进？"
  });
  const response = new AdvisorEngine().respond({
    event,
    projectContext,
    feishuResults: [{
      title: "GDW Advisor 测试文档",
      source: "feishu_live",
      snippet: "阶段：V1.2 产品转向落地。目标：验证 Advisor 是否能读取飞书文档内容。",
      facts: {
        stage: "V1.2 产品转向落地"
      }
    }],
    confirmedKnowledge: []
  });
  const formatted = formatAdvisorResponse(response);

  assert.match(formatted, /飞书文档摘录/);
  assert.match(formatted, /GDW Advisor 测试文档/);
  assert.match(formatted, /飞书真实文档/);
});
