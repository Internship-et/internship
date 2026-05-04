# LOCAL_DEVELOPMENT.md

> **Setting up the local development environment.**

---

## Prerequisites

- Node.js 20+
- npm 10+
- Docker and Docker Compose
- Git

---

## Initial Setup

```bash
# 1. Clone the repository
git clone <repository-url>
cd internship-platform

# 2. Install dependencies
npm install

# 3. Start infrastructure services (PostgreSQL, Redis)
docker compose up -d postgres redis

# 4. Copy environment variables
cp .env.example .env

# 5. Run database migrations
npx prisma migrate dev

# 6. Seed the database
npx prisma db seed

# 7. Start the development server
npm run dev
```

The API will be available at `http://localhost:3000`.

---

## Development Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload (nodemon) |
| `npm run build` | Build TypeScript to dist/ |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript compiler check |
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |

---

## Docker Commands

```bash
# Start all services (PostgreSQL, Redis, API)
docker compose up -d

# Start only infrastructure
docker compose up -d postgres redis

# View logs
docker compose logs -f api
docker compose logs -f postgres

# Stop all services
docker compose down

# Stop and remove volumes (reset data)
docker compose down -v

# Rebuild API image
docker compose build api
```

---

## Database Management

```bash
# Create a new migration
npx prisma migrate dev --name <description>

# Apply migrations
npx prisma migrate deploy

# Reset database (drop all, re-run all migrations)
npx prisma migrate reset

# Open Prisma Studio (GUI)
npx prisma studio

# Generate Prisma client (after schema changes)
npx prisma generate

# Run seed script
npx prisma db seed
```

---

## Testing

```bash
# Run all tests
npm test

# Run specific test file
npx vitest modules/students/__tests__/student.service.test.ts

# Run tests with coverage
npm run test:coverage
```

---

## Environment Configuration

See `ENVIRONMENT_VARIABLES.md` for all configuration options.

Default development configuration:

```
DATABASE_URL=postgresql://internship:internship_dev@localhost:5432/internship_dev
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-secret-do-not-use-in-production-change-this
```

---

## Troubleshooting

### Port Conflicts

If ports 5432 or 6379 are in use:
1. Change port mappings in `docker-compose.yml`
2. Update `DATABASE_URL` and `REDIS_URL` in `.env`

### Database Connection Failed

1. Ensure PostgreSQL is running: `docker compose ps`
2. Check logs: `docker compose logs postgres`
3. Verify connection string in `.env`

### Migration Issues

1. Reset database: `npx prisma migrate reset`
2. Or create a new migration: `npx prisma migrate dev`

### Redis Connection Failed

1. Ensure Redis is running: `docker compose ps`
2. Check logs: `docker compose logs redis`
3. Verify connection string in `.env`
