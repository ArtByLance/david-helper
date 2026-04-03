# Fire TV Notes

This project is already a good fit for Fire TV because it is:

- a single-screen dashboard
- fixed to a 1920x1080 stage
- mostly static once loaded
- happy living in a browser or web-app shell

## Best Path

Recommended ship path: hosted web app on Fire TV.

Why this is the best first version:

- easy to update without rebuilding an app package
- works well for a screen like this that is mostly HTML CSS and JS
- keeps the project simple while we prove the final layout on the actual TV

If later we decide this screen must work fully offline, that is the moment to
evaluate a packaged web app or a native wrapper.

## Quick Device Test

The easiest on-device test is to host this project on your local network and
open it on the Fire TV using Amazon's Web App Tester.

### 1. Start a server that is visible on your network

From this project folder:

```bash
python3 -m http.server 8000 --bind 0.0.0.0
```

### 2. Find your computer's local IP address

Examples:

```bash
ipconfig getifaddr en0
```

or, if needed:

```bash
ifconfig | rg "inet "
```

You want something like `192.168.1.25`.

### 3. Build the Fire TV URL

Use:

```text
http://YOUR-LAN-IP:8000/
```

Example:

```text
http://192.168.1.25:8000/
```

### 4. Open that URL on the Fire TV

Use Amazon Web App Tester on the Fire TV and point it at the URL above.

Helpful debug examples:

```text
http://192.168.1.25:8000/?debugNow=2026-04-01T11:32:00
http://192.168.1.25:8000/?debugNow=2026-04-02T09:15:00
```

## Ship Checklist

Before we call this "stable on TV," check these on the actual Fire TV:

- text is readable from the real viewing distance
- the encouragement note still fits with the longest practical phrase
- the NOW flag points to the right row on the real panel
- the clock stays crisp and centered
- the screen survives a reload without layout drift
- no browser chrome or overlays are distracting

## Recommended Hosting For A Real Install

For a real household setup, prefer a simple stable host:

- a small local server that is always on
- or a basic hosted HTTPS site if internet reliability is good

Keep the URL stable so the Fire TV launcher/tester does not need to be updated
every time the app changes.

## A Few Practical Notes

- This dashboard does not need a build step right now.
- The project is already static-site friendly.
- If the Fire TV feels slightly different from desktop, trust the TV and tune
  on the TV.
- If we later want true kiosk behavior, startup launch, or tighter remote
  control behavior, that can be a separate pass. No need to mix that into this
  first stable version.
