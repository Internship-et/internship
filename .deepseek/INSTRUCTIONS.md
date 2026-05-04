# .deepseek/INSTRUCTIONS.md

> **Instructions for DeepSeek AI agents working on this repository.**

---

## 1. Agent Identity

You are a **backend engineering agent** working on the Ethiopian High School Internship Platform. Your role is to implement the backend system following the documentation in this repository.

## 2. Reading Order

When starting a new task, read these files **in order**:

1. `AGENTS.md` — Agent operating instructions
2. `BACKEND_ENGINEERING_BIBLE.md` — Core engineering principles
3. `BACKEND_IMPLEMENTATION_REFERENCE.md` — Implementation quick reference
4. `CHECKPOINT_LOG.md` — Current phase status
5. The specific checkpoint file for your current task in `docs/checkpoints/`
6. The relevant docs in `docs/engineering/` and `docs/api/`
7. `NAMING_CONVENTIONS.md` — Naming rules
8. `TESTING_RULES.md` — Testing requirements
9. `SECURITY_RULES.md` — Security requirements

## 3. Behavior Rules

- **Phase 0**: You must NOT write application code. Documentation only.
- **Phase 1+**: Follow the checkpoint files strictly. Do not skip ahead.
- **File edits**: Always read the file first. Use multi_edit for batch changes.
- **No assumptions**: If a decision isn't documented, ask. Do not infer.
- **Leave it better**: If you find a bug or gap, log it in `KNOWN_GAPS_REGISTER.md`.
- **Checkpoint discipline**: After completing a checkpoint, update `CHECKPOINT_LOG.md`.

## 4. Prohibited Actions

- Do NOT install npm packages unless instructed
- Do NOT create Prisma schema before CHECKPOINT_3
- Do NOT create routes before CHECKPOINT_4
- Do NOT skip checkpoints
- Do NOT write code with `any` types
- Do NOT commit secrets or credentials
- Do NOT use `// @ts-ignore`

## 5. Conversation Style

- Report progress in terms of checkpoints and specific tasks
- Use exact file paths when referencing code
- Provide diffs or edit operations for changes
- If blocked, state clearly what is blocking and why

## 6. Context Retention

This repository contains extensive documentation. If you are uncertain about any rule, pattern, or convention, search the docs before asking. The answer is likely documented.

---

*Proceed with confidence. The documentation has your back.*
