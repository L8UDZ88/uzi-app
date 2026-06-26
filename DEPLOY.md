# Deploy Uzi with no machine — all in the browser

~15 minutes, three free accounts: **GitHub** (stores the code), **Neon** (the database), **Vercel** (runs the app). You create the logins; everything else is clicking. **No SQL, no command line** — the tables build themselves on first deploy.

---

## Step 1 — Put the code on GitHub
1. Unzip `uzi-app.zip` on your computer (double-click it).
2. Go to **github.com** → sign up / log in → click **New repository**.
3. Name it `uzi-app`, click **Create repository**.
4. On the empty repo page, click **"uploading an existing file"**.
5. Open the unzipped `uzi-app` folder, select **everything inside it**, and drag it into the browser.
6. Click **Commit changes**.

> Upload giving you trouble? Tell me — I'll switch you to a one-click "Deploy to Vercel" button instead.

---

## Step 2 — Create the database (Neon) — just copy one string
1. Go to **neon.tech** → sign up → **New Project** (name it `uzi`).
2. It shows a **connection string** like `postgresql://...neon.tech/neondb?sslmode=require`.
3. **Important:** if there's a toggle labeled **"Pooled connection,"** turn it **OFF** (use the plain/direct one).
4. **Copy that string.** That's all you do in Neon — no SQL editor, nothing else.

---

## Step 3 — Deploy (Vercel)
1. Go to **vercel.com** → **Sign up with GitHub**.
2. **Add New… → Project** → import your `uzi-app` repo.
3. Open **Environment Variables** and add two:
   - `DATABASE_URL` = the Neon string from Step 2
   - `AUTH_SECRET` = any long random string (mash the keyboard, ~40 characters)
4. Click **Deploy**.

On that first deploy, Uzi automatically creates its database tables for you, then goes live. When it finishes, click the URL. 🎉

---

## After it's live
- Visit the URL → **Sign up** → run the onboarding wizard → see your calendar.
- Changes later: we edit the code in Cowork, you re-upload to GitHub, Vercel redeploys automatically.

## If a deploy fails
Copy the red error text from the Vercel build log and paste it to me — I'll fix it. Most common: the Neon string was the "pooled" one (Step 2.3) — swap it for the direct one and redeploy.

## What's NOT live yet
Real publishing to social channels (Phase 3) needs the platforms' API approvals. Everything up to the auto-built calendar works now.
