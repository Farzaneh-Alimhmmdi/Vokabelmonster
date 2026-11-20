# Vokabelmonster Architecture

## Overview
Vokabelmonster is a personal, offline-first German vocabulary PWA built with vanilla HTML, CSS, and ES modules (no build step, no framework). It is hosted on GitHub Pages under a subpath (`/vokabelmonster/`), so all asset, manifest, and service worker paths are relative (`./`).

## Core Principles
- **Offline-first**: Service worker (`sw.js`) precaches the app shell and serves cached assets when offline.
- **Local persistence**: IndexedDB (`js/db.js`) stores `cards`, `reviewLog`, `settings`, and `dictCache` with versioned schema migrations.
- **Pure logic modules**: Spaced repetition (`srs.js`), CSV parsing (`csv.js`), and dictionary adapters (`dictionary.js`) are isolated from DOM code for Node unit testing.
- **Hash routing**: `#/search`, `#/review`, `#/words`, `#/stats`, `#/settings` avoid server rewrite rules on GitHub Pages.
- **iOS PWA first**: Safe-area insets, `>= 16px` inputs, `>= 44px` tap targets, `apple-touch-icon`, `navigator.storage.persist()`.
