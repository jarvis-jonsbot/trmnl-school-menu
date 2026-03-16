# TRMNL School Menu

Displays today's breakfast and lunch menus from Roy Cloud School on a TRMNL e-ink display.

**Live page:** https://jarvis-jonsbot.github.io/trmnl-school-menu/

## How it works

1. **GitHub Actions** runs at 6 AM and 11 AM PT on weekdays
2. `generate.js` fetches today's menus from the HealthePro JSON API (no auth required)
3. Generates a static `docs/index.html` sized for TRMNL (800×480px, black & white)
4. Commits and pushes to `main` → GitHub Pages serves it automatically

Handles school closures gracefully (shows reason from school calendar). No server to maintain.

## TRMNL Setup

Use TRMNL's **Website** plugin:
- URL: `https://jarvis-jonsbot.github.io/trmnl-school-menu/`
- The page is pre-sized to 800×480 for clean e-ink rendering

Or point `menu.ulfhedinn.net` → GitHub Pages and use that URL.

## Local development

```bash
node generate.js   # generates docs/index.html
open docs/index.html
```

## Files

| File | Purpose |
|------|---------|
| `generate.js` | Fetches menus + generates static HTML |
| `docs/index.html` | Generated output (committed by CI) |
| `.github/workflows/update-menu.yml` | Runs daily on weekdays |
| `server.js` | Legacy Express server (POST /markup) — kept for reference |
