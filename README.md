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

## Tech stack

- Vanilla JS (ES modules, no frameworks)
- IndexedDB for persistence
- CSS custom properties, mobile-first layout
