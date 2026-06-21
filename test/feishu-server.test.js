import test from "node:test";
import assert from "node:assert/strict";
import {
  extractMessageText,
  handleChallenge,
  isMessageReceiveEvent
} from "../scripts/gdw-advisor/server.js";
import {
  normalizeMessageEvent,
  shouldHandleMessage
} from "../scripts/gdw-advisor/longconn.js";

test("handles Feishu URL verification challenge", () => {
  const challenge = handleChallenge({
    header: { event_type: "url_verification" },
    event: { challenge: "abc123", token: "verify-token" }
  }, "verify-token");

  assert.equal(challenge, "abc123");
});

test("rejects invalid Feishu verification token", () => {
  assert.throws(() => handleChallenge({
    header: { event_type: "url_verification" },
    event: { challenge: "abc123", token: "wrong-token" }
  }, "verify-token"), /token mismatch/);
});

test("detects receive message event", () => {
  assert.equal(isMessageReceiveEvent({
    header: { event_type: "im.message.receive_v1" }
  }), true);
});

test("extracts text message content", () => {
  const text = extractMessageText({
    message_type: "text",
    content: JSON.stringify({ text: "@GDW Advisor 建议: 本周怎么排？" })
  });

  assert.equal(text, "@GDW Advisor 建议: 本周怎么排？");
});

test("normalizes Feishu long-connection message event", () => {
  const incoming = normalizeMessageEvent({
    sender: {
      sender_type: "user",
      sender_id: { open_id: "ou_mock" }
    },
    message: {
      message_id: "om_mock",
      chat_id: "oc_mock",
      chat_type: "p2p",
      message_type: "text",
      content: JSON.stringify({ text: "本周怎么推进？" })
    }
  });

  assert.deepEqual(incoming, {
    eventId: null,
    messageId: "om_mock",
    chatId: "oc_mock",
    chatType: "p2p",
    text: "本周怎么推进？",
    messageType: "text",
    senderType: "user",
    actor: "ou_mock"
  });
});

test("ignores app-origin Feishu long-connection messages", () => {
  assert.equal(shouldHandleMessage({
    messageId: "om_app",
    chatId: "oc_mock",
    text: "机器人自己发出的消息",
    senderType: "app"
  }), false);
});
