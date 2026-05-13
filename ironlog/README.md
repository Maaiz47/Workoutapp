# IRONLOG — Gym Workout Tracker

## Deploy to Vercel (3 steps)

### 1. Push to GitHub
```bash
unzip ironlog-project.zip
cd ironlog
git init && git add . && git commit -m "init"
```
Create a repo on GitHub, then:
```bash
git remote add origin https://github.com/YOUR_USERNAME/ironlog.git
git branch -M main && git push -u origin main
```

### 2. Create database + deploy
1. Go to [vercel.com/new](https://vercel.com/new) → Import your repo
2. Go to **Storage** tab → **Create Database** → **Postgres (Neon)** → Free tier
3. Link it to your project (Vercel auto-adds `DATABASE_URL`)
4. In project **Settings → General → Build Command**, set:
   ```
   prisma db push && next build
   ```
5. Redeploy

### 3. Done
Open your Vercel URL — type a username and start tracking.

## Local Dev
```bash
npm install
cp .env.example .env.local  # add your DATABASE_URL
npx prisma db push
npm run dev
```

## Features
- Username-only login (no passwords, no OAuth)
- 5-day Push/Pull/Legs/Push/Pull split
- Set logging with weight + reps
- Weight change % indicator (green ▲ / red ▼)
- Rest countdown timer with audio beep
- Session timer
- Full progress history
- Data persists in PostgreSQL
