#!/usr/bin/env node

import { AdvisorEngine, formatAdvisorResponse } from "./core/advisor-engine.js";
import { KnowledgeStore } from "./core/knowledge-store.js";
import { RepoContext, formatRepoContext } from "./core/repo-context.js";
import { ChannelAdapter } from "./adapters/channel-adapter.js";
import { FeishuAdapter } from "./adapters/feishu-adapter.js";

async function main(argv = process.argv.slice(2)) {
  const command = argv[0] || "help";
  const rest = argv.slice(1);

  if (command === "simulate") {
    await simulate(rest);
    return;
  }

  if (command === "context") {
    await printContext(rest);
    return;
  }

  if (command === "feishu:search") {
    await searchFeishu(rest);
    return;
  }

  printHelp();
}

async function simulate(argv) {
  const message = optionValue(argv, "--message") || positional(argv).join(" ") || "@GDW Advisor 建议: V1.2 本周怎么推进？";
  const channel = new ChannelAdapter();
  const event = channel.toEvent({
    text: message,
    source: "wecom",
    actor: "local-cli",
    threadId: "local-sim"
  });

  const repoContext = await new RepoContext().load();
  const feishu = new FeishuAdapter();
  const feishuResults = await feishu.search(event.text || message);
  const confirmedKnowledge = await new KnowledgeStore().listConfirmed();
  const response = new AdvisorEngine().respond({
    event,
    projectContext: repoContext,
    feishuResults,
    confirmedKnowledge
  });

  console.log(formatAdvisorResponse(response));
}

async function printContext(argv) {
  const asJson = argv.includes("--json");
  const repoContext = await new RepoContext().load();
  if (asJson) {
    console.log(JSON.stringify(repoContext, null, 2));
    return;
  }
  console.log(formatRepoContext(repoContext));
}

async function searchFeishu(argv) {
  const query = optionValue(argv, "--query") || positional(argv).join(" ");
  const results = await new FeishuAdapter().search(query);

  if (!results.length) {
    console.log("No Feishu mock documents matched.");
    return;
  }

  for (const result of results) {
    console.log(`# ${result.title}`);
    console.log(`id: ${result.id}`);
    console.log(`updatedAt: ${result.updatedAt}`);
    console.log(`tags: ${result.tags.join(", ") || "none"}`);
    console.log(result.snippet);
    console.log("");
  }
}

function printHelp() {
  console.log(`GDW Advisor CLI

Usage:
  npm run advisor:context
  npm run advisor:simulate -- --message "@GDW Advisor 建议: V1.2 本周怎么推进？"
  npm run advisor:feishu:search -- V1.2
`);
}

function optionValue(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return null;
  return argv[index + 1] || "";
}

function positional(argv) {
  const values = [];
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value.startsWith("--")) {
      index += 1;
      continue;
    }
    values.push(value);
  }
  return values;
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
