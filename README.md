# David Helper Dashboard

A TV-first orientation screen for David.

## What it does

The screen is designed to answer four simple questions:

1. What day is it
2. What time is it
3. What's next
4. How long until it happens

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
http://localhost:8000/?debugNow=2026-04-01T11:32:00
```

Useful examples:

- `?debugNow=2026-04-01T11:32:00` → countdown to lunch
- `?debugNow=2026-04-01T12:00:00` → HAPPENING SOON state for lunch
- `?debugNow=2026-04-02T09:15:00` → Thursday laundry hold window

## Data files

### `data/config.json`
App-wide settings like:
- location name
- tick frequency
- active day window
- default hold duration
- top-right prompt

### `data/daily.json`
The fixed every-day anchors.

### `data/weekly.json`
Reliable recurring weekly overrides by weekday.

### `data/monthly.json`
Date-specific overrides.

## Override strategy

Most of the time, the daily anchors remain the same.
Weekly events layer on top of that baseline, and monthly events layer on top of both.

Both weekly and monthly support:
- `add`
- `remove`
- `replace`

## Current implementation notes

- Fixed 1920x1080 inner stage
- Browser scales that stage to fit your viewport
- Countdown runs until event time
- At event time, screen changes to `HAPPENING SOON`
- Progress bar is hidden during `HAPPENING SOON`
- Clock and red line move down the TODAY schedule

## Fire TV

There is now a repo-specific Fire TV runbook in [FIRE-TV.md](./FIRE-TV.md).

Short version:

- quickest real-TV test: host this project on your LAN and open it in Web App Tester
- best first ship path: hosted web app
- no build step is required right now
