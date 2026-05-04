# CHECKPOINT 0: Preflight

**Prerequisites:** PHASE_0_REPO_SETUP ✅

---

## Goal

Verify that all required tools are installed and the local environment is ready for development.

---

## Tasks

### 1. Verify System Requirements

- [ ] Node.js 20+ is installed (`node --version`)
- [ ] npm 10+ is installed (`npm --version`)
- [ ] Git is installed (`git --version`)
- [ ] Docker is installed (`docker --version`)
- [ ] Docker Compose is installed (`docker compose version`)

### 2. Verify Tooling

- [ ] TypeScript is globally available or project-configured
- [ ] Code editor is configured (VS Code recommended)
- [ ] ESLint and Prettier extensions installed (if using VS Code)

### 3. Initialize Git Repository

- [ ] `git init` in project root
- [ ] Create `.gitignore` with standard Node.js ignores:
  ```
  node_modules/
  dist/
  .env
  .env.local
  *.log
  .DS_Store
  ```
- [ ] Create initial commit: `git add . && git commit -m "chore: initial project setup"`

### 4. Verify Documentation

- [ ] All Phase 0 docs are present and correct
- [ ] CHECKPOINT_LOG.md shows Phase 0 as complete

---

## Forbidden Scope

- Do NOT write any application code (no `.ts` or `.js` files)
- Do NOT create a Prisma schema or run migrations
- Do NOT install npm packages or create `package.json`
- Do NOT create routes, services, or repositories
- Do NOT modify any Phase 0 documentation files

---

## Acceptance Criteria

- [ ] All required tools are verified
- [ ] Git repository is initialized
- [ ] `.gitignore` is set up
- [ ] Initial commit is made
- [ ] Documentation is reviewed and confirmed

---

## Estimated Time

30 minutes
