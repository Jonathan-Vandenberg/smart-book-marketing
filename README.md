# Smart Book Marketing

Agentic marketing, analytics, and dashboard for **[Smart Book Planner](https://www.smartbookplanner.com)**.

**Deployed on the same DigitalOcean server** as the main app, at **`marketing.smartbookplanner.com`** (port 3001).

## Quick start (local)

```bash
cp .env.example .env
npm install
npm run dev              # http://localhost:3001
npm run agents:run-once
```

## Deploy

Full steps: **[PLAN.md](./PLAN.md)**

### Branches

| Branch | Deploys? | Use for |
|--------|----------|---------|
| `dev` | No | Day-to-day development |
| `qa` | No | Pre-release review |
| `main` | Yes → production | Stable releases only |

Flow: `dev` → merge to `qa` → merge to `main` (triggers deploy to marketing.smartbookplanner.com).

**GitHub Actions:** only `main` — push triggers **Deploy to Production** (build + typecheck + deploy). Use **Actions → Deploy to Production → Run workflow** for a manual redeploy.

**Manual deploy:**
```bash
DO_HOST=209.97.163.64 DO_USER=root DO_KEY=~/.ssh/your_key ./scripts/deploy.sh
```

## Server layout (DigitalOcean)

| App | Path | Port | Domain |
|-----|------|------|--------|
| rogan-writer | `/var/www/rogan-writer` | 3000 | smartbookplanner.com |
| smart-book-marketing | `/var/www/smart-book-marketing` | 3001 | marketing.smartbookplanner.com |

## Docs

- [Agentic marketing playbook](./docs/marketing/agentic-marketing-playbook.md)
- [Ghost blog setup](./docs/ghost-setup.md) — `blog.smartbookplanner.com`
- [PLAN.md](./PLAN.md) — DNS, nginx, SSL, secrets
# smart-book-marketing
