# 🏋️ Training Game

A child-friendly single-page workout tracker game. Log daily exercises, earn points, build streaks, and collect crystals — all stored locally in your browser with no server needed.

## Features

- **🦸 Hero** — Customise your avatar and name, track level, points, streak and crystals
- **⚡ Today** — Check off exercises, then complete the workout to earn points
- **📋 Program** — Create programs with reps/seconds exercises; reorder and toggle active state
- **📅 History** — Full log of past workouts with status, completion and streak
- **💾 Backup** — Export/import all data as a JSON file

## Streak & Points rules

| Event | Points |
|---|---|
| Complete a workout | +1 |
| Every 5th consecutive day | +5 bonus |
| Any points → 💎 crystal | convert all current points |

Level = `floor(lifetimePoints / 10) + 1`

## File structure

```
training-game/
├── index.html          # Single-page shell, tab navigation
├── css/
│   └── style.css       # Mobile-first, child-friendly styles
└── js/
    ├── storage.js      # IndexedDB abstraction (TrainingGameDB)
    ├── hero.js         # Hero CRUD + level calculation
    ├── programs.js     # Program & exercise CRUD
    ├── daily-log.js    # Day log, streak logic, point awards
    ├── rewards.js      # Crystal conversion & reward history
    └── ui.js           # DOM rendering, tab routing, entry point
```

## Running locally

Open `index.html` in any modern browser — no build step required.  
For full ES-module support open via a local HTTP server, e.g.:

```bash
npx serve .
# or
python3 -m http.server
```

## Accessing from iPhone or Android

Because the app is pure HTML/JS/CSS with no backend, you need to serve it over HTTP(S). Below are your options ranked from easiest to most control.

---

### Option A — GitHub Pages (Recommended for free hosting)

> ⚠️ Requires the repository to be **public** (free plan) or your organisation to have GitHub Pages enabled (Enterprise).

1. Go to **https://github.com/sdubov_chkp/training-game**
2. Click **Settings** → **Pages** (left sidebar)
3. Under *Source*, choose **Deploy from a branch**
4. Branch: `main`, Folder: `/ (root)` → click **Save**
5. Wait ~1 minute, then your app is live at:  
   **`https://sdubov_chkp.github.io/training-game`**
6. Open that URL on any iPhone or Android browser — no install needed
7. To add to your home screen:
   - **iPhone (Safari):** tap the Share icon → "Add to Home Screen"
   - **Android (Chrome):** tap the 3-dot menu → "Add to Home screen"

Every time you `git push`, GitHub Pages automatically updates the live app.

---

### Option B — Netlify (Free, works with private repos)

1. Go to **https://netlify.com** and sign in with GitHub
2. Click **Add new site → Import an existing project**
3. Choose GitHub and select `sdubov_chkp/training-game`
4. Build command: *(leave empty)*, Publish directory: `.` (root)
5. Click **Deploy site**
6. You get a free URL like `https://your-name.netlify.app`
7. Every `git push` auto-deploys

---

### Option C — Local network (no internet needed)

Run the app on your computer and access it from any phone on the same Wi-Fi:

```bash
cd training-game
npx serve .
```

Look for the *Network* address in the output (e.g. `http://192.168.1.10:3000`). Open that URL in your phone's browser.

---

## Tech stack

- Vanilla JS (ES modules, no frameworks)
- IndexedDB for persistence
- CSS custom properties, mobile-first layout
