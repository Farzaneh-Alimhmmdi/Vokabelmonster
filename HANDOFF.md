# Vokabelmonster Handoff

- **Project status**: Phase 0 complete (100% of Phase 0)
- **Live URL**: `https://farzaneh-alimhmmdi.github.io/Vokabelmonster/` (after enabling GitHub Pages)
- **Last deployed APP_VERSION**: `0.0.1`
- **Last git tag**: `phase-0-done`

## Completed phases
- Phase 0: Skeleton, manifest, icons, service worker, IndexedDB v1, hash router, Settings diagnostics.

## Current phase
Phase 0 is complete. Waiting for user confirmation on iPhone before starting Phase 1.

## File map
- `index.html`: App shell, iOS meta tags, header, bottom tab bar.
- `manifest.webmanifest`: PWA manifest with relative `./` paths.
- `sw.js`: Service worker with versioned cache (`vokabelmonster-v0.0.1`) and relative precache URLs.
- `css/app.css`: Mobile-first styles, light/dark mode CSS variables, safe-area insets.
- `js/version.js`: Single source of truth for `APP_VERSION`.
- `js/app.js`: Bootstrap, IndexedDB init, SW registration, hash router.
- `js/db.js`: IndexedDB wrapper and schema v1 (`cards`, `reviewLog`, `settings`, `dictCache`).
- `js/ui/search.js`: Search tab placeholder.
- `js/ui/review.js`: Review tab placeholder.
- `js/ui/words.js`: Words tab placeholder.
- `js/ui/stats.js`: Stats tab placeholder.
- `js/ui/settings.js`: Settings & diagnostics (version, network, storage persistence, DB counts).
- `icons/*`: Monster placeholder PNGs (192, 512, maskable 512, apple-touch-icon 180).

## Data model & DB version
- Current DB version: `1` (`vokabelmonster`)
- Stores: `cards` (indexes: `lemmaNorm` unique, `srsDue`, `tags` multiEntry), `reviewLog` (indexes: `cardId`, `ts`), `settings`, `dictCache`.

## External APIs
- None yet (Phase 2).

## Decisions made
- Kept `APP_VERSION` in `js/version.js` and mirrored `CACHE_VERSION` in `sw.js` (classic SW script) for maximum iOS Safari compatibility.
- Used `lemmaNorm` as the unique index name on `cards` for lowercase-normalized lemma duplicate prevention.

## Known bugs
- None.

## Backlog
- Phase 1: Manual cards CRUD, default tags, search & tag filter.
- Phase 2: Dictionary search adapters (Wiktionary, MyMemory, OpenThesaurus).
- Phase 3: SM-2 spaced repetition & review UI.
- Phase 4: TTS & exercise modes.
- Phase 5: Stats & monster mascot states.
- Phase 6: Backup, CSV/JSON import/export, sharing between phones.
- Phase 7: Performance, error log, SW update toast, Persian README.

## How to run/test
```bash
python3 -m http.server 8000
# Open http://localhost:8000
```

## NEXT STEP
Confirm Phase 0 works on iPhone (GitHub Pages + Add to Home Screen + Airplane mode), then begin Phase 1: Manual cards (core CRUD) in `js/db.js` and `js/ui/words.js`.
