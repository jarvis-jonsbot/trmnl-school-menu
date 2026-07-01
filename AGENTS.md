# AGENTS.md

## Architecture decision: static site only, no live servers

This project is a **static site**. GitHub Actions runs `generate.js` on a
schedule, commits `docs/index.html`, and GitHub Pages serves it. TRMNL polls
the GitHub Pages URL directly via its "Website" plugin. There is no backend
to run, no server to deploy, no process to babysit.

**Do not stand up a Node/Express server (or any other long-running local
process) to serve TRMNL content live.** This was already tried once (see
Incident Log below) and it cannot work:

- The Mac mini's public hostname (`openclaw.ulfhedinn.net`) resolves to a
  private LAN address (`192.168.9.x`), not a public one. It is not reachable
  from the public internet — not with a VPN, not with a Caddy reverse proxy,
  not under any configuration. That's true of anything hosted on that box.
- TRMNL's poller runs from TRMNL's own cloud infrastructure, not from inside
  the house. It can only ever reach things that are genuinely public, like
  GitHub Pages.

If a new feature needs time-sensitive content (e.g. a day-rollover cutoff),
the fix belongs in `generate.js` and the cron schedule in
`.github/workflows/update-menu.yml` — not in a new server process.

`server.js` exists in this repo as legacy/reference only (see README's file
table). It is not deployed anywhere and must not be. If you're about to
`npm start` it, or write anything like it, as a real running service —
stop and re-read this file instead.

## Incident log

- **2026-06-29 to 2026-07-01**: Built `server.js` + a launchd service + a
  Caddy reverse-proxy route to serve a new "Aurora's Summer Quest" board
  live, violating the constraint above. The endpoint was never reachable by
  TRMNL (private IP, see above) — it served no one for two days. Root cause:
  didn't check network reachability before building, and this file didn't
  yet exist to catch it. Fixed by moving the quest day-rollover logic into
  `generate.js`/the existing GitHub Actions cron instead, and decommissioning
  the launchd service and Caddy route entirely.
