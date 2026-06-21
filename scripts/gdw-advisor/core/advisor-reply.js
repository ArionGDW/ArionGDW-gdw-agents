import { AdvisorEngine, formatAdvisorResponse } from "./advisor-engine.js";
import { ChannelAdapter } from "../adapters/channel-adapter.js";
import { FeishuAdapter } from "../adapters/feishu-adapter.js";
import { KnowledgeStore } from "./knowledge-store.js";
import { RepoContext } from "./repo-context.js";
import { createEvent } from "./event-schema.js";

export async function buildAdvisorReply(text, meta = {}) {
  const channel = new ChannelAdapter();
  const parsed = channel.toEvent({
    text,
    source: meta.source || "feishu",
    actor: meta.actor || "feishu-user",
    threadId: meta.threadId || null
  });

  const event = parsed || createEvent({
    source: meta.source || "feishu",
    artifactType: "advice_request",
    writePolicy: "ephemeral",
    text,
    actor: meta.actor || "feishu-user",
    threadId: meta.threadId || null,
    metadata: {
      messageId: meta.messageId || null
    }
  });

  const repoContext = await new RepoContext().load();
  const feishu = new FeishuAdapter();
  const contextUrls = splitUrlList(process.env.FEISHU_CONTEXT_URLS);
  const feishuResults = contextUrls.length
    ? await feishu.readDocumentsForAdvisor(contextUrls)
    : await feishu.search(event.text || text);
  const confirmedKnowledge = await new KnowledgeStore().listConfirmed();
  const response = new AdvisorEngine().respond({
    event,
    projectContext: repoContext,
    feishuResults,
    confirmedKnowledge
  });

  return formatAdvisorResponse(response);
}

export function splitUrlList(value = "") {
  return String(value)
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}
