# Docker Production Guide

> **How to build, tag, and deploy Docker images to production.**

---

## 1. Building the Image

### 1.1 Development Build

```bash
# Build from project root
docker build -f apps/api/Dockerfile -t internship-api:latest .
```

### 1.2 Production Build

```bash
# Tag with version (from apps/api/package.json)
VERSION=$(node -p "require('./apps/api/package.json').version")
docker build -f apps/api/Dockerfile \
  -t internship-api:${VERSION} \
  -t internship-api:latest \
  .

# Multi-platform build (for arm64/aarch64 servers)
docker buildx build -f apps/api/Dockerfile \
  --platform linux/amd64,linux/arm64 \
  -t internship-api:latest \
  .
```

---

## 2. Image Tags

| Tag | Meaning | When to Use |
|-----|---------|-------------|
| `internship-api:latest` | Latest stable build | Development, staging |
| `internship-api:0.1.0` | Specific version (semver) | Production deployment |
| `registry.example.com/internship-api:v0.1.0` | Registry-tagged version | Production with registry |
| `internship-api:commit-abc123` | Git SHA tag | Debugging, traceability |

---

## 3. Image Registry

### 3.1 Push to Registry

```bash
# Tag for your registry
docker tag internship-api:latest registry.example.com/internship-api:v0.1.0

# Push to registry
docker push registry.example.com/internship-api:v0.1.0

# Also push latest tag
docker tag internship-api:latest registry.example.com/internship-api:latest
docker push registry.example.com/internship-api:latest
```

### 3.2 Registry Authentication

```bash
# Login before push
docker login registry.example.com

# Or use CI credentials (GitHub Container Registry example)
echo $GHCR_TOKEN | docker login ghcr.io -u $GITHUB_ACTOR --password-stdin
```

---

## 4. Deploying with Docker

### 4.1 Single Instance

```bash
# Pull the latest image
docker pull registry.example.com/internship-api:latest

# Stop and remove old container
docker stop internship-api || true
docker rm internship-api || true

# Run new container
docker run -d \
  --name internship-api \
  --restart unless-stopped \
  --network prod-network \
  -p 3000:3000 \
  --env-file .env.prod \
  registry.example.com/internship-api:latest

# Verify deployment
sleep 5
curl -f http://localhost:3000/health/live
```

### 4.2 Blue-Green Deployment

```bash
# Deploy new version to "green" slot
docker run -d \
  --name internship-api-green \
  --restart unless-stopped \
  --network prod-network \
  -p 3001:3000 \
  --env-file .env.prod \
  registry.example.com/internship-api:v0.1.1

# Run smoke tests
curl -f http://localhost:3001/health
# ... additional smoke tests ...

# Switch traffic to green
# (Update reverse proxy / load balancer config)

# Remove old "blue" container
docker stop internship-api || true
docker rm internship-api || true

# Rename green to blue
docker rename internship-api-green internship-api
```

---

## 5. Container Health Checks

The Dockerfile includes a `HEALTHCHECK` instruction:

```
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health/live || exit 1
```

- **Interval:** Check every 30 seconds
- **Timeout:** Fail if no response in 3 seconds
- **Start period:** Wait 5 seconds before first check (allows startup)
- **Retries:** Mark unhealthy after 3 consecutive failures
- **Command:** `wget ... --spider` — makes a HEAD request (no body download)

### 5.1 Viewing Health Status

```bash
# Check container health
docker inspect --format='{{.State.Health.Status}}' internship-api

# View health check logs
docker inspect --format='{{json .State.Health}}' internship-api | jq
```

---

## 6. Production Docker Compose

> **Do NOT use `docker-compose.yml` as-is for production.**
> The root `docker-compose.yml` is optimized for local development.

For production, create environment-specific compose overrides or deploy with Docker run commands directly. Key differences:

| Aspect | Development | Production |
|--------|-------------|------------|
| Ports | Exposed directly | Behind reverse proxy |
| Volumes | Bind mounts (hot reload) | Named volumes |
| Environment | `.env.dev` | `.env.prod` |
| Restart | No restart | `unless-stopped` |
| Network | Default bridge | Custom overlay (swarm) |
| Scaling | Single instance | Multiple replicas |

---

## 7. Common Tasks

### 7.1 View Logs

```bash
# Follow logs
docker logs -f internship-api

# Last 100 lines with timestamps
docker logs --tail=100 -t internship-api

# Filter by log level
docker logs internship-api 2>&1 | grep '"level":"error"'
```

### 7.2 Execute Commands

```bash
# Run a shell inside the container
docker exec -it internship-api sh

# Check Node.js version
docker exec internship-api node --version

# Check environment variables
docker exec internship-api env
```

### 7.3 Update Container

```bash
# Pull, stop, remove, run (all in sequence)
docker pull registry.example.com/internship-api:latest && \
docker stop internship-api && \
docker rm internship-api && \
docker run -d --name internship-api --restart unless-stopped \
  -p 3000:3000 --env-file .env.prod \
  registry.example.com/internship-api:latest
```

---

## 8. Security Notes

- The container runs as `appuser` (non-root), not `root`
- `NODE_ENV=production` is set in the image (cannot be overridden accidentally)
- `HEALTHCHECK` ensures container orchestration can detect failures
- Do not mount the Docker socket in production containers
- Use read-only root filesystem if possible: `--read-only --tmpfs /tmp --tmpfs /var/tmp`

---

*Build once, deploy anywhere. Always verify the HEALTHCHECK before routing traffic.*
