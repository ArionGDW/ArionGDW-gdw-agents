export const SOURCES = Object.freeze([
  "wecom",
  "qclaw",
  "tencent_meeting",
  "codex",
  "claude",
  "feishu",
  "manual"
]);

export const ARTIFACT_TYPES = Object.freeze([
  "mention",
  "advice_request",
  "challenge",
  "progress_update",
  "decision",
  "meeting_note",
  "artifact",
  "codex_task",
  "claude_prompt"
]);

export const WRITE_POLICIES = Object.freeze([
  "ephemeral",
  "confirmed_summary",
  "confirmed_decision",
  "confirmed_advice",
  "write_draft"
]);

const CONFIRMED_POLICIES = new Set([
  "confirmed_summary",
  "confirmed_decision",
  "confirmed_advice"
]);

export class EventValidationError extends Error {
  constructor(errors) {
    super(`Invalid advisor event: ${errors.join("; ")}`);
    this.name = "EventValidationError";
    this.errors = errors;
  }
}

export function createEvent(input = {}) {
  const occurredAt = input.occurredAt || new Date().toISOString();
  const event = {
    id: input.id || createEventId(occurredAt),
    source: input.source || "manual",
    artifactType: input.artifactType || "mention",
    writePolicy: input.writePolicy || "ephemeral",
    text: input.text || "",
    actor: input.actor || "unknown",
    occurredAt,
    threadId: input.threadId || null,
    attachments: Array.isArray(input.attachments) ? input.attachments : [],
    confirmed: Boolean(input.confirmed),
    metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {}
  };

  return validateEvent(event);
}

export function validateEvent(event) {
  const errors = [];

  if (!event || typeof event !== "object") errors.push("event must be an object");
  if (event && !SOURCES.includes(event.source)) errors.push(`source must be one of ${SOURCES.join(", ")}`);
  if (event && !ARTIFACT_TYPES.includes(event.artifactType)) {
    errors.push(`artifactType must be one of ${ARTIFACT_TYPES.join(", ")}`);
  }
  if (event && !WRITE_POLICIES.includes(event.writePolicy)) {
    errors.push(`writePolicy must be one of ${WRITE_POLICIES.join(", ")}`);
  }
  if (event && typeof event.text !== "string") errors.push("text must be a string");
  if (event && typeof event.actor !== "string") errors.push("actor must be a string");
  if (event && Number.isNaN(Date.parse(event.occurredAt))) errors.push("occurredAt must be an ISO timestamp");
  if (event && !Array.isArray(event.attachments)) errors.push("attachments must be an array");

  if (errors.length) throw new EventValidationError(errors);
  return event;
}

export function canPersist(event) {
  return Boolean(event && event.confirmed === true && CONFIRMED_POLICIES.has(event.writePolicy));
}

export function requiresFeishuWriteConfirmation(text) {
  return typeof text === "string" && text.includes("可以写回飞书");
}

export function createEventId(occurredAt = new Date().toISOString()) {
  const compact = occurredAt.replace(/[-:.TZ]/g, "").slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `evt_${compact}_${suffix}`;
}
