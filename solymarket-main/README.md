# FORECAST — Prediction Markets

A Polymarket-style prediction market app. Dark, minimal, fully functional.  
Built with Next.js 14, Vercel Postgres, and NextAuth (Google sign-in).

---

## What it does

- Users sign in with Google and get **100 free credits**
- Anyone can **create a market** (YES/NO question)
- Anyone can **bet YES or NO** with any amount of their credits
- Each user can only hold **one position per market**
- When the outcome is known, the **admin resolves** the market
- Winners receive their stake back **plus a proportional share** of the losing pool
- Admin panel at `/admin` (only visible to the configured admin email)

---

## Setup: Step by Step

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

---

### Step 2 — Create a Vercel account and deploy

1. Go to **https://vercel.com** and sign up (free)
2. Click **"Add New Project"**
3. Import your GitHub repo
4. Click **Deploy** — it will fail (no env vars yet), that's fine

---

### Step 3 — Add Vercel Postgres (free)

1. In your Vercel project dashboard, go to the **Storage** tab
2. Click **"Create Database"** → choose **Postgres**
3. Name it anything (e.g. `forecast-db`), pick the free tier
4. Click **Connect** — this auto-populates `POSTGRES_URL` and related vars into your project's environment variables

---

### Step 4 — Set up Google OAuth

1. Go to **https://console.cloud.google.com**
2. Create a new project (or use an existing one)
3. Go to **APIs & Services → OAuth consent screen**
   - Choose **External**
   - Fill in App name (e.g. "Forecast"), your email, and developer email
   - Save and continue through all steps (no scopes needed)
4. Go to **APIs & Services → Credentials**
5. Click **"+ Create Credentials" → OAuth 2.0 Client IDs**
   - Application type: **Web application**
   - Name: anything
   - Authorized redirect URIs — add **both**:
     ```
     http://localhost:3000/api/auth/callback/google
     https://YOUR_VERCEL_DOMAIN.vercel.app/api/auth/callback/google
     ```
     (Replace `YOUR_VERCEL_DOMAIN` with the actual domain Vercel gave you)
6. Copy the **Client ID** and **Client Secret**

---

### Step 5 — Add Environment Variables in Vercel

In your Vercel project → **Settings → Environment Variables**, add:

| Name | Value |
|------|-------|
| `NEXTAUTH_URL` | `https://YOUR_VERCEL_DOMAIN.vercel.app` |
| `NEXTAUTH_SECRET` | Run `openssl rand -base64 32` in terminal and paste the output |
| `GOOGLE_CLIENT_ID` | From Step 4 |
| `GOOGLE_CLIENT_SECRET` | From Step 4 |
| `ADMIN_EMAIL` | Your Google account email (this account gets admin access) |
| `MIGRATE_SECRET` | Any random string, e.g. `my-secret-123` |

The `POSTGRES_*` variables were added automatically in Step 3.

---

### Step 6 — Redeploy

In Vercel → **Deployments** → click the three dots on the latest deployment → **Redeploy**.

---

### Step 7 — Run the database migration

After deploying, visit this URL once to create the database tables:

```
https://YOUR_VERCEL_DOMAIN.vercel.app/api/migrate?secret=YOUR_MIGRATE_SECRET
```

You should see: `{"ok":true,"message":"Migration complete"}`

---

### Step 8 — Done!

Visit your site. Sign in with the Google account matching `ADMIN_EMAIL` to get admin access.

---

## Local Development

```bash
cp .env.example .env.local
# Fill in all values in .env.local
npm install
npm run dev
```

Open http://localhost:3000

For local Postgres, you can use the Vercel CLI to pull env vars:
```bash
npm i -g vercel
vercel link
vercel env pull .env.local
```

---

## How resolution / payouts work

When admin resolves a market as **YES**:
- All YES bettors get their stake back + proportional share of the NO pool
- Example: Alice bets 40 cr YES, Bob bets 60 cr YES, Charlie bets 50 cr NO
  - Total YES pool: 100 cr, NO pool: 50 cr
  - Alice gets back: 40 + (40/100 × 50) = 40 + 20 = **60 cr**
  - Bob gets back: 60 + (60/100 × 50) = 60 + 30 = **90 cr**
  - Charlie loses his 50 cr

If there are no winners, everyone is refunded.

---

## File structure

```
app/
  page.js              ← Home / market listing
  layout.js            ← Root layout
  providers.js         ← NextAuth session provider
  globals.css          ← All styles
  bets/[id]/page.js    ← Individual market page
  profile/page.js      ← User profile + positions
  admin/page.js        ← Admin resolve panel
  api/
    auth/[...nextauth]/route.js   ← Google OAuth
    bets/route.js                 ← List + create bets
    bets/[id]/route.js            ← Get single bet
    bets/[id]/place/route.js      ← Place a position
    admin/resolve/route.js        ← Resolve market (admin only)
    user/me/route.js              ← Current user profile
    migrate/route.js              ← DB migration endpoint
components/
  Navbar.js            ← Top navigation bar
lib/
  db.js                ← Database helpers
scripts/
  migrate.js           ← Local migration script
```
