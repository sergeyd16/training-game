# Training Game — Base44 Dev Notes

## What this app is
Pure static single-page app: vanilla JS (ES modules), IndexedDB for persistence, no backend, no build step, no dependencies. Files: `index.html`, `css/style.css`, `js/*.js`.

## Running in the Base44 sandbox
- Served by `nginx:alpine` via `docker-compose.base44.yml`, bind-mounted read-only at `/usr/share/nginx/html`.
- Web entry point on host port 3000.
- No environment variables or secrets required.
- The repo root and `css/`, `js/` directories must be world-traversable (`chmod 755`) for the nginx worker user to read the bind-mounted files — the clone ships with `700` on the root, which causes 403 Forbidden otherwise.

## Verifying it works
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` → 200
- `curl -s http://localhost:3000/js/ui.js` returns the live JS source.
- Preview should show the Training Game with bottom tab nav (Hero, Today, Program, History, Backup).

## Editing
- Edits to `index.html`, `css/style.css`, or `js/*.js` appear immediately on browser refresh (nginx serves the bind-mounted source directly; there is no live-reload watcher, so call `reload_preview` after changes to force the iframe to refresh).
