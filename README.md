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

## Current Structure

- `index.html` provides the kiosk-safe portrait stage and compact meal timer.
- `js/main.js` owns app state, shelf expansion, reader flow, watch handoff, and meal timing.
- `js/app-data.js` contains sample meals, today-only notes, books, and shows.
- `js/playback.js` contains the playback abstraction and current VoiceMonkey adapter.
- `css/layout.css` and `css/text.css` define the physical shelf, paper, and card styling.

## Meal Timer

The persistent meal timer shows only the next meal:

- Breakfast: 7:00 AM
- Lunch: 12:00 PM
- Supper: 5:00 PM

After supper it shows `REST WHEN READY`.

## Playback

The shelf UI calls:

```js
PlaybackService.play(item)
```

The current adapter is VoiceMonkey. Future Plex playback should be added behind the same service boundary so the shelf UI does not change.
