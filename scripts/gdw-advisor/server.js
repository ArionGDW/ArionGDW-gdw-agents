#!/usr/bin/env node

import http from "node:http";
import { FeishuAdapter } from "./adapters/feishu-adapter.js";
import { buildAdvisorReply } from "./core/advisor-reply.js";
import { loadEnv } from "./core/env.js";

await loadEnv();

const port = Number(process.env.FEISHU_EVENT_PORT || 8787);
const verificationToken = process.env.FEISHU_VERIFICATION_TOKEN || "";

export const server = http.createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/health") {
      sendJson(response, 200, { ok: true, service: "gdw-advisor-feishu" });
      return;
    }

    if (request.method === "POST" && request.url === "/feishu/events") {
      const payload = await readJson(request);
      const challenge = handleChallenge(payload, verificationToken);
      if (challenge) {
        sendJson(response, 200, { challenge });
        return;
      }

      if (isMessageReceiveEvent(payload)) {
        sendJson(response, 200, { ok: true });
        handleMessageEvent(payload).catch((error) => {
          console.error("Failed to handle Feishu message event:", error.stack || error.message);
        });
        return;
      }

      sendJson(response, 200, { ok: true, ignored: true });
      return;
    }

    sendJson(response, 404, { ok: false, error: "not_found" });
  } catch (error) {
    console.error(error.stack || error.message);
    sendJson(response, 500, { ok: false, error: "internal_error" });
  }
});

if (isDirectRun()) {
  server.listen(port, () => {
    console.log(`GDW Advisor Feishu event server listening on http://127.0.0.1:${port}`);
    console.log(`Health: http://127.0.0.1:${port}/health`);
    console.log(`Feishu event path: /feishu/events`);
  });
}

export function handleChallenge(payload, expectedToken = "") {
  const token = payload?.token || payload?.event?.token;
  if (expectedToken && token && token !== expectedToken) {
    throw new Error("Feishu verification token mismatch");
  }

  if (payload?.challenge) return payload.challenge;
  if (payload?.type === "url_verification" && payload?.challenge) return payload.challenge;
  if (payload?.header?.event_type === "url_verification" && payload?.event?.challenge) {
    return payload.event.challenge;
  }
  return null;
}

export function isMessageReceiveEvent(payload) {
  return payload?.header?.event_type === "im.message.receive_v1";
}

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

async function handleMessageEvent(payload) {
  const event = payload.event || {};
  const message = event.message || {};
  const chatId = message.chat_id;
  const text = extractMessageText(message).trim();
  if (!chatId || !text) return;

  const advisorText = await buildAdvisorReply(text, {
    actor: event.sender?.sender_id?.open_id || "feishu-user",
    threadId: chatId,
    messageId: message.message_id
  });

  await new FeishuAdapter().sendTextMessage(chatId, advisorText, {
    receiveIdType: "chat_id"
  });
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        reject(new Error("Request body too large"));
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
}

function isDirectRun() {
  return process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href;
}
