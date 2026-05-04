# CHECKPOINT 2: Docker Environment

**Prerequisites:** CHECKPOINT_1_MONOREPO ✅

---

## Goal

Set up Docker-based local development environment with PostgreSQL and Redis.

---

## Tasks

### 1. Create Docker Compose

- [ ] Create `docker-compose.yml` with:
  ```yaml
  version: '3.8'
  services:
    postgres:
      image: postgres:16-alpine
      environment:
        POSTGRES_USER: internship
        POSTGRES_PASSWORD: internship_dev
        POSTGRES_DB: internship_dev
      ports:
        - "5432:5432"
      volumes:
        - postgres_data:/var/lib/postgresql/data
  
    redis:
      image: redis:7-alpine
      ports:
        - "6379:6379"
      volumes:
        - redis_data:/data
  
    api:
      build: ./apps/api
      ports:
        - "3000:3000"
      environment:
        DATABASE_URL: postgresql://internship:internship_dev@postgres:5432/internship_dev
        REDIS_URL: redis://redis:6379
      depends_on:
        - postgres
        - redis
  
  volumes:
    postgres_data:
    redis_data:
  ```

### 2. Create Dockerfile

- [ ] Create `apps/api/Dockerfile`:
  ```dockerfile
  FROM node:20-alpine AS base
  WORKDIR /app
  
  FROM base AS deps
  COPY package*.json ./
  RUN npm ci
  
  FROM base AS build
  COPY --from=deps /app/node_modules ./node_modules
  COPY . .
  RUN npm run build
  
  FROM base AS runner
  COPY --from=build /app/dist ./dist
  COPY --from=build /app/node_modules ./node_modules
  EXPOSE 3000
  CMD ["node", "dist/server.js"]
  ```

### 3. Create `.dockerignore`

- [ ] `.dockerignore` with `node_modules`, `dist`, `.git`, `.env`

### 4. Create Container Health Check Scripts

- [ ] `scripts/wait-for-postgres.sh`
- [ ] `scripts/wait-for-redis.sh`

### 5. Verify Setup

- [ ] `docker compose up -d` starts all services
- [ ] PostgreSQL is accessible on port 5432
- [ ] Redis is accessible on port 6379
- [ ] `docker compose down` stops all services

---

## Forbidden Scope

- Do NOT write any application code (no Express routes, services, or middleware)
- Do NOT create a Prisma schema or run migrations
- Do NOT implement business logic

---

## Acceptance Criteria

- [ ] Docker Compose starts PostgreSQL and Redis successfully
- [ ] Containers restart on failure
- [ ] Data persists across restarts (volumes mounted)
- [ ] Ports don't conflict with host

---

## Estimated Time

2 hours
