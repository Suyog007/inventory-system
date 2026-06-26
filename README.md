# inventory-system — Vercel variant

Trading-card inventory and multi-channel sales platform. **This repo is the Vercel-deployed variant.** Same app, but configured for Vercel + Neon. For the EC2 / Docker variant see [ibriz/collectorclub-inventory](https://github.com/ibriz/collectorclub-inventory).

## Stack

- **Next.js 16** (App Router, React 19) — UI + API routes + server actions
- **Prisma 7 + PostgreSQL** — DB (Neon in prod, Docker locally)
- **NextAuth v5** — email/password + Google sign-in, ADMIN / STAFF roles
- **Shopify Admin GraphQL API** — connect, import, push, webhooks
- **Vitest + Playwright** — unit + e2e tests
- **Vercel Cron** — outbox worker + nightly reconcile (no long-running processes)

## Local development

```bash
# 1. Postgres in Docker
npm run db:up

# 2. Install + migrate + seed admin user
npm install
npm run db:migrate
npm run db:seed

# 3. Dev server + outbox worker (separate terminals)
npm run dev
npm run worker  # not used in Vercel prod — cron handles it
```

Open http://localhost:3000 — sign in with the seeded admin (see `.env.example`).

## Deploying to Vercel

See [`docs/DEPLOY-VERCEL.md`](docs/DEPLOY-VERCEL.md) for the full step-by-step.

Short version:
1. Create a Postgres database on [Neon](https://neon.tech) (free tier)
2. Import this repo in Vercel
3. Set env vars in the Vercel dashboard (see `.env.example`)
4. `DATABASE_URL=<neon-url> npx prisma migrate deploy && npm run db:seed` from your laptop
5. Update Shopify Dev Dashboard + Google OAuth redirect URIs to your Vercel URL
6. Click **Connect Shopify** in the deployed app — webhooks auto-register

## Differences from the EC2 variant

| | This repo (Vercel) | ibriz/collectorclub-inventory (EC2) |
|---|---|---|
| Outbox worker | `/api/cron/process-outbox` (Vercel Cron, every minute) | `npm run worker` (long-running process) |
| Reconcile cron | `/api/cron/reconcile` (Vercel Cron, nightly) | systemd / OS cron |
| Postgres | Neon (managed) | Docker container or RDS |
| HTTPS / public URL | Vercel automatic | Nginx / Caddy + Let's Encrypt |
| Deployment | `git push` → auto-deploy | `docker compose up` / manual |

App source under `src/` is identical between the two repos.
