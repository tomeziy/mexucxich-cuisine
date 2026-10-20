---
name: verify-mexucxichcuisine
description: Programmatically drive and verify Mexucxich Cuisine POS web application, customer search/ranking, pagination, and sync logic via headless Playwright or Chrome CDP.
disable-model-invocation: true
author: tomeziy
---

# verify-mexucxichcuisine

Project-local verification skill for **Mexucxich Cuisine POS** (`projects/MexucxichCuisine`).

## 1. Surface
- Primary surface: Web Single Page Application (React 19 + TypeScript + Tailwind CSS + HashRouter).
- Live deployment URL: `https://tomeziy.github.io/mexucxich-cuisine/#/`
- Local production build: `dist/index.html` (built via `npm run build`).

## 2. Launch & Doctor
- App health check command:
  ```bash
  node ./node_modules/typescript/bin/tsc --noEmit && node scripts/test_adr0010.js && node scripts/test_sync_conflict.js
  ```
- Strict Rule: DO NOT run `npm run dev` or `npm run preview`.
- Live driving harness uses Playwright headless Chromium against the GitHub Pages deployed surface.

## 3. Drive & Feature Map
- Run the full verification driver:
  ```bash
  python scripts/verify_live_pages.py
  ```
- Features covered:
  1. `features/pos-combobox.md`: Instant customer search, token-based word-boundary ranking (e.g., "Yến" ranks above substring in "Nguyễn"), mouse scroll isolation, and `onMouseDown` 1-touch customer selection.
  2. `features/customers-pagination.md`: KiotViet pagination bar (20, 50, 100 rows/page), page boundary slicing, search reset to page 1.
  3. `features/cross-device-sync.md`: Deterministic pagination tiebreakers (`.order('id')`), `seenIds` client-side deduplication, and atomic stock delta calculations.

## 4. Evidence
- Captured artifacts stored in `projects/MexucxichCuisine/.scratch/verification_evidence/`:
  - `pos_customer_combobox_yen.png`
  - `customers_page_pagination.png`
  - `customers_page_search_yen.png`
  - `verification_summary.json`

## 5. Cleanup
- Browser contexts and pages are safely closed upon driver completion without lingering processes.
