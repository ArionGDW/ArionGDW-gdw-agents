import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requiresFeishuWriteConfirmation } from "../core/event-schema.js";

const DEFAULT_FIXTURE = fileURLToPath(new URL("../../../data/mock/feishu-docs.json", import.meta.url));

export class FeishuAdapter {
  constructor(options = {}) {
    this.fixturePath = options.fixturePath || resolveFixturePath(process.env.FEISHU_MOCK_FIXTURE) || DEFAULT_FIXTURE;
    this.writeEnabled = options.writeEnabled ?? process.env.FEISHU_WRITE_ENABLED === "true";
  }

  async search(query, options = {}) {
    const limit = options.limit || 5;
    const docs = await this.loadMockDocs();
    const normalizedQuery = String(query || "").trim().toLowerCase();

    if (!normalizedQuery) {
      return docs.slice(0, limit).map((doc) => toSearchResult(doc, normalizedQuery));
    }

    const matches = docs.map((doc) => {
      const haystack = [
        doc.title,
        doc.content,
        ...(doc.tags || [])
      ].join("\n").toLowerCase();
      return {
        doc,
        score: scoreMatch(haystack, normalizedQuery)
      };
    }).filter((match) => match === true || match.score > 0);

    return matches
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, limit)
      .map((match) => toSearchResult(match.doc, normalizedQuery));
  }

  async loadMockDocs() {
    const content = await readFile(this.fixturePath, "utf8");
    const parsed = JSON.parse(content);
    return Array.isArray(parsed.documents) ? parsed.documents : [];
  }

  buildWriteDraft(input = {}) {
    const confirmationText = input.confirmationText || "";
    const allowedByUser = requiresFeishuWriteConfirmation(confirmationText);

    if (!allowedByUser) {
      return {
        status: "blocked",
        allowed: false,
        reason: "写回飞书需要明确确认：可以写回飞书"
      };
    }

    return {
      status: this.writeEnabled ? "ready_for_live_write" : "draft_ready",
      allowed: true,
      liveWriteEnabled: this.writeEnabled,
      target: input.target || "manual-review",
      title: input.title || "GDW Advisor 写回草稿",
      content: input.content || "",
      createdAt: new Date().toISOString(),
      warning: this.writeEnabled ? null : "FEISHU_WRITE_ENABLED=false，当前只生成草稿，不调用真实飞书 API"
    };
  }
}

export function extractFactsFromDocs(docs) {
  const facts = {};
  for (const doc of docs || []) {
    Object.assign(facts, doc.facts || {});
  }
  return facts;
}

export function detectFactConflicts(repoFacts = {}, feishuFacts = {}) {
  const keys = ["currentVersion", "stage", "primaryGoal"];
  return keys
    .filter((key) => repoFacts[key] && feishuFacts[key] && repoFacts[key] !== feishuFacts[key])
    .map((key) => ({
      key,
      repo: repoFacts[key],
      feishu: feishuFacts[key]
    }));
}

function resolveFixturePath(value) {
  if (!value) return null;
  return path.isAbsolute(value) ? value : path.join(process.cwd(), value);
}

function toSearchResult(doc, query) {
  return {
    id: doc.id,
    title: doc.title,
    type: doc.type || "doc",
    source: "feishu_mock",
    updatedAt: doc.updatedAt,
    tags: doc.tags || [],
    snippet: createSnippet(doc.content, query),
    facts: doc.facts || {},
    content: doc.content
  };
}

function createSnippet(content = "", query = "") {
  const compact = content.replace(/\s+/g, " ").trim();
  if (!query) return compact.slice(0, 180);

  const index = compact.toLowerCase().indexOf(query);
  if (index === -1) return compact.slice(0, 180);

  const start = Math.max(0, index - 60);
  const end = Math.min(compact.length, index + query.length + 120);
  return compact.slice(start, end);
}

function scoreMatch(haystack, query) {
  if (haystack.includes(query)) return 100;
  const tokens = query
    .split(/[\s:：,，。？?！!；;、/]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);

  return tokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
}
