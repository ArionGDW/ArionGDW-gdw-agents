#!/usr/bin/env node

import * as Lark from "@larksuiteoapi/node-sdk";
import { FeishuAdapter } from "./adapters/feishu-adapter.js";
import { buildAdvisorReply } from "./core/advisor-reply.js";
import { loadEnv } from "./core/env.js";

const handledMessageIds = new Set();

export function extractMessageText(message = {}) {
  if (message.message_type !== "text") {
    return `[非文本消息: ${message.message_type || "unknown"}]`;
  }

  try {
    const content = JSON.parse(message.content || "{}");
    return content.text || "";
  } catch {
    return message.content || "";
  }
}

export function normalizeMessageEvent(data = {}) {
  const message = data.message || data.event?.message || {};
  const sender = data.sender || data.event?.sender || {};
  const senderId = sender.sender_id || {};
  return {
    eventId: data.event_id || data.header?.event_id || null,
    messageId: message.message_id || null,
    chatId: message.chat_id || null,
    chatType: message.chat_type || null,
    text: extractMessageText(message).trim(),
    messageType: message.message_type || "unknown",
    senderType: sender.sender_type || "unknown",
    actor: senderId.open_id || senderId.user_id || senderId.union_id || "feishu-user"
  };
}

export function shouldHandleMessage(incoming) {
  if (!incoming.chatId || !incoming.text) return false;
  if (incoming.senderType === "app" || incoming.senderType === "bot") return false;
  if (incoming.messageId && handledMessageIds.has(incoming.messageId)) return false;
  if (incoming.messageId) handledMessageIds.add(incoming.messageId);
  return true;
}

async function handleIncomingMessage(incoming) {
  const startedAt = Date.now();
  const advisorText = await buildAdvisorReply(incoming.text, {
    actor: incoming.actor,
    threadId: incoming.chatId,
    messageId: incoming.messageId,
    source: "feishu"
  });

  await new FeishuAdapter().sendTextMessage(incoming.chatId, advisorText, {
    receiveIdType: "chat_id"
  });
  console.log(`Replied to Feishu chat ${incoming.chatId} in ${Date.now() - startedAt}ms`);
}

async function main() {
  await loadEnv();
  const appId = process.env.FEISHU_APP_ID || "";
  const appSecret = process.env.FEISHU_APP_SECRET || "";
  if (!appId || !appSecret) {
    throw new Error("Missing FEISHU_APP_ID or FEISHU_APP_SECRET in .env");
  }

  const wsClient = new Lark.WSClient({
    appId,
    appSecret,
    loggerLevel: Lark.LoggerLevel.info
  });

  await wsClient.start({
    eventDispatcher: new Lark.EventDispatcher({}).register({
      "im.message.receive_v1": (data) => {
        const incoming = normalizeMessageEvent(data);
        if (!shouldHandleMessage(incoming)) return;

        console.log(`Received Feishu message ${incoming.messageId || "(no id)"} from ${incoming.actor}`);
        handleIncomingMessage(incoming).catch((error) => {
          console.error("Failed to handle Feishu long-connection message:", error.stack || error.message);
        });
      }
    })
  });

  console.log("GDW Advisor Feishu long connection started. Send a message to the bot in Feishu.");
}

if (isDirectRun()) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

function isDirectRun() {
  return process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href;
}
