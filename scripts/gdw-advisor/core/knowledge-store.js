import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { canPersist, validateEvent } from "./event-schema.js";

export class KnowledgeStore {
  constructor(options = {}) {
    this.rootDir = options.rootDir || process.cwd();
    this.confirmedDir = options.confirmedDir || path.join(this.rootDir, "data", "confirmed");
    this.snapshotsDir = options.snapshotsDir || path.join(this.rootDir, "data", "snapshots");
  }

  async saveConfirmed(event) {
    const validEvent = validateEvent(event);
    if (!canPersist(validEvent)) {
      throw new Error("Refusing to persist unconfirmed advisor event");
    }

    await mkdir(this.confirmedDir, { recursive: true });
    const filename = `${safeTimestamp(validEvent.occurredAt)}-${validEvent.artifactType}-${validEvent.id}.json`;
    const filepath = path.join(this.confirmedDir, filename);
    await writeFile(filepath, `${JSON.stringify(validEvent, null, 2)}\n`, "utf8");
    return filepath;
  }

  async listConfirmed() {
    let files = [];
    try {
      files = await readdir(this.confirmedDir);
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }

    const jsonFiles = files.filter((file) => file.endsWith(".json")).sort();
    const events = [];
    for (const file of jsonFiles) {
      const content = await readFile(path.join(this.confirmedDir, file), "utf8");
      events.push(JSON.parse(content));
    }
    return events;
  }

  async saveSnapshot(snapshot, name = "context") {
    await mkdir(this.snapshotsDir, { recursive: true });
    const occurredAt = new Date().toISOString();
    const filepath = path.join(this.snapshotsDir, `${safeTimestamp(occurredAt)}-${slug(name)}.json`);
    const payload = {
      name,
      createdAt: occurredAt,
      snapshot
    };
    await writeFile(filepath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    return filepath;
  }
}

function safeTimestamp(value) {
  return value.replace(/[:.]/g, "-");
}

function slug(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "snapshot";
}
