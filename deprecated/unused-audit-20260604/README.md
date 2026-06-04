# Unused Production Audit - 2026-06-04

This folder quarantines files that were not reachable from the production app
entrypoints, service worker preload list, active data files, or dynamic media
paths at the time of the audit.

Archived and lab material was intentionally left in place elsewhere:

- `assets/unused/`
- `data/reader/books/old/`
- lab/test HTML pages
- legacy prototype modules under `js/`

The files here are preserved for review instead of being deleted immediately.
If the app runs cleanly through a release cycle without needing them, they can be
removed in a later cleanup.

## Quarantined Groups

- Old media SVGs from the retired inline reader catalog.
- Old object/font assets that are not referenced by the production app,
  including the retired standalone spine PNGs.
- Unreferenced fifth chapter images for active books that now use four chapters.

`true-heroes-audie-murphy-5.jpg` was not quarantined because the active book JSON
explicitly references it.
