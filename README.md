# David's Stuff

A portrait tablet companion app for David.

The app is meant to feel like one familiar physical place: David's personal shelf unit. The home screen shows three shelves:

- Today Shelf
- Shows Shelf
- Books Shelf

Tapping a shelf expands it. Books and shows come off the shelf before David chooses `READ`, `WATCH`, or `PUT BACK`.

## Local development

From the project folder:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

### Test a fake point in time

```text
http://localhost:8000/?debugNow=2026-03-04T10:20:00
```

## Netlify Deployment

Production URL:

```text
https://davidsshelves.netlify.app/
```

This is a static Netlify deploy from the repo root. The deployment includes:

- `_redirects` so `/today`, `/shows`, `/books`, and refreshes fall back to `index.html`.
- `_headers` and `robots.txt` so the family utility stays out of search indexes.
- `sw.js` and `manifest.webmanifest` so the tablet keeps the app shell and media assets cached after first load.
- `netlify/functions/voice-monkey.js` so the browser can launch shows without exposing the VoiceMonkey token.

Set this Netlify environment variable before switching `data/config.json` from `OFFSITE` to `LIVE`:

```text
VOICEMONKEY_TOKEN
```

Optional override:

```text
VOICEMONKEY_ENDPOINT
```

## Current Structure

- `index.html` provides the kiosk-safe portrait stage and compact meal timer.
- `js/main.js` owns app state, shelf expansion, reader flow, watch handoff, and meal timing.
- `js/app-data.js` contains sample meals, today-only notes, books, and shows.
- `js/playback.js` contains the playback abstraction and current VoiceMonkey adapter.
- `css/layout.css` and `css/text.css` define the physical shelf, paper, and card styling.
- `data/shows.json` owns the show shelf categories, art ids, and VoiceMonkey commands.
- `netlify/functions/voice-monkey.js` owns the private VoiceMonkey token handoff.

## Meal Timer

The persistent meal timer shows only the next meal:

- Breakfast: 7:00 AM
- Lunch: 12:00 PM
- Supper: 5:00 PM

After supper it shows `REST WHEN READY`.

## Playback

The shelf UI calls `launchVideoItem(item)`. In `OFFSITE` mode it shows the Netlify Function URL on the handoff note for testing. In `LIVE` mode it calls the Netlify Function, which adds `VOICEMONKEY_TOKEN` server-side and triggers VoiceMonkey.
