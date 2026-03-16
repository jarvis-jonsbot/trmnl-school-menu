# TRMNL School Menu Plugin

Displays today's breakfast and lunch menus from Roy Cloud School (HealthePro / menus.healthepro.com) on a TRMNL e-ink display.

## How it works

- Fetches data from HealthePro's undocumented JSON API (no auth required)
- Exposes a `POST /markup` endpoint that TRMNL polls periodically
- Returns TRMNL-formatted HTML for full-screen and mashup layouts
- Handles school closures ("No school today" reason shown)

## Setup

### 1. Install & run

```bash
npm install
npm start
# Server starts on port 3721
```

### 2. Expose to the internet

The TRMNL server needs to reach your `/markup` endpoint. Options:
- **Caddy reverse proxy** on your Mac mini (already set up for openclaw.ulfhedinn.net)
- **ngrok** for quick testing: `ngrok http 3721`
- Add a subdomain to your Caddyfile, e.g. `menu.ulfhedinn.net`

### 3. Create a Private Plugin on TRMNL

1. Go to https://trmnl.com/plugin_settings/new?keyname=private_plugin
2. Set **Markup URL** to: `https://menu.ulfhedinn.net/markup` (or your ngrok URL)
3. Set polling interval (e.g. 60 min — menu doesn't change during the day)
4. Add to your TRMNL playlist

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/markup` | TRMNL plugin endpoint — returns JSON with HTML markup |
| GET | `/preview` | Browser-friendly JSON preview of today's parsed menus |
| GET | `/` | Health check |

## Menu IDs

| Menu | ID |
|------|----|
| Breakfast | 103752 |
| Lunch | 103751 |

Both are under org `1184`, site `9283`.

## Run as a service (launchd on Mac)

```bash
# Copy the plist to ~/Library/LaunchAgents/
cp com.jarvis.trmnl-school-menu.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.jarvis.trmnl-school-menu.plist
```
