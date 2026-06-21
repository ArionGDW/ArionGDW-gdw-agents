import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requiresFeishuWriteConfirmation } from "../core/event-schema.js";

const DEFAULT_FIXTURE = fileURLToPath(new URL("../../../data/mock/feishu-docs.json", import.meta.url));

export class FeishuAdapter {
  constructor(options = {}) {
    this.fixturePath = options.fixturePath || resolveFixturePath(process.env.FEISHU_MOCK_FIXTURE) || DEFAULT_FIXTURE;
    this.writeEnabled = options.writeEnabled ?? process.env.FEISHU_WRITE_ENABLED === "true";
    this.appId = options.appId || process.env.FEISHU_APP_ID || "";
    this.appSecret = options.appSecret || process.env.FEISHU_APP_SECRET || "";
    this.baseUrl = options.baseUrl || process.env.FEISHU_BASE_URL || "https://open.feishu.cn";
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
    this.cachedTenantAccessToken = options.tenantAccessToken || process.env.FEISHU_TENANT_ACCESS_TOKEN || "";
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

  hasCredentials() {
    return Boolean(this.appId && this.appSecret);
  }

  async getTenantAccessToken() {
    if (this.cachedTenantAccessToken) {
      return {
        ok: true,
        token: this.cachedTenantAccessToken,
        source: "env",
        expire: null
      };
    }

    if (!this.hasCredentials()) {
      return {
        ok: false,
        source: "missing_credentials",
        message: "Missing FEISHU_APP_ID or FEISHU_APP_SECRET"
      };
    }

    if (typeof this.fetchImpl !== "function") {
      throw new Error("Fetch API is not available. Use Node.js 18+.");
    }

    const response = await this.fetchImpl(`${this.baseUrl}/open-apis/auth/v3/tenant_access_token/internal`, {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=utf-8"
      },
      body: JSON.stringify({
        app_id: this.appId,
        app_secret: this.appSecret
      })
    });

    const payload = await response.json();
    if (!response.ok || payload.code !== 0) {
      return {
        ok: false,
        source: "feishu_api",
        status: response.status,
        code: payload.code,
        message: payload.msg || payload.message || "Feishu tenant token request failed"
      };
    }

    this.cachedTenantAccessToken = payload.tenant_access_token;
    return {
      ok: true,
      source: "feishu_api",
      token: payload.tenant_access_token,
      expire: payload.expire
    };
  }

  async checkConnection() {
    const tokenResult = await this.getTenantAccessToken();
    if (!tokenResult.ok) return tokenResult;

    return {
      ok: true,
      source: tokenResult.source,
      expire: tokenResult.expire,
      tokenPreview: previewToken(tokenResult.token)
    };
  }

  async readDocumentFromUrl(inputUrl, options = {}) {
    const parsed = parseFeishuDocumentUrl(inputUrl);
    if (parsed.type === "wiki") {
      const node = await this.getWikiNode(parsed.token);
      if (node.obj_type !== "docx") {
        return {
          sourceType: "wiki",
          token: parsed.token,
          title: node.title || "",
          objType: node.obj_type,
          objToken: node.obj_token,
          text: "",
          blocks: [],
          unsupported: true,
          message: `Unsupported wiki object type: ${node.obj_type || "unknown"}`
        };
      }

      const docx = await this.readDocx(node.obj_token, options);
      return {
        ...docx,
        sourceType: "wiki",
        token: parsed.token,
        title: docx.title || node.title || "",
        objType: node.obj_type,
        objToken: node.obj_token,
        wikiNode: node
      };
    }

    if (parsed.type === "docx") {
      return this.readDocx(parsed.token, options);
    }

    throw new Error(`Unsupported Feishu URL type: ${parsed.type}`);
  }

  async getWikiNode(wikiToken) {
    const result = await this.getTenantAccessToken();
    if (!result.ok) {
      throw new Error(`Cannot get Feishu tenant access token: ${result.message}`);
    }

    const url = new URL(`${this.baseUrl}/open-apis/wiki/v2/spaces/get_node`);
    url.searchParams.set("token", wikiToken);
    const payload = await this.fetchFeishuJson(url, result.token);
    const node = payload.data?.node || payload.data || payload.node;
    if (!node) {
      throw new Error("Feishu wiki get_node response did not include node data");
    }
    return node;
  }

