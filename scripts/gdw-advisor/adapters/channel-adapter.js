import { createEvent } from "../core/event-schema.js";

const COMMANDS = [
  {
    id: "challenge",
    artifactType: "challenge",
    writePolicy: "ephemeral",
    labels: ["反驳一下这个方案", "反驳方案", "挑战方案"]
  },
  {
    id: "record_decision",
    artifactType: "decision",
    writePolicy: "confirmed_decision",
    confirmed: true,
    labels: ["记录结论", "记录决策"]
  },
  {
    id: "progress_update",
    artifactType: "progress_update",
    writePolicy: "confirmed_summary",
    confirmed: true,
    labels: ["更新进展", "记录进展"]
  },
  {
    id: "weekly_plan",
    artifactType: "advice_request",
    writePolicy: "ephemeral",
    labels: ["本周怎么排", "本周计划", "周计划"]
  },
  {
    id: "codex_task",
    artifactType: "codex_task",
    writePolicy: "ephemeral",
    labels: ["生成 Codex 任务", "生成Codex任务", "Codex 任务"]
  },
  {
    id: "advise",
    artifactType: "advice_request",
    writePolicy: "ephemeral",
    labels: ["建议", "帮我看", "咨询"]
  }
];

export class ChannelAdapter {
  constructor(options = {}) {
    this.requireMention = options.requireMention ?? false;
    this.mentionPattern = options.mentionPattern || /@(?:GDW\s*)?Advisor\b/i;
  }

  parseCommand(text) {
    const rawText = String(text || "").trim();
    const withoutMention = rawText.replace(this.mentionPattern, "").trim();

    if (this.requireMention && withoutMention === rawText) {
      return null;
    }

    const normalized = withoutMention.replace(/^[：:\s]+/, "").trim();
    for (const command of COMMANDS) {
      for (const label of command.labels) {
        if (startsWithLabel(normalized, label)) {
          return {
            command: command.id,
            artifactType: command.artifactType,
            writePolicy: command.writePolicy,
            confirmed: Boolean(command.confirmed),
            payload: normalized.slice(label.length).replace(/^[：:\s]+/, "").trim(),
            rawText
          };
        }
      }
    }

    return {
      command: "advise",
      artifactType: "advice_request",
      writePolicy: "ephemeral",
      confirmed: false,
      payload: normalized,
      rawText
    };
  }

  toEvent(message = {}) {
    const parsed = this.parseCommand(message.text || message.content || "");
    if (!parsed) return null;

    return createEvent({
      source: message.source || "wecom",
      artifactType: parsed.artifactType,
      writePolicy: parsed.writePolicy,
      text: parsed.payload || parsed.rawText,
      actor: message.actor || "unknown",
      threadId: message.threadId || null,
      attachments: message.attachments || [],
      confirmed: parsed.confirmed,
      metadata: {
        command: parsed.command,
        rawText: parsed.rawText
      }
    });
  }
}

function startsWithLabel(text, label) {
  if (text === label) return true;
  return text.startsWith(`${label}:`) || text.startsWith(`${label}：`) || text.startsWith(`${label} `);
}
