import test from "node:test";
import assert from "node:assert/strict";
import { ChannelAdapter } from "../scripts/gdw-advisor/adapters/channel-adapter.js";

test("parses GDW Advisor advice command", () => {
  const adapter = new ChannelAdapter();
  const event = adapter.toEvent({
    text: "@GDW Advisor 建议: V1.2 本周怎么推进？",
    actor: "allen",
    source: "wecom"
  });

  assert.equal(event.source, "wecom");
  assert.equal(event.artifactType, "advice_request");
  assert.equal(event.writePolicy, "ephemeral");
  assert.equal(event.metadata.command, "advise");
  assert.equal(event.text, "V1.2 本周怎么推进？");
});

test("record decision command creates confirmed decision event", () => {
  const adapter = new ChannelAdapter();
  const event = adapter.toEvent({
    text: "@GDW Advisor 记录结论: 本周只验证 Session 分享闭环",
    actor: "allen"
  });

  assert.equal(event.artifactType, "decision");
  assert.equal(event.writePolicy, "confirmed_decision");
  assert.equal(event.confirmed, true);
});
