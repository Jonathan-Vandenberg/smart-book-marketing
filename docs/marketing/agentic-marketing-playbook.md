# Smart Book Planner — Agentic Marketing Playbook

> **Product:** [smartbookplanner.com](https://www.smartbookplanner.com)  
> **Audience:** Novelists, memoirists, researchers  
> **Pricing:** Free (full planning + export) · Pro R199/mo or R1490/yr (hosted AI + advanced features)  
> **Goal:** Build discoverability and signups with maximum agent automation, minimal manual ops

This document replaces the outdated `ROGAN-WRITER-MARKETING-STRATEGY.md` (wrong brand, pricing, and tier structure). Use this as the source of truth for marketing agents and automation scripts.

---

## 1. Positioning & Messaging (Agent Context)

Agents should reuse these angles consistently. Rotate by channel and audience.

| Audience | Hook | Proof points |
|----------|------|--------------|
| **Fiction writers** | "Never lose the plot." | Character/plot/timeline/scene cards, consistency AI, 7-point structure |
| **Memoirists** | "Your life has a spine — map it before you draft." | Timeline, scene cards, fact-check with citations |
| **Researchers** | "Structure first, citations handled." | Custom templates, deep research, APA/MLA/Chicago |
| **AI-savvy writers** | "Planning + AI that knows your whole manuscript." | Semantic context across characters/chapters/locations; BYOK option |
| **Budget-conscious** | "Free forever for planning and export." | Unlimited books/chapters on Free; Pro only for AI |

**Primary CTA:** `Start your manuscript` → Google sign-in on apex domain  
**Secondary CTA:** Link to `#features` or `#pricing` on www landing  
**Avoid:** "Rogan Writer", generic "AI writes your book" (position as *planning + consistency + assisted drafting*)

---

## 2. Platform Account Checklist

Create accounts in this order. **Priority** reflects ROI for a solo/small-team, agent-driven GTM.

### Tier 1 — Create first (Week 1)

| Platform | Account type | URL / handle suggestion | Automation level | Notes |
|----------|--------------|-------------------------|------------------|-------|
| **Google Search Console** | Property | `smartbookplanner.com` + `www` | Full (API) | Submit sitemap, monitor queries |
| **Google Analytics 4** | Property | Single web stream | Full (API) | Funnel: landing → sign-in → first book |
| **Bing Webmaster Tools** | Site | Both hostnames | Partial | Import from GSC |
| **X (Twitter)** | Brand account | `@SmartBookPlanner` | High (API v2) | Daily tips, feature clips, writing community |
| **LinkedIn** | Company Page + founder profile | `Smart Book Planner` | Medium (API limited) | Research/academic + indie author angle |
| **Reddit** | Brand account (low promo) | `u/SmartBookPlanner` | Low (no post API) | Comment-first; agent drafts, human posts |
| **Product Hunt** | Maker account | Launch listing (schedule later) | Manual launch day | Prep assets 2 weeks ahead |
| **Indie Hackers** | Founder profile | Product + build-in-public | Medium | Weekly metrics posts |
| **Beehiiv or Loops** | Newsletter | `Plot Notes` or `The Manuscript Brief` | High (API) | Weekly automated digest + manual hero story |
| **Buffer or Typefully** | Team | Connect all socials | High (API) | Central scheduling layer for agents |
| **Canva** | Brand kit | Logo, palette from landing | Medium (API) | Auto-generate feature carousels |
| **YouTube** | Brand channel | `Smart Book Planner` | Medium (API upload) | Tutorial + workflow demos |

### Tier 2 — Create in Month 1

| Platform | Account type | Automation level | Primary use |
|----------|--------------|------------------|-------------|
| **Substack or Ghost** | Blog | High | Long-form SEO + newsletter mirror |
| **Medium** | Publication | Medium (import RSS) | Syndicate blog posts |
| **Facebook Page** | Business | Medium (Meta API) | Retargeting + writing groups (careful with rules) |
| **Instagram** | Business | Medium | Carousel tips, landing aesthetic |
| **Threads** | Brand | Medium | Cross-post from X |
| **TikTok** | Business | Low-Medium | 30–60s "plan before you draft" clips |
| **Pinterest** | Business | Medium | Infographics: plot structure, scene cards |
| **Discord** | Server | Low (bot possible) | Support + beta users + writing sprints |
| **AlternativeTo** | Product listing | Manual once | "Alternative to Scrivener / Sudowrite" |
| **BetaList** | Startup listing | Manual | Pre-PH soft launch |
| **G2** | Software listing | Manual | Collect reviews after 20+ happy users |
| **Capterra** | Listing | Manual | Same as G2 |
| **Trustpilot** | Business | API for invites | Post-checkout review requests |

### Tier 3 — Community & niche (Month 2+)

| Platform | Automation | Strategy |
|----------|------------|----------|
| **NaNoWriMo forums** | Low | Sponsor tips in Nov; agent drafts guides |
| **Wattpad** | Low | Sample "planning workbook" content, link in bio |
| **Goodreads** | Low | Author/program page when you have case studies |
| **Reedsy** | Manual | Guest articles on planning |
| **Dev.to** | RSS | "How we built semantic AI for manuscripts" |
| **Hacker News** | Manual | Show HN when milestone hit (500 users, major feature) |
| **Bluesky** | Medium | Mirror X thread content |
| **Mastodon** | Medium | `#Writing`, `#WorldBuilding` communities |
| **Quora** | Medium | Answer "best novel planning software" etc. |
| **Stack Exchange (Writing SE)** | Low | Genuine answers only; no spam |

### Tier 4 — Paid & partnerships (when PMF signals exist)

| Platform | When | Automation |
|----------|------|------------|
| **Google Ads** | After 100+ organic signups | API + agent-generated ad copy variants |
| **Meta Ads** | Same | API; creative from Canva agent |
| **AppSumo** | If doing LTD deal | Manual negotiation |
| **Writing course affiliates** | After 3 case studies | Agent outreach email sequences |
| **OpenRouter / AI directories** | Ongoing | List as BYOK-compatible tool |

### Accounts you likely already have

| Platform | Action |
|----------|--------|
| **GitHub** | Pin repo, add marketing site link in README |
| **Paystack** | Enable customer emails; webhook → review invite flow |
| **Google Cloud (OAuth)** | Ensure OAuth consent screen branding matches Smart Book Planner |
| **DigitalOcean** | N/A for marketing |
| **Namecheap / DNS** | Ensure www + apex + email (support@) configured |

---

## 3. Agentic Marketing Architecture

Design marketing as a **pipeline of specialized agents** with a human approval gate where platforms require it.

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Signal Agent   │────▶│  Content Agent   │────▶│  Review Queue   │
│  (trends, SEO,  │     │  (posts, blogs,  │     │  (human 5 min/  │
│   Reddit, GSC)  │     │   threads, email)│     │   day or auto)  │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                        ┌──────────────────┐              ▼
                        │  Analytics Agent │◀────┌─────────────────┐
                        │  (GA4, signups,  │     │ Publish Agent   │
                        │   A/B, reports)  │     │ (Buffer, Beehiiv│
                        └──────────────────┘     │  Ghost, YouTube)│
                                                 └─────────────────┘
```

### Agent roles

| Agent | Input | Output | Cadence |
|-------|-------|--------|---------|
| **Signal** | GSC queries, Reddit RSS, competitor sites, seasonal calendar (NaNoWriMo) | Topic briefs with keywords + audience tag | Daily |
| **Content** | Topic brief + brand voice doc | Post drafts, thread, blog MD, email, carousel copy | Daily batch |
| **Visual** | Post draft + screenshot URLs from `/landing-page/*` | Canva designs or ffmpeg clips | Per post |
| **Publish** | Approved assets | Scheduled posts via Buffer/Typefully API | Auto |
| **Community** | Reddit/HN/IH alerts for keywords | Draft replies (helpful, not spammy) | Real-time |
| **SEO** | Keyword list | Blog posts, meta suggestions, internal links | 2×/week |
| **Lifecycle** | Signup/webhook events | Onboarding email sequence, review asks | Event-driven |
| **Analytics** | GA4 + DB signups | Weekly markdown report → Slack/email | Weekly |

### Human-in-the-loop rules

| Action | Automate? | Why |
|--------|-----------|-----|
| Schedule X/LinkedIn/Instagram posts | Yes | APIs stable |
| Publish blog to Ghost | Yes | Own domain |
| Reddit comments & posts | **Draft only** | Ban risk; authenticity matters |
| Product Hunt launch | **Manual** | One-shot; needs founder voice |
| Paid ads | Approve creatives first | Budget + policy |
| Reply to angry users | **Never auto** | Reputation risk |

---

## 4. Content Pillars (Agent Templates)

Each piece of content maps to one pillar. Agents pick pillar + audience + CTA.

### Pillar A — Craft & planning (fiction)
- "7 plot points before chapter 1"
- "Scene card workflow in 5 minutes"
- "Timeline conflicts that ruin novels"
- **CTA:** Free planning tools

### Pillar B — Research & academia
- "Build your paper template once"
- "Citation styles without the pain"
- "Fact-check before you submit"
- **CTA:** Research templates + fact-check (Pro)

### Pillar C — AI done right
- "AI that reads your whole cast, not just the paragraph"
- "Hosted credits vs BYOK: which Pro mode fits you"
- "Editor agent vs blank-page ChatGPT"
- **CTA:** Pro trial / upgrade

### Pillar D — Build in public
- "Shipped: BYOK gating, billing fixes"
- "MRR / signup metrics (Indie Hackers)"
- "How semantic search powers consistency"
- **CTA:** Follow journey + try product

### Pillar E — Social proof (when available)
- User before/after (planning → draft)
- Export to Kindle walkthrough
- Audiobook generation demo
- **CTA:** Sign up

### Reusable post formats (agents)

**X thread (8 tweets):**
1. Hook problem ("You renamed a character in ch.3. Ch.47 still uses the old name.")
2. Agitate (spreadsheet chaos)
3. Introduce workflow (cast → structure → timeline)
4. Screenshot
5. AI consistency angle
6. Free tier mention
7. Pro AI features (1 line)
8. CTA link

**LinkedIn post:** Professional tone, research + indie author split, 1200 chars max, single image.

**Reddit comment:** 100% helpful answer first; mention tool only if directly relevant; no link in first comment unless asked.

---

## 5. Suggested Marketing Strategy (Phased)

### Phase 0 — Foundation (Days 1–14)

**Objective:** Instrumentation + accounts + agent infra

1. Create all **Tier 1** accounts; unify bio, link, avatar (use landing palette: `#211C15`, `#B23A2E`, `#F7F2E7`).
2. Wire **GA4 events:** `sign_up`, `create_book`, `upgrade_click`, `pro_subscribe`.
3. Set up **Search Console**; request indexing for www landing + key app pages allowed publicly.
4. Deploy **newsletter** (Beehiiv/Loops) with welcome sequence (3 emails):
   - Day 0: Welcome + "create your first book in 10 min"
   - Day 2: Planning workflow (characters → plot → scenes)
   - Day 7: Pro AI features + pricing (soft)
5. Build **agent repo** (`marketing-agents/` or reuse `content-creator` project):
   - `config/brand-voice.md`
   - `config/content-pillars.json`
   - `prompts/*.md` per agent
   - `workflows/daily-content.mjs`
6. Connect **Buffer/Typefully** → X, LinkedIn, Threads, Facebook.

**Success metrics:** Accounts live, GA4 firing, 14 posts scheduled, 0 manual daily posting.

### Phase 1 — Organic flywheel (Days 15–90)

**Objective:** SEO + community presence + first 500 signups

| Channel | Tactic | Agent share |
|---------|--------|-------------|
| **SEO blog** | 2 posts/week targeting long-tail (see keyword list below) | 90% |
| **X** | 1 thread + 2 short posts/day | 95% |
| **LinkedIn** | 3 posts/week | 90% |
| **Reddit** | 5 genuine comments/week in r/writing, r/selfpublish, r/AcademicWriting | Draft 100%, post 0% auto |
| **YouTube** | 1 tutorial/week (screen recording + AI voiceover OK) | 70% |
| **Indie Hackers** | Biweekly build update | 80% |
| **Email** | Weekly "Plot Notes" newsletter | 90% |

**Keyword targets (fiction):**
- novel planning software
- story timeline tool
- character relationship tracker writing
- scene card app
- scrivener alternative AI

**Keyword targets (research):**
- research paper writing tool
- academic writing template software
- citation management writing app
- AI fact check for essays

**Launch moments (manual, plan ahead):**
- **Product Hunt** — Tuesday launch, hunter recruited, demo video, 50 supporters pre-lined up
- **Show HN** — "Smart Book Planner – AI-aware planning for novels and papers"
- **NaNoWriMo (November)** — Free planning sprint campaign

**Success metrics:** 500 signups, 20 Pro conversions, 10 ranking keywords in top 50, email list 200+.

### Phase 2 — Amplify (Days 91–180)

**Objective:** Paid tests + affiliates + social proof

1. **Google Ads:** R5k–10k ZAR/mo test on high-intent keywords; agent generates 10 ad variants/week; kill CPA > 3× Pro monthly price.
2. **Retargeting:** Meta pixel on www; retarget landing visitors who didn't sign in.
3. **Affiliate program:** 25% recurring for writing coaches / BookTube (Rewardful or custom).
4. **G2/Capterra/AlternativeTo:** Ask happy Pro users for reviews (automated email Day 14 post-subscribe).
5. **Case studies:** Agent interviews user via email template; founder edits one hero story/month.
6. **TikTok/Reels:** Repurpose YouTube clips; agent cuts captions.

**Success metrics:** CAC < R600, 50+ Pro subscribers, 3 case studies, PH top 5 of day.

### Phase 3 — Scale (6–12 months)

- International SEO (UK/US English content; ZAR pricing page + USD note)
- Partnerships with writing courses (affiliate + co-branded templates)
- Webinar automation (pre-recorded + live Q&A monthly)
- AppSumo or lifetime deal only if churn/cashflow strategy supports it

---

## 6. Automation Stack (Recommended)

| Layer | Tool | Agent integration |
|-------|------|-------------------|
| **Orchestration** | n8n (self-host) or Make | Cron workflows, webhooks from app |
| **LLM** | OpenRouter (platform key) | Same stack as product |
| **Scheduling** | Buffer or Typefully | REST API |
| **Email** | Loops or Beehiiv | API + event triggers |
| **Blog** | Ghost (self-host) or Substack | Ghost Admin API |
| **CMS mirror** | MD files in repo → CI deploy | GitHub Action on `content/**` |
| **Analytics** | GA4 Data API | Weekly agent report |
| **Social listening** | F5Bot (free) or Brand24 | Email alerts → Community agent |
| **SEO** | GSC API + Ahrefs/Semrush (optional) | Signal agent input |
| **Images** | Canva Connect API | Visual agent |
| **Video** | ffmpeg + ElevenLabs (optional) | YouTube agent |
| **CRM** | Notion or Airtable | Content calendar + status |
| **Review invites** | Trustpilot API | Post-Pro webhook |

### Event webhooks from Smart Book Planner (implement when ready)

| Event | Marketing action |
|-------|------------------|
| `user.created` | Welcome email + onboarding tips |
| `book.created` | "Next: add your first character" nudge |
| `subscription.pro.activated` | Thank you + review ask schedule |
| `subscription.cancelled` | Exit survey + win-back email Day 30 |
| `export.completed` | "Share your milestone" social prompt |

---

## 7. Weekly Agent Runbook (Example Cron)

| Day | Time (SAST) | Agent job |
|-----|-------------|-----------|
| Mon | 06:00 | Signal agent: pull GSC + F5Bot → topic briefs |
| Mon | 07:00 | Content agent: batch 7 X posts, 3 LinkedIn, 1 blog outline |
| Mon | 08:00 | Push to review queue (Notion) |
| Mon | 09:00 | Human approve (or auto-approve if confidence > threshold) |
| Mon | 10:00 | Publish agent: schedule week in Buffer |
| Tue | 06:00 | SEO agent: publish blog post from approved outline |
| Wed | 06:00 | Community agent: draft 5 Reddit/IH replies |
| Thu | 06:00 | Visual agent: carousels for top 2 posts |
| Fri | 06:00 | Analytics agent: weekly report → email founder |
| Daily | 12:00 | Publish agent: post 1 X tip + engage list (manual likes OK) |

---

## 8. Brand Voice (for agent system prompts)

Paste into every content agent's system prompt:

```
You write for Smart Book Planner (smartbookplanner.com).

Voice: Knowledgeable fellow writer, not a hype SaaS bro. Warm, precise, slightly literary.
Never promise "AI writes your bestseller." Emphasize planning, consistency, control.
Short sentences. Active voice. South African English OK; global audience.

Product facts:
- Free: unlimited books/chapters, full planning suite, PDF/EPUB/Kindle export
- Pro: R199/mo or R1490/yr — hosted AI credits OR bring your own OpenRouter key
- Fiction: characters, 7-point plot, timeline, scenes, locations, editor, fact-check, audiobook, covers
- Research: templates, deep research, citations (APA/MLA/Chicago)

CTA: "Start your manuscript" → https://smartbookplanner.com
Do not mention "Rogan Writer."
```

---

## 9. KPIs & Feedback Loops

### North star
**Weekly active writers** (users with ≥1 edit session/week)

### Dashboard metrics (Analytics agent weekly)

| Metric | Target (Day 90) |
|--------|-----------------|
| www → sign-up rate | > 8% |
| Sign-up → first book | > 60% |
| Free → Pro conversion | > 4% |
| MRR (ZAR) | R10k+ |
| Organic sessions/week | 1,000+ |
| Email open rate | > 35% |
| CAC (paid phase) | < R600 |

### Agent quality loop
1. Analytics agent flags top/bottom posts by click-through.
2. Signal agent weights topics similar to winners.
3. Monthly: human updates `brand-voice.md` with "phrases that worked."

---

## 10. Immediate Action Checklist

Copy into your task tracker:

- [ ] Register `@SmartBookPlanner` on X, LinkedIn company page, YouTube
- [ ] Verify GA4 + GSC on both `www` and apex
- [ ] Set up Beehiiv/Loops + 3-email welcome sequence
- [ ] Connect Buffer/Typefully to social accounts
- [ ] Create `marketing-agents/` with brand voice + daily cron
- [ ] Schedule Product Hunt launch date (6 weeks out minimum)
- [ ] Post first Indie Hackers "build in public" intro
- [ ] Draft 10 SEO blog titles from keyword list (agent)
- [ ] Add `support@smartbookplanner.com` to all platform profiles
- [ ] Implement GA4 custom events in app (if not already)

---

## 11. What Not to Do

- **Spam Reddit/Facebook groups** with links — agents draft, humans post helpfully
- **Buy follower bots** — kills domain reputation and ad accounts
- **Auto-DM new followers** — platform penalties
- **Misrepresent AI capabilities** — legal and refund risk
- **Ignore Paystack/ZAR audience** — lean into SA indie author community, then expand globally

---

*Last updated: 2026-08-08 · Maintained alongside product releases. Update Phase keywords and webhook table when new features ship.*
