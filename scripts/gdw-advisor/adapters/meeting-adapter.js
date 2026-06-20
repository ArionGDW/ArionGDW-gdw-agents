import { createEvent } from "../core/event-schema.js";

export class MeetingAdapter {
  toEvent(input = {}) {
    const summary = summarizeMeetingNote(input.summary || input.transcript || input.text || "");
    const confirmed = Boolean(input.confirmed);

    return createEvent({
      source: "tencent_meeting",
      artifactType: "meeting_note",
      writePolicy: confirmed ? "confirmed_summary" : "ephemeral",
      text: summary.compactText,
      actor: input.actor || "meeting",
      occurredAt: input.occurredAt || new Date().toISOString(),
      threadId: input.meetingId || null,
      attachments: input.link ? [{ type: "meeting_link", url: input.link }] : [],
      confirmed,
      metadata: {
        provider: "tencent_meeting",
        meetingId: input.meetingId || null,
        title: input.title || "",
        status: input.status || "summary",
        decisions: summary.decisions,
        todos: summary.todos
      }
    });
  }
}

export function summarizeMeetingNote(text) {
  const lines = String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const decisions = lines.filter((line) => /^(结论|决定|决策|decision)[:：]/i.test(line));
  const todos = lines.filter((line) => /^(待办|下一步|todo|action)[:：]/i.test(line));
  const compactText = lines.join("\n").slice(0, 4000);

  return {
    compactText,
    decisions,
    todos
  };
}
