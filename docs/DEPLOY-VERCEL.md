# Deploying to Vercel

This guide walks through deploying inventory-system to Vercel + Neon.
Estimated time end-to-end: ~30–45 minutes the first time.

## Prerequisites

- A GitHub account with this repo pushed
- An email for [Neon](https://neon.tech) (free tier, no credit card required)
- A Vercel account ([vercel.com](https://vercel.com), free Hobby tier is enough to start)
- The Shopify custom app already set up (Dev Dashboard → app → API credentials)
- A Google OAuth app already set up (Google Cloud Console → Credentials)

## 1. Create the Postgres database on Neon

1. Sign up at [neon.tech](https://neon.tech).
2. Create a new project. Default region is fine.
3. Copy the **Connection string** (the pooled one, with `pgbouncer=true` if offered).
   It looks like `postgresql://user:password@ep-xxxx.neon.tech/neondb?sslmode=require`.
4. Hold this — you'll paste it into Vercel env vars below.

## 2. Connect Vercel to the GitHub repo

1. Sign in at [vercel.com](https://vercel.com), click **Add New → Project**.
2. Import the `Suyog007/inventory-system` repo (or your fork). Pick the `dev` branch as the production branch (or `main`, whichever you deploy from).
3. Framework Preset: **Next.js** (auto-detected).
4. **Don't deploy yet** — first add env vars.

## 3. Set env vars in the Vercel dashboard

In the project's **Settings → Environment Variables**, add these for the Production environment:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon connection string from step 1 |
| `AUTH_SECRET` | Run `openssl rand -base64 32` locally to generate |
| `AUTH_URL` | `https://<your-project>.vercel.app` (Vercel assigns this on first deploy; come back and set after) |
| `CRON_SECRET` | Random string for cron auth: `openssl rand -hex 32` |
| `SHOPIFY_CLIENT_ID` | From Shopify Dev Dashboard → app → API credentials |
| `SHOPIFY_CLIENT_SECRET` | Same place |
| `SHOPIFY_STORE` | (optional) `your-store.myshopify.com` — pre-fills the Connect form |
| `AUTH_GOOGLE_ID` | From Google Cloud Console → OAuth client |
| `AUTH_GOOGLE_SECRET` | Same place |
| `SEED_ADMIN_EMAIL` | The email of the initial admin user |
| `SEED_ADMIN_PASSWORD` | Initial password (change immediately after first login) |
| `SEED_ADMIN_NAME` | Display name |

Don't set `WEBHOOK_BASE_URL` — `AUTH_URL` is used for webhooks in prod.
Don't set `SHOPIFY_ACCESS_TOKEN` — that's only for local spike scripts; the app stores OAuth tokens in the DB.

## 4. Migrate the database and seed admin

From your laptop, point Prisma at the Neon DB and run migrations + seed:

```bash
DATABASE_URL='<your-neon-url>' npx prisma migrate deploy
DATABASE_URL='<your-neon-url>' SEED_ADMIN_EMAIL='you@example.com' SEED_ADMIN_PASSWORD='change-me' npm run db:seed
```

## 5. Deploy

Hit **Deploy** in the Vercel dashboard (or `git push` to your branch — Vercel auto-deploys). First build takes ~2–3 min.

## 6. Update Shopify Dev Dashboard

1. Open [dev.shopify.com](https://dev.shopify.com) → your app → Versions → current version.
2. **Redirect URLs**: add `https://<your-project>.vercel.app/api/channels/shopify/callback`. Keep the localhost one if you still want dev to work.
3. Release.

## 7. Update Google Cloud Console

1. Open [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials) → your OAuth client.
2. **Authorized redirect URIs**: add `https://<your-project>.vercel.app/api/auth/callback/google`. Keep the localhost one too.
3. Save.

## 8. First-time configuration in the deployed app

1. Open `https://<your-project>.vercel.app/login`, sign in with the seeded admin.
2. **Settings → Channels → Connect Shopify** → enter your store domain → approve install.
3. Webhooks auto-register at the Vercel URL (verify with the "Register / refresh webhooks" button on the same page).
4. Click **Import all from Shopify**.

## 9. Verify cron jobs are scheduled

In the Vercel dashboard → your project → **Settings → Cron Jobs**. You should see:
- `/api/cron/process-outbox` — runs every minute (drains the outbox)
- `/api/cron/reconcile` — runs nightly at 04:00 UTC (drift detection)

If they're not there, check that `vercel.json` made it into the deploy.

## 10. Smoke test

- Edit a card in the app → save → check Shopify product updated within ~1 minute (cron pickup)
- Delete a card in Shopify admin → check it disappears from `/cards` within 2–3 seconds (webhook)
- Place a test order in Shopify → check `/dashboard` recent orders + variant quantity decremented

## Cost notes

- **Free tier** (good for development / small-volume daily use): Vercel Hobby + Neon free = $0/mo
- **Production** (always-on, larger function timeouts, real backups): Vercel Pro $20/mo + Neon Launch $19/mo = ~$40/mo

## Gotchas

- **Image upload size**: Vercel Hobby caps request body at 4.5 MB. Larger files need Pro. Card photos are typically 3–8 MB, so plan for Pro early.
- **Function timeout**: Hobby = 10s, Pro = 60s. Initial import on big catalogs can exceed 10s. The `maxDuration = 60` exports require Pro.
- **Tunnel URL changes**: Not a Vercel concern — only relevant if you also run dev with `cloudflared` for testing webhooks locally.
- **OAuth state cookie + Vercel preview deployments**: previews get different URLs per branch. OAuth flow only works on the URL matching your registered redirect URI. Use the production deployment URL for end-to-end testing.

## Rolling back

Vercel keeps every deployment. Dashboard → **Deployments** → pick a known-good one → **Promote to Production**. Takes ~5 seconds.
