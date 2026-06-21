import test from "node:test";
import assert from "node:assert/strict";
import {
  FeishuAdapter,
  extractTextFromBlock,
  parseFeishuDocumentUrl
} from "../scripts/gdw-advisor/adapters/feishu-adapter.js";

test("searches mock Feishu documents", async () => {
  const adapter = new FeishuAdapter();
  const results = await adapter.search("V1.2");

  assert.ok(results.length >= 1);
  assert.equal(results[0].source, "feishu_mock");
});

test("blocks write draft without explicit confirmation", () => {
  const adapter = new FeishuAdapter();
  const draft = adapter.buildWriteDraft({
    title: "测试",
    content: "内容"
  });

  assert.equal(draft.allowed, false);
  assert.match(draft.reason, /可以写回飞书/);
});

test("creates write draft with explicit confirmation", () => {
  const adapter = new FeishuAdapter({ writeEnabled: false });
  const draft = adapter.buildWriteDraft({
    title: "测试",
    content: "内容",
    confirmationText: "可以写回飞书"
  });

  assert.equal(draft.allowed, true);
  assert.equal(draft.status, "draft_ready");
});

test("checks Feishu connection with mocked tenant token request", async () => {
  const adapter = new FeishuAdapter({
    appId: "cli_mock",
    appSecret: "secret_mock",
    fetchImpl: async (url, options) => {
      assert.match(url, /tenant_access_token\/internal$/);
      assert.equal(options.method, "POST");
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            code: 0,
            tenant_access_token: "t-1234567890abcdef",
            expire: 7200
          };
        }
      };
    }
  });

  const result = await adapter.checkConnection();
  assert.equal(result.ok, true);
  assert.equal(result.source, "feishu_api");
  assert.equal(result.expire, 7200);
  assert.match(result.tokenPreview, /^t-1234/);
});

test("parses Feishu wiki URL", () => {
  const parsed = parseFeishuDocumentUrl("https://example.feishu.cn/wiki/OFFtwSEIeiUjQjkXZjJcqdNVnSf?from=from_copylink");
  assert.deepEqual(parsed, {
    type: "wiki",
    token: "OFFtwSEIeiUjQjkXZjJcqdNVnSf"
  });
});

test("extracts text runs from docx block", () => {
  const text = extractTextFromBlock({
    block_type: 2,
    text: {
      elements: [
        { text_run: { content: "hello" } },
        { text_run: { content: " world" } }
      ]
    }
  });

  assert.equal(text, "hello world");
});

test("reads wiki-backed docx with mocked Feishu APIs", async () => {
  const calls = [];
  const adapter = new FeishuAdapter({
    appId: "cli_mock",
    appSecret: "secret_mock",
    fetchImpl: async (url, options) => {
      const href = String(url);
      calls.push(href);
      if (href.includes("/tenant_access_token/internal")) {
        return jsonResponse({
          code: 0,
          tenant_access_token: "t-1234567890abcdef",
          expire: 7200
        });
      }
      assert.match(options.headers.authorization, /^Bearer /);
      if (href.includes("/wiki/v2/spaces/get_node")) {
        return jsonResponse({
          code: 0,
          data: {
            node: {
              title: "GDW Advisor 测试文档",
              obj_type: "docx",
              obj_token: "docx_mock_token"
            }
          }
        });
      }
      if (href.includes("/docx/v1/documents/docx_mock_token/blocks/docx_mock_token/children")) {
        return jsonResponse({
          code: 0,
          data: {
            items: [
              {
                block_type: 2,
                text: {
                  elements: [{ text_run: { content: "这是测试文档" } }]
                }
              }
            ],
            has_more: false
          }
        });
      }
      if (href.includes("/docx/v1/documents/docx_mock_token")) {
        return jsonResponse({
          code: 0,
          data: {
            document: {
              title: "GDW Advisor 测试文档",
              document_id: "docx_mock_token"
            }
          }
        });
      }
      throw new Error(`Unexpected URL: ${href}`);
    }
  });

  const result = await adapter.readDocumentFromUrl("https://example.feishu.cn/wiki/wiki_mock_token");
  assert.equal(result.title, "GDW Advisor 测试文档");
  assert.equal(result.objToken, "docx_mock_token");
  assert.equal(result.text, "这是测试文档");
  assert.equal(calls.length, 4);
});

function jsonResponse(payload) {
  return {
    ok: true,
    status: 200,
    async json() {
      return payload;
    }
  };
}
