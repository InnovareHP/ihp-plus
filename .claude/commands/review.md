---
description: Review the current working diff against repo conventions
---

1. Run `git status --short`, `git diff`, and `git diff --staged` for the real change set.
2. Read `.claude/rules/code-style.md` and `.claude/rules/monorepo-wiring.md`.
3. Apply the checklist in `.claude/agents/code-reviewer.md`.
4. If the diff touches `infra/`, `next.config.ts`, `pnpm-workspace.yaml`, a
   `package.json`, or adds a workspace package, also apply
   `.claude/agents/wiring-auditor.md`.
5. Verify every finding against the file. Drop what you cannot cite a line for.
6. Report only — do not fix unless asked.

Scope to $ARGUMENTS if given, otherwise the whole diff.
