# CODEX_EXECUTION_RULES.md

> **Rules for AI coding agents executing implementation tasks.** This is the operational companion to `AGENTS.md`.

---

## 1. Execution Mode

### 1.1 Checkpoint-Locked

The agent operates in **checkpoint-locked** mode. Only the current checkpoint's tasks can be implemented. The agent must:
- Read the current checkpoint spec (`docs/checkpoints/CHECKPOINT_X_*.md`)
- Execute only the tasks listed in that spec
- Not add scope, not skip steps, not pre-implement future work

### 1.2 Completion Check

Before marking a checkpoint complete:
- [ ] All tasks in the spec are implemented
- [ ] Tests pass (if applicable)
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] `CHECKPOINT_LOG.md` is updated
- [ ] Any gaps are logged in `KNOWN_GAPS_REGISTER.md`

### 1.3 Blocked Protocol

If blocked:
1. Document the blocker in `KNOWN_GAPS_REGISTER.md`
2. State the blocker clearly
3. Propose options to resolve
4. Do NOT proceed past the blocker

---

## 2. Code Modification Rules

### 2.1 Read Before Write

Always read a file before modifying it. Use `read_file` to get current contents.

### 2.2 Single Responsibility

Each file has one responsibility. If a file is growing beyond ~200 lines, consider splitting.

### 2.3 Import Rules

- Use TypeScript path aliases (`@/` for `src/`)
- No circular imports
- No barrel files (`index.ts`) that cause unnecessary coupling

### 2.4 Error Handling

- Every service function validates inputs and throws typed errors
- Routes never handle errors directly (use `asyncHandler`)
- The global error handler catches everything

---

## 3. Commit Discipline

Each checkpoint produces one or more commits:
```
feat(module): implement checkpoint X functionality
```

Commit messages follow conventional commits format.

---

## 4. Order of Operations

When starting a new checkpoint:

1. **Read** the checkpoint spec
2. **Read** all files that will be modified
3. **Plan** the implementation
4. **Implement** in order: types → schemas → errors → repository → service → middleware → routes
5. **Test** (when applicable)
6. **Verify** no TypeScript/lint errors
7. **Update** CHECKPOINT_LOG.md
8. **Report** completion

---

## 5. Agent Boundaries

- The agent may create/edit any file in the project
- The agent may run terminal commands (npm, git, docker, prisma)
- The agent must NOT modify `docs/engineering/CODEX_EXECUTION_RULES.md` without approval
- The agent must NOT modify checkpoint files retroactively
