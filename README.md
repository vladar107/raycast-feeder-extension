# Feeder

Raycast extension for [feeder.co](https://feeder.co) — read your RSS feeds in Raycast with read-state synced back to Feeder.

## Commands

- **Show Unread Feeds** — unread posts grouped by feed. Open in browser (auto-marks read), mark as read, star/unstar, mark a feed or everything as read.
- **Show All Feeds** — all subscriptions with unread badges; drill into a feed's recent posts.
- **Add RSS Feed** — subscribe to a new feed (prefills the URL from your clipboard).

## Setup

Feeder's OAuth API credentials are effectively unobtainable (support doesn't respond), so this extension authenticates the same way Feeder's own web app does: with your session cookie.

1. Log in at [feeder.co](https://feeder.co).
2. Open DevTools → Application → Cookies → `https://feeder.co`.
3. Copy the value of `_feeder.co_session`.
4. Paste it into the extension's **Feeder Session Cookie** preference.

The cookie is set with a ~20-year expiry, so this is a one-time setup. It is stored in Raycast's encrypted preferences and only ever sent to feeder.co. If you log out everywhere or change your password, the cookie is invalidated — repeat the steps above.

## API

Uses the [feeder.co REST API](https://github.com/feederco/feeder-api) (`https://feeder.co/1/`): `/posts/unread`, `PATCH /posts/:id` for read/star state, `/feeds`, `/feeds/unread` for counts, and `/feeds/:id/mark-as-read`.

## Install (no store needed)

```sh
npm install
npm run dev
```

Once Raycast shows the commands, stop the dev server (Ctrl+C) — the extension stays installed permanently as a local extension and keeps running the last build from this folder. Don't move or delete the folder. After changing the code, run `npm run build` (or `npm run dev` again) to update it.

Personal-use extension — cookie auth isn't suitable for the Raycast Store.
