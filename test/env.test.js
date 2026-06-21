import test from "node:test";
import assert from "node:assert/strict";
import { parseEnv } from "../scripts/gdw-advisor/core/env.js";

test("parses simple dotenv content", () => {
  const env = parseEnv(`
# comment
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET="secret value"
EMPTY=
`);

  assert.equal(env.FEISHU_APP_ID, "cli_xxx");
  assert.equal(env.FEISHU_APP_SECRET, "secret value");
  assert.equal(env.EMPTY, "");
});
