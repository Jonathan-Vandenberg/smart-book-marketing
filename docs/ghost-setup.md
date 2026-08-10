# Ghost Blog Setup — Smart Book Planner

Self-hosted Ghost at **`blog.smartbookplanner.com`** on the same DigitalOcean droplet as the main app and marketing dashboard.

## Architecture

| Service | Port | Domain |
|---------|------|--------|
| Smart Book Planner | 3000 | `smartbookplanner.com` |
| Marketing dashboard | 3001 | `marketing.smartbookplanner.com` |
| **Ghost blog** | **2368** | **`blog.smartbookplanner.com`** |

```
Content agent → Ghost draft (long-form SEO)
              → X / LinkedIn drafts (short posts)
                    ↓
            Approve in /drafts
                    ↓
Publish agent → Ghost Admin API (blog post)
              → Buffer API (social)
                    ↓
Ghost post.published webhook → Buffer link share (X, LinkedIn, Facebook)
```

## One-time server install

### 1. DNS

Add an A record:

```
blog.smartbookplanner.com → 209.97.163.64
```

### 2. Run setup script on the droplet

```bash
scp nginx-ghost.conf scripts/setup-ghost.sh root@209.97.163.64:/tmp/
ssh root@209.97.163.64 'bash /tmp/setup-ghost.sh'
```

Or from a clone of this repo on the server:

```bash
cd /var/www/smart-book-marketing
sudo bash scripts/setup-ghost.sh
```

### 3. SSL

```bash
ssh root@209.97.163.64
certbot --nginx -d blog.smartbookplanner.com
# Or expand existing cert to include blog subdomain
```

### 4. Create Ghost admin

1. Open https://blog.smartbookplanner.com/ghost
2. Create your admin account
3. Complete site title: **Smart Book Planner Blog**

### 5. Custom integration (Admin API)

Ghost Admin → **Settings → Integrations → Add custom integration**

- Name: `Smart Book Marketing`
- Copy **Admin API URL** and **Admin API Key** (`id:secret` format)

Add to marketing dashboard `.env`:

```env
GHOST_URL=https://blog.smartbookplanner.com
GHOST_ADMIN_API_KEY=YOUR_ID:YOUR_SECRET
GHOST_WEBHOOK_SECRET=generate-a-long-random-string
```

For production, add GitHub Secrets:

- `MARKETING_GHOST_ADMIN_API_KEY`
- `MARKETING_GHOST_WEBHOOK_SECRET`

### 6. Webhook (blog → social link share)

Ghost Admin → **Settings → Advanced → Integrations → Add webhook**

| Field | Value |
|-------|-------|
| Name | Marketing Buffer share |
| Event | **Post published** |
| Target URL | `https://marketing.smartbookplanner.com/api/webhooks/ghost?secret=YOUR_WEBHOOK_SECRET` |

When you publish a blog post, the marketing API posts a link to Buffer (X, LinkedIn, etc.).

### 7. Email (newsletter)

Ghost Admin → **Settings → Email newsletter**

Configure SMTP via a free-tier provider:

| Provider | Free tier |
|----------|-----------|
| [Mailgun](https://www.mailgun.com/) | 5,000 emails/mo (3 months) |
| [Amazon SES](https://aws.amazon.com/ses/) | 3,000 emails/mo (12 months) |
| [SendGrid](https://sendgrid.com/) | 100 emails/day |

Without SMTP, blog posts publish but newsletter emails won't send.

## Local development

Add Ghost vars to `.env.local` (point at production Ghost or a local Ghost install):

```env
GHOST_URL=https://blog.smartbookplanner.com
GHOST_ADMIN_API_KEY=
GHOST_WEBHOOK_SECRET=
```

Test publish agent:

```bash
npm run agents:run-once
# Or trigger via dashboard → Agents → Run publish
```

## Content workflow

1. **Content agent** (weekly) creates drafts for X, LinkedIn, and Ghost
2. Review at https://marketing.smartbookplanner.com/drafts
3. Approve drafts you want published
4. **Publish agent** (daily cron) pushes:
   - Ghost drafts → blog posts via Admin API
   - Social drafts → Buffer
5. New Ghost posts trigger webhook → Buffer link announcement

## What Ghost does NOT auto-post

| Platform | Method |
|----------|--------|
| X, LinkedIn, Facebook | Buffer (link share on publish; native posts from approved drafts) |
| Reddit | Manual only |
| Instagram, TikTok | Buffer + separate creative assets |

## Troubleshooting

**401 from Ghost API** — Check `GHOST_ADMIN_API_KEY` is `id:secret` with no spaces.

**Webhook not firing** — Confirm URL includes `?secret=` matching `GHOST_WEBHOOK_SECRET`.

**Ghost won't start** — `cd /var/www/ghost && ghost doctor && ghost restart`

**MySQL credentials** — Stored on server at `/root/ghost-db-credentials.txt` after setup.

## Files in this repo

| File | Purpose |
|------|---------|
| `nginx-ghost.conf` | nginx reverse proxy to :2368 |
| `scripts/setup-ghost.sh` | One-time droplet install |
| `src/lib/ghost.ts` | Admin API client |
| `src/app/api/webhooks/ghost/route.ts` | post.published → Buffer |