  async readDocx(documentId, options = {}) {
    const result = await this.getTenantAccessToken();
    if (!result.ok) {
      throw new Error(`Cannot get Feishu tenant access token: ${result.message}`);
    }

    const document = await this.getDocxInfo(documentId, result.token);
    const rootBlockId = document.root_block_id || document.block_id || document.document_id || documentId;
    const blocks = await this.listDocxChildren(documentId, rootBlockId, result.token, options);
    const text = blocks.map(extractTextFromBlock).filter(Boolean).join("\n");

    return {
      sourceType: "docx",
      token: documentId,
      title: document.title || "",
      objType: "docx",
      objToken: documentId,
      document,
      blocks,
      text
    };
  }

  async getDocxInfo(documentId, tenantAccessToken) {
    const url = new URL(`${this.baseUrl}/open-apis/docx/v1/documents/${encodeURIComponent(documentId)}`);
    const payload = await this.fetchFeishuJson(url, tenantAccessToken);
    return payload.data?.document || payload.data || payload.document || { document_id: documentId };
  }

  async listDocxChildren(documentId, blockId, tenantAccessToken, options = {}) {
    const pageSize = options.pageSize || 500;
    const items = [];
    let pageToken = "";

    do {
      const url = new URL(`${this.baseUrl}/open-apis/docx/v1/documents/${encodeURIComponent(documentId)}/blocks/${encodeURIComponent(blockId)}/children`);
      url.searchParams.set("page_size", String(pageSize));
      if (pageToken) url.searchParams.set("page_token", pageToken);

      const payload = await this.fetchFeishuJson(url, tenantAccessToken);
      const data = payload.data || {};
      items.push(...(data.items || data.children || []));
      pageToken = data.page_token || data.next_page_token || "";
      if (!data.has_more) break;
    } while (pageToken);

    return items;
  }

  async fetchFeishuJson(url, tenantAccessToken, options = {}) {
    if (typeof this.fetchImpl !== "function") {
      throw new Error("Fetch API is not available. Use Node.js 18+.");
    }

    const response = await this.fetchImpl(url, {
      method: options.method || "GET",
      headers: {
        authorization: `Bearer ${tenantAccessToken}`,
        "content-type": "application/json; charset=utf-8",
        ...(options.headers || {})
      },
      body: options.body
    });

    const payload = await response.json();
    if (!response.ok || payload.code !== 0) {
      const message = payload.msg || payload.message || "Feishu API request failed";
      throw new Error(`Feishu API error ${payload.code ?? response.status}: ${message}`);
    }

    return payload;
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

function previewToken(token = "") {
  if (!token) return "";
  if (token.length <= 12) return "***";
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

export function parseFeishuDocumentUrl(inputUrl) {
  const url = new URL(inputUrl);
  const [, type, token] = url.pathname.split("/");

  if (!token) {
    throw new Error("Feishu document URL did not include a token");
  }

  if (type === "wiki") return { type: "wiki", token };
  if (type === "docx") return { type: "docx", token };
  if (type === "docs") return { type: "legacy_doc", token };

  return { type: type || "unknown", token };
}

export function extractTextFromBlock(block) {
  const parts = [];
  collectTextRuns(block, parts);
  return normalizeText(parts.join(""));
}

function collectTextRuns(value, parts) {
  if (!value || typeof value !== "object") return;

  if (value.text_run && typeof value.text_run.content === "string") {
    parts.push(value.text_run.content);
  }

  if (value.equation && typeof value.equation.content === "string") {
    parts.push(value.equation.content);
  }

  for (const item of Array.isArray(value) ? value : Object.values(value)) {
    collectTextRuns(item, parts);
  }
}

function normalizeText(text) {
  return text.replace(/\u0000/g, "").trim();
}
