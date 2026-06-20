import test from "node:test";
import assert from "node:assert/strict";
import { MeetingAdapter } from "../scripts/gdw-advisor/adapters/meeting-adapter.js";

test("converts meeting summary into ephemeral event by default", () => {
  const event = new MeetingAdapter().toEvent({
    meetingId: "m-1",
    title: "GDW 周会",
    summary: "结论: 本周验证分享闭环\n待办: 补齐分享点击事件"
  });

  assert.equal(event.source, "tencent_meeting");
  assert.equal(event.artifactType, "meeting_note");
  assert.equal(event.writePolicy, "ephemeral");
  assert.equal(event.confirmed, false);
  assert.equal(event.metadata.decisions.length, 1);
  assert.equal(event.metadata.todos.length, 1);
});

test("confirmed meeting summary can become confirmed summary", () => {
  const event = new MeetingAdapter().toEvent({
    meetingId: "m-2",
    summary: "结论: 已确认本周方向",
    confirmed: true
  });

  assert.equal(event.writePolicy, "confirmed_summary");
  assert.equal(event.confirmed, true);
});
