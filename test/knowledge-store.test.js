import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createEvent } from "../scripts/gdw-advisor/core/event-schema.js";
import { KnowledgeStore } from "../scripts/gdw-advisor/core/knowledge-store.js";

test("refuses to persist unconfirmed events", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "gdw-store-"));
  const store = new KnowledgeStore({ rootDir });
  const event = createEvent({
    artifactType: "advice_request",
    writePolicy: "ephemeral",
    text: "temporary discussion"
  });

  await assert.rejects(() => store.saveConfirmed(event), /Refusing to persist/);
});

test("persists confirmed decision events", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "gdw-store-"));
  const store = new KnowledgeStore({ rootDir });
  const event = createEvent({
    artifactType: "decision",
    writePolicy: "confirmed_decision",
    text: "本周验证 Session 分享闭环",
    actor: "allen",
    confirmed: true
  });

  const filepath = await store.saveConfirmed(event);
  const saved = JSON.parse(await readFile(filepath, "utf8"));

  assert.equal(saved.text, "本周验证 Session 分享闭环");
  assert.equal(saved.confirmed, true);
});
