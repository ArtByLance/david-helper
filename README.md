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

The production door-helper route is:

```text
https://davidsshelves.netlify.app/helper/door
```

Python's basic local server does not provide Netlify's route fallback. Use this
equivalent local preview URL:

```text
http://localhost:8000/?helper=door
```

### Test a fake point in time

```text
http://localhost:8000/?debugNow=2026-03-04T10:20:00
```

Combine `helper=door` and `debugNow` to test helper messages at a specific time.

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

### Tablet performance mode

Old/low-power tablets automatically use lite rendering. You can force it and
save the preference on the tablet with:

```text
https://davidsshelves.netlify.app/?perf=lite
```

To force the full renderer again:

```text
https://davidsshelves.netlify.app/?perf=full
```

## Current Structure

- `index.html` provides the kiosk-safe portrait stage and compact meal timer.
- `js/main.js` owns app state, shelf expansion, reader flow, watch handoff, and meal timing.
- `data/schedule/01-daily.json`, `02-weekly.json`, and `03-monthly.json` are the only schedule sources for meals, helper events, and Today cards.
- `js/playback.js` contains the playback abstraction and current VoiceMonkey adapter.
- `css/layout.css` and `css/text.css` define the physical shelf, paper, and card styling.
- `data/shows.json` owns the show shelf categories, art ids, and VoiceMonkey commands.
- `netlify/functions/voice-monkey.js` owns the private VoiceMonkey token handoff.

## Meal Timer

The persistent meal timer shows the next event marked as a meal in the merged
daily, weekly, and monthly JSON schedule.

Meals use two-hour serving windows. During the first hour the timer says the
current meal is being served and names the following meal. During the second
hour it returns to the normal next-meal countdown.

After supper it shows `REST WHEN READY`.

## Playback

The shelf UI calls `launchVideoItem(item)`. In `OFFSITE` mode it shows the Netlify Function URL on the handoff note for testing. In `LIVE` mode it calls the Netlify Function, which adds `VOICEMONKEY_TOKEN` server-side and triggers VoiceMonkey.
