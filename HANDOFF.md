# Vokabelmonster Handoff

- **Project status**: Phase 7 complete (All 0–7 phases complete!)
- **Live URL**: `https://farzaneh-alimhmmdi.github.io/Vokabelmonster/`
- **Last deployed APP_VERSION**: `1.0.0`
- **Last git tag**: `phase-7-done`

## Completed phases
- Phase 0: Skeleton, manifest, icons, service worker, IndexedDB v1, hash router, Settings diagnostics.
- Phase 1: Manual cards CRUD, duplicate lemma prevention, search & tag filter, default tags, article color-coding.
- Phase 2: Dictionary search (de.wiktionary.org + MyMemory), IndexedDB dictCache, pre-filled Add flow, offline fallback.
- Phase 3: SM-2 spaced repetition (`js/srs.js` + `tests/srs.test.mjs`), flashcard review UI, undo, `reviewLog`.
- Phase 4: German TTS (`js/tts.js`) on cards/search/review + exercise modes (Type, Multiple Choice, Cloze, Article).
- Phase 5: Stats (streak, SVG progress ring, 7-day chart, state counts, difficult words) + monster mascot states in Review.
- Phase 6: Backup/Restore (JSON & CSV), Share my word list (`navigator.share` / download), merge-without-duplicates, Study Settings.
- Phase 7: Paging for 5,000+ cards, SW update toast, in-app error log, Persian README.

## Current phase
All planned phases (0–7) are complete!

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
All phases complete! Merge to `main` and enjoy Vokabelmonster v1.0.1.

## SHARING & CONVENIENCE (HIGH PRIORITY)
- Full-database Export/Import JSON (backup) and "Share list" (cards only, no SRS progress). Import merges by normalized lemma, never overwrites, and shows a preview ("12 new, 3 already exist").
- One-tap "Backup now" button on the Words screen using `navigator.share({files})` with download fallback.
- All primary actions reachable with one thumb at the bottom of the screen.
- Adding a word from search takes at most 2 taps.

## FEATURE: AUTO ARTICLE + VERB CONJUGATION (BACKLOG / NEXT)
- Offline-first data source order (adapter pattern):
  1. Bundled `/data/de-dict.json` (built with `/tools/build-dict.mjs` from kaikki.org German JSONL, loaded into IndexedDB `dictLocal`).
  2. Online fallback: German Wiktionary MediaWiki API (`origin=*`), 6s timeout + `AbortController`, cached in `dictCache`.
  3. Rule-based generator `/js/morphology.js` (pure functions, node-tested) for regular verbs only (`confidence: "guess"`, "please verify" badge; never guess irregular verbs).
- Nouns: always return article (`der/die/das`) + plural; support multiple genders (e.g. `der/das Joghurt`); leave `null` if unknown.
- Data model change (requires DB v2 migration + automatic snapshot):
  - Extend `verbForms` to `{ praesens: {ich,du,er,wir,ihr,sie}, praeteritum, partizip2, hilfsverb, separable, prefix, imperativ: {du,ihr,Sie} }`.
  - Add `comparative`, `superlative`, `genitive` to cards.
- UI: compact conjugation table (tap to expand), colored article badge, "verify" badge on guessed data, all fields editable before saving, `< 100ms` offline local search.
- Tests: node tests for `morphology.js` (`machen`, `arbeiten`, `lernen`, `öffnen`, etc.).

## FEATURE: IMPORT / EXPORT / BULK ADD / SHARING (BACKLOG / ENHANCEMENTS)
1. **Export** (`navigator.share({files})` with download fallback):
   - Full backup JSON (`cards`, `reviewLog`, `settings`, schema version, app version, `exportedAt`).
   - Share word list JSON (`vokabelmonster-words-YYYY-MM-DD.json`, cards only, optional tag/level filter).
   - CSV export (UTF-8 with BOM for Excel ä/ö/ü & Persian: `lemma, article, pos, plural, meaningFa, meaningEn, example, tags, level`).
2. **Import** (file picker + paste text):
   - Validate schema/format with clear error messages; preview (`"12 new, 3 already exist, 1 invalid"`); merge by normalized lemma (+ article for nouns) with skip or fill-empty-fields option; full-backup restore asks confirmation + takes automatic snapshot first.
   - Robust CSV parser in `js/csv.js` (quoted fields, `;`/`,`/tab delimiters, optional header) with node tests.
3. **Bulk Add** ("Add many words" screen):
   - Textarea (one entry per line) with optional dictionary enrichment.
