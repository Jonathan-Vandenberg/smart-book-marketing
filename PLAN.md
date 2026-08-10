# Smart Book Marketing — Deployment Plan

Agentic marketing dashboard and cron agents for [Smart Book Planner](https://www.smartbookplanner.com).

**Primary deployment target:** Same **DigitalOcean** server as `rogan-writer` (`209.97.163.64`), subdomain **`marketing.smartbookplanner.com`**, port **3001**.

Oracle Cloud is optional (instance limit reached). Jazz-practice-agent stays on Oracle (`92.4.137.13`).

---

## Architecture on DigitalOcean

| Service | PM2 name | Port | Domain |
|---------|----------|------|--------|
| Smart Book Planner app | `rogan-writer` | 3000 | `smartbookplanner.com` |
| Smart Book Planner landing | (same process) | 3000 | `www.smartbookplanner.com` |
| **Marketing dashboard** | `smart-book-marketing` | **3001** | **`marketing.smartbookplanner.com`** |
| **Ghost blog** | `ghost` (systemd) | **2368** | **`blog.smartbookplanner.com`** |

Both Next.js apps share one droplet, separate PM2 processes, nginx routes by hostname. Ghost runs via Ghost CLI systemd — see [docs/ghost-setup.md](./docs/ghost-setup.md).

---

## Git branches

| Branch | CI (build + typecheck) | Production deploy |
|--------|------------------------|-------------------|
| `dev` | Yes | No |
| `qa` | Yes | No |
| `main` | Yes | Yes (push or manual workflow) |

**Default workflow:** develop on `dev` → merge to `qa` for review → merge to `main` to release.

Only `main` triggers **Deploy to Production**. Pushes to `dev`/`qa` run **CI** only.

---

## One-time server setup

Run once on the DigitalOcean droplet (SSH as root or deploy user):

```bash
# App directory
mkdir -p /var/www/smart-book-marketing/data
chown -R $(whoami) /var/www/smart-book-marketing

# nginx vhost
scp nginx-marketing.conf root@209.97.163.64:/etc/nginx/sites-available/marketing-smartbookplanner
ssh root@209.97.163.64 "ln -sf /etc/nginx/sites-available/marketing-smartbookplanner /etc/nginx/sites-enabled/"

# DNS first: marketing.smartbookplanner.com A → 209.97.163.64

# SSL (expand existing cert or new subdomain cert)
ssh root@209.97.163.64 "certbot --nginx -d marketing.smartbookplanner.com"
ssh root@209.97.163.64 "nginx -t && systemctl reload nginx"
```

---

## GitHub Actions deploy (recommended)

Push to `main` auto-deploys via `.github/workflows/deploy-production.yml`.

**Reuse from rogan-writer repo secrets:**
- `DIGITALOCEAN_HOST` — `209.97.163.64`
- `DIGITALOCEAN_USERNAME` — usually `root`
- `DIGITALOCEAN_SSH_KEY` — same deploy key

**Add to this repo's GitHub Secrets:**
- `MARKETING_DASHBOARD_SECRET` — long random string (protects `/api/agents/run`)
- `MARKETING_OPENROUTER_API_KEY` — optional, for content agents
- `MARKETING_GA4_PROPERTY_ID` — optional, for analytics agent
- `MARKETING_BUFFER_ACCESS_TOKEN` — Buffer social publishing
- `MARKETING_GHOST_ADMIN_API_KEY` — Ghost Admin API key (`id:secret`)
- `MARKETING_GHOST_WEBHOOK_SECRET` — webhook query secret for Ghost → Buffer

---

## Manual deploy from Mac

```bash
cd /Users/jonathanvandenberg/2026/smart-book-marketing
cp .env.example .env   # local dev only

DO_HOST=209.97.163.64 DO_USER=root DO_KEY=~/.ssh/your_deploy_key ./scripts/deploy.sh
```

Create `.env` on server at `/var/www/smart-book-marketing/.env` (or let GitHub Actions write it).

---

## Local development

```bash
npm install
npm run dev              # http://localhost:3001
npm run agents:run-once  # test cron agents
```

---

## Oracle Cloud (alternative — not needed if using DO)

If you free up an Oracle instance later, see [jazz-practice-agent PLAN.md](../jazz-practice-agent/PLAN.md) Phase 7. Same PM2 pattern, path `/home/ubuntu/smart-book-marketing`.

---

## Security notes

- **Google OAuth** — only `ALLOWED_ADMIN_EMAILS` may sign in (default: `urbangentryjon@gmail.com`)
- Dashboard and API routes require an authenticated admin session
- `/api/agents/run` also accepts `Authorization: Bearer $DASHBOARD_SECRET` for automation
- Dashboard is `noindex` — not for public SEO
- Do not commit `.env` or service account keys

### Google Cloud OAuth redirect URI

Add this authorized redirect URI in Google Cloud Console (same project as Smart Book Planner):

`https://marketing.smartbookplanner.com/api/auth/callback/google`

---

## Next steps after deploy

1. Add DNS A record: `marketing` → `209.97.163.64`
2. Install nginx vhost + certbot
3. Push repo to GitHub, add secrets, push to `main`
4. Wire OpenRouter + GA4 into agents
5. Optional: webhook from rogan-writer signup events → marketing API

See [docs/marketing/agentic-marketing-playbook.md](./docs/marketing/agentic-marketing-playbook.md) for GTM strategy.
