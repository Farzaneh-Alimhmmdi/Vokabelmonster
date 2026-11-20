# Vokabelmonster Handoff

- **Project status**: Phase 5 complete (100% of Phase 5)
- **Live URL**: `https://farzaneh-alimhmmdi.github.io/Vokabelmonster/`
- **Last deployed APP_VERSION**: `0.5.0`
- **Last git tag**: `phase-5-done`

## Completed phases
- Phase 0: Skeleton, manifest, icons, service worker, IndexedDB v1, hash router, Settings diagnostics.
- Phase 1: Manual cards CRUD, duplicate lemma prevention, search & tag filter, default tags, article color-coding.
- Phase 2: Dictionary search (de.wiktionary.org + MyMemory), IndexedDB dictCache, pre-filled Add flow, offline fallback.
- Phase 3: SM-2 spaced repetition (`js/srs.js` + `tests/srs.test.mjs`), flashcard review UI, undo, `reviewLog`.
- Phase 4: German TTS (`js/tts.js`) on cards/search/review + exercise modes (Type, Multiple Choice, Cloze, Article).
- Phase 5: Stats (streak, SVG progress ring, 7-day chart, state counts, difficult words) + monster mascot states in Review.

## Current phase
Phase 5 is complete. Waiting for user confirmation on iPhone before starting Phase 6.

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
- `de.wiktionary.org/w/api.php` (`origin=*`): German noun article/plural, POS, verb forms, examples.
- `api.mymemory.translated.net/get`: `de|fa` and `de|en` translations (no key, rate-limited for heavy use; cached in `dictCache`).

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
Confirm Phase 5 works on iPhone (Stats + monster mascot), then begin Phase 6: Backup, CSV/JSON import/export, sharing between phones, and Settings.
