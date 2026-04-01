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

### `data/week.json`
The normal weekly rhythm.

### `data/schedule.json`
Date-specific changes.

## Override strategy

Most of the time, the weekly schedule remains the same.
`schedule.json` exists mainly to interject one-off events.

Supported override buckets:
- `add`
- `replace`
- `remove`

## Current implementation notes

- Fixed 1920x1080 inner stage
- Browser scales that stage to fit your viewport
- Countdown runs until event time
- At event time, screen changes to `HAPPENING SOON`
- Progress bar is hidden during `HAPPENING SOON`
- Clock and red line move down the TODAY schedule
