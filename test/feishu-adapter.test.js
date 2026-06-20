import test from "node:test";
import assert from "node:assert/strict";
import { FeishuAdapter } from "../scripts/gdw-advisor/adapters/feishu-adapter.js";

test("searches mock Feishu documents", async () => {
  const adapter = new FeishuAdapter();
  const results = await adapter.search("V1.2");

  assert.ok(results.length >= 1);
  assert.equal(results[0].source, "feishu_mock");
});

test("blocks write draft without explicit confirmation", () => {
  const adapter = new FeishuAdapter();
  const draft = adapter.buildWriteDraft({
    title: "测试",
    content: "内容"
  });

  assert.equal(draft.allowed, false);
  assert.match(draft.reason, /可以写回飞书/);
});

test("creates write draft with explicit confirmation", () => {
  const adapter = new FeishuAdapter({ writeEnabled: false });
  const draft = adapter.buildWriteDraft({
    title: "测试",
    content: "内容",
    confirmationText: "可以写回飞书"
  });

  assert.equal(draft.allowed, true);
  assert.equal(draft.status, "draft_ready");
});
