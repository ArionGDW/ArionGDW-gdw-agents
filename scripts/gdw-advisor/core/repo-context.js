import { access, readFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_PRODUCT_REPO = process.env.GDW_PRODUCT_REPO || "/Users/shiyao/Downloads/网球APP开发";

const DOCS = [
  "docs/product-context.md",
  "docs/project-summary.md",
  "docs/next-context.md",
  "README.md"
];

export class RepoContext {
  constructor(options = {}) {
    this.repoPath = options.repoPath || DEFAULT_PRODUCT_REPO;
  }

  async load() {
    const docs = {};
    for (const relativePath of DOCS) {
      docs[relativePath] = await this.readDoc(relativePath);
    }

    const productContext = docs["docs/product-context.md"]?.content || "";
    const projectSummary = docs["docs/project-summary.md"]?.content || "";
    const nextContext = docs["docs/next-context.md"]?.content || "";

    return {
      repoPath: this.repoPath,
      loadedAt: new Date().toISOString(),
      available: await this.exists(),
      docs,
      facts: extractFacts(productContext, projectSummary, nextContext)
    };
  }

  async exists() {
    try {
      await access(this.repoPath);
      return true;
    } catch {
      return false;
    }
  }

  async readDoc(relativePath) {
    const fullPath = path.join(this.repoPath, relativePath);
    try {
      const content = await readFile(fullPath, "utf8");
      return {
        relativePath,
        fullPath,
        exists: true,
        content
      };
    } catch (error) {
      if (error.code === "ENOENT") {
        return {
          relativePath,
          fullPath,
          exists: false,
          content: ""
        };
      }
      throw error;
    }
  }
}

export function parseFrontmatter(content) {
  if (!content.startsWith("---")) return {};
  const end = content.indexOf("\n---", 3);
  if (end === -1) return {};

  const block = content.slice(3, end).trim();
  const facts = {};
  for (const line of block.split("\n")) {
    const index = line.indexOf(":");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    facts[key] = value;
  }
  return facts;
}

export function extractFacts(productContext, projectSummary, nextContext) {
  const frontmatter = parseFrontmatter(productContext);
  const summaryVersion = matchTableValue(projectSummary, "版本号");
  const summaryStage = matchTableValue(projectSummary, "当前阶段");

  return {
    projectName: frontmatter.projectName || matchTableValue(projectSummary, "项目名称") || "刚打完（GDW）",
    currentVersion: frontmatter.currentVersion || summaryVersion || null,
    stage: frontmatter.stage || summaryStage || null,
    submissionStatus: frontmatter.submissionStatus || matchTableValue(projectSummary, "提审状态") || null,
    primaryGoal: frontmatter.primaryGoal || matchTableValue(projectSummary, "阶段目标") || null,
    strategy: extractBulletAfterHeading(productContext, "当前策略"),
    productDefinition: extractBulletAfterHeading(productContext, "产品定义"),
    scope: extractBulletAfterHeading(productContext, "产品范围"),
    metrics: extractBulletAfterHeading(productContext, "数据与指标"),
    limits: extractBulletAfterHeading(productContext, "当前限制"),
    nextContextPreview: nextContext.trim().slice(0, 800)
  };
}

export function formatRepoContext(context) {
  const facts = context.facts;
  const availableDocs = Object.values(context.docs)
    .filter((doc) => doc.exists)
    .map((doc) => `- ${doc.relativePath}`)
    .join("\n");

  return [
    "# GDW Repo Context",
    "",
    `Repo: ${context.repoPath}`,
    `Loaded: ${context.loadedAt}`,
    `Available: ${context.available ? "yes" : "no"}`,
    "",
    "## Facts",
    "",
    `- Project: ${facts.projectName}`,
    `- Version: ${facts.currentVersion || "unknown"}`,
    `- Stage: ${facts.stage || "unknown"}`,
    `- Goal: ${facts.primaryGoal || "unknown"}`,
    `- Submission: ${facts.submissionStatus || "unknown"}`,
    "",
    "## Documents",
    "",
    availableDocs || "- none"
  ].join("\n");
}

function matchTableValue(content, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\|\\s*${escaped}\\s*\\|\\s*([^|]+?)\\s*\\|`);
  const match = content.match(pattern);
  return match ? match[1].replace(/`/g, "").trim() : null;
}

function extractBulletAfterHeading(content, heading) {
  const headingPattern = new RegExp(`^##\\s+${escapeRegExp(heading)}\\s*$`, "m");
  const match = content.match(headingPattern);
  if (!match) return [];

  const start = match.index + match[0].length;
  const rest = content.slice(start);
  const nextHeading = rest.search(/\n##\s+/);
  const section = nextHeading === -1 ? rest : rest.slice(0, nextHeading);
  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim());
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
