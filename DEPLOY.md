# Deploy Uzi with no machine — all in the browser

~15 minutes, three free accounts: **GitHub** (stores the code), **Neon** (the database), **Vercel** (runs the app). You'll create those logins yourself; everything else is click-through.

---

## Step 1 — Put the code on GitHub
1. Unzip `uzi-app.zip` on your computer (double-click).
2. Go to **github.com** → sign up / log in → click **New repository**.
3. Name it `uzi-app`, leave it Public or Private, click **Create repository**.
4. On the empty repo page, click **"uploading an existing file"**.
5. Open the unzipped `uzi-app` folder, select **everything inside it** (not the folder itself — the files/folders within), and drag them into the browser.
6. Click **Commit changes**.

> If GitHub won't take the folders by drag, that's fine — use Step 1-alt below.

**Step 1-alt (template route):** if uploading is fussy, tell me and I'll instead give you a one-click "Deploy to Vercel" button + a public template repo link, which skips the manual upload.

---

## Step 2 — Create the database (Neon)
1. Go to **neon.tech** → sign up → **New Project** (name it `uzi`).
2. After it's created, copy the **connection string** (looks like `postgresql://user:pass@...neon.tech/neondb?sslmode=require`). Keep it handy.
3. In the left menu open **SQL Editor**.
4. Open `prisma/schema.sql` from the project, copy its entire contents, paste into the editor, and click **Run**. This creates the 4 tables.

---

## Step 3 — Deploy (Vercel)
1. Go to **vercel.com** → **Sign up with GitHub** (so it can see your repo).
2. **Add New… → Project** → import your `uzi-app` repo.
3. Before deploying, open **Environment Variables** and add two:
   - `DATABASE_URL` = the Neon connection string from Step 2
   - `AUTH_SECRET` = any long random string (mash the keyboard ~40 chars)
4. Click **Deploy**. Vercel auto-detects Next.js and builds it (it runs `prisma generate` for you).
5. When it finishes, click the URL — Uzi is live. 🎉

---

## After it's live
- Visit the URL → **Sign up** → run the onboarding wizard → see your calendar.
- To make changes: we keep editing the code here in Cowork; re-upload the changed files to GitHub (or connect it properly later) and Vercel redeploys automatically.

## Notes / troubleshooting
- **Database connection limits:** Neon's pooled connection string works best with serverless. If you ever see connection errors under load, append `&pgbouncer=true&connection_limit=1` to `DATABASE_URL`.
- **Schema changes later:** when we add tables/columns, I'll give you the new SQL to paste into Neon's SQL Editor — no terminal needed.
- **Custom domain:** Vercel → Project → Settings → Domains → add `app.youruzi.com` (or similar).
- **What's NOT live yet:** real publishing to social channels (Phase 3) — that needs the platform API approvals. Everything up to the calendar works now.
