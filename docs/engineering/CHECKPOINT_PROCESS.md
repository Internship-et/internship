# CHECKPOINT_PROCESS.md

> **How checkpoints work.** This defines the lifecycle of a checkpoint from start to completion.

---

## 1. What is a Checkpoint?

A checkpoint is a discrete, self-contained unit of work. Each checkpoint:
- Has a clear goal (e.g., "Set up Prisma schema")
- Has a defined scope (no scope creep)
- Has acceptance criteria
- Can be completed independently
- Updates the project state forward

---

## 2. Checkpoint Lifecycle

```
┌─────────────┐
│  PENDING    │  ← Not started
├─────────────┤
│  IN PROGRESS│  ← Currently being worked on
├─────────────┤
│  COMPLETE   │  ← All tasks done, verified
├─────────────┤
│  BLOCKED    │  ← Cannot proceed, logged in KNOWN_GAPS
└─────────────┘
```

---

## 3. Starting a Checkpoint

1. Read `CHECKPOINT_LOG.md` to confirm current state
2. Locate the checkpoint spec in `docs/checkpoints/CHECKPOINT_X_*.md`
3. Read the spec completely
4. Set CHECKPOINT_LOG.md status to `IN PROGRESS`
5. Begin implementation

---

## 4. Completing a Checkpoint

### 4.1 Verification Checklist

- [ ] All tasks in the spec are implemented
- [ ] No TypeScript compilation errors
- [ ] No lint errors
- [ ] Tests pass (existing and new)
- [ ] Coverage meets threshold (if applicable)
- [ ] `CHECKPOINT_LOG.md` updated to `✅ COMPLETE`
- [ ] Any gaps documented in `KNOWN_GAPS_REGISTER.md`

### 4.2 Blockers

If a checkpoint cannot be completed:
1. Log the blocker in `KNOWN_GAPS_REGISTER.md`
2. Set status to `BLOCKED` in `CHECKPOINT_LOG.md`
3. Document: what is blocked, why, what options exist, who to notify

---

## 5. Dependencies

```
CHECKPOINT_0 (Preflight)
      ↓
CHECKPOINT_1 (Monorepo Setup)
      ↓
CHECKPOINT_2 (Docker Environment)
      ↓
CHECKPOINT_3 (Prisma Schema)
      ↓
CHECKPOINT_4 (API Shell)
      ↓
CHECKPOINT_5 (Core Utilities)
      ↓
CHECKPOINT_6 (Validation Schemas)
      ↓
CHECKPOINT_7 (Auth System)
      ↓
CHECKPOINT_8 (Rate Limiting)
      ↓
CHECKPOINTS 9-14 (Modules — can be parallel)
      ↓
CHECKPOINT_15 (Tests)
      ↓
CHECKPOINT_16 (Production Readiness)
      ↓
CHECKPOINT_17 (Staging Remediation)
```

---

## 6. Checkpoint Files

Each checkpoint has a spec file in `docs/checkpoints/`:

```
docs/checkpoints/
├── PHASE_0_REPO_SETUP.md
├── CHECKPOINT_0_PREFLIGHT.md
├── CHECKPOINT_1_MONOREPO.md
├── CHECKPOINT_2_DOCKER_ENV.md
├── CHECKPOINT_3_PRISMA.md
├── CHECKPOINT_4_API_SHELL.md
├── CHECKPOINT_5_CORE_UTILITIES.md
├── CHECKPOINT_6_VALIDATION.md
├── CHECKPOINT_7_AUTH.md
├── CHECKPOINT_8_RATE_LIMITING.md
├── CHECKPOINT_9_STUDENTS.md
├── CHECKPOINT_10_COMPANIES.md
├── CHECKPOINT_11_INTERNSHIPS.md
├── CHECKPOINT_12_APPLICATIONS.md
├── CHECKPOINT_13_SCHOOLS.md
├── CHECKPOINT_14_ADMIN.md
├── CHECKPOINT_15_TESTS.md
├── CHECKPOINT_16_PRODUCTION_READINESS.md
└── CHECKPOINT_17_STAGING_REMEDIATION.md
```

---

*Follow this process strictly. Checkpoints are the heartbeat of the project.*
