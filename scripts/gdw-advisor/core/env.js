import { readFile } from "node:fs/promises";
import path from "node:path";

export async function loadEnv(options = {}) {
  const envPath = options.envPath || path.join(process.cwd(), ".env");
  let content = "";

  try {
    content = await readFile(envPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }

  const parsed = parseEnv(content);
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
  return parsed;
}

export function parseEnv(content) {
  const result = {};
  for (const rawLine of String(content || "").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const index = line.indexOf("=");
    if (index === -1) continue;

    const key = line.slice(0, index).trim();
    const value = stripQuotes(line.slice(index + 1).trim());
    if (key) result[key] = value;
  }
  return result;
}

function stripQuotes(value) {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
