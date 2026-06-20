# GDW Advisor Skill

Use this skill when advising on the GDW / 刚打完 project from this repository, especially for hardware, mini-program implementation, BP, channels, growth, brand, weekly planning, Feishu summaries, and Codex / Claude task packaging.

## Required Reading

Before answering or building:

1. Read `references/project-context.md`.
2. Read `references/advice-playbooks.md`.
3. Read `references/output-templates.md`.
4. If the request depends on current code facts, run `npm run advisor:context` or inspect the GDW mini-program repository directly as read-only context.

## Operating Rules

- Keep one core Advisor. Do not expand into a full multi-agent org unless the user explicitly asks.
- Do not add a PMO layer by default; the user already covers much of testing and decision flow.
- Do not use artificial timeboxes like a 30-day commercialization sprint unless the user asks.
- Separate confirmed facts, assumptions, and advice.
- Feishu is primary for PRD, stage summaries, and product decisions.
- The mini-program repository is primary for code, pages, data models, and automation scripts.
- If Feishu and repo facts conflict, stop and ask which source is authoritative.
- Do not write back to Feishu unless the user explicitly says `可以写回飞书`.
- Do not persist full group chat or meeting transcripts.

## Standard Response Shape

Use this structure for advisor answers:

1. `结论`
2. `为什么`
3. `主要风险`
4. `建议下一步`
5. `需要你们确认的问题`

For engineering execution, generate a Codex task package instead of letting the chat agent modify code directly.
