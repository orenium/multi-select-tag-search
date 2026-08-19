# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A local-only Chrome extension (Manifest V3) MVP that turns the existing tag chips on a page into a temporary multi-select and opens one combined search for all selected tags. V1 supports IMDb title pages only. Everything lives in `multi-select-search/`.

Hard product constraints (do not violate):
- No data collection, analytics, telemetry, backend, or external APIs.
- No persistence of any kind: no `chrome.storage`, `localStorage`, IndexedDB, or cookies. Selection state is in-memory only.
- Permissions stay minimal: `activeTab`, `scripting`, `declarativeContent`. No host permissions, no `<all_urls>`, no `tabs`. `declarativeContent` exists solely to colour the toolbar icon on supported sites — Chrome matches those rules internally, so that mechanism passes no URLs to the extension. (The injected content script does read `location.href` locally to pick an adapter; keep privacy copy precise about that distinction.)
- Vanilla JS/HTML/CSS, no framework, no bundler, no build step. Files are loaded as-is.

`tests/manifest.test.js` enforces all of the above automatically (permission set, absence of storage/network calls in page code, file references). If a change trips it, the constraint is the thing to respect — not the test.

## Commands

```bash
# All test suites (queryBuilder, siteCatalog, popupModel, manifest)
cd multi-select-search && node tests/run.js

# Syntax-check all sources
cd multi-select-search && for f in $(find src tools -name '*.js'); do node --check "$f"; done

# Regenerate artifacts after changing icons or the catalog
cd multi-select-search && node tools/generateIcons.js
cd multi-select-search && node tools/generateSupportedSites.js

# Build the Chrome Web Store upload (runs tests, blocks on DEBUG=true, verifies the zip)
cd multi-select-search && node tools/package.js

# Browser QA without loading the extension (real sources, fake tag page)
python3 -m http.server 8765 --directory multi-select-search
# → http://localhost:8765/tests/manual/pageHarness.html   (drive via MSQ.command(...))
# → http://localhost:8765/src/popup/popup.html            (renders 'blocked'; call applyState(fakeState) to preview other modes)
```

There is no build, lint, or install step. Manual testing loop: edit code → `chrome://extensions` → reload the extension card → refresh the IMDb tab → click the toolbar icon. Test pages: Shawshank `imdb.com/title/tt0111161/`, Green Mile `imdb.com/title/tt0120689/`. Full manual QA checklist and troubleshooting are in `multi-select-search/README.md`.

## Architecture

Activation flow: toolbar click opens `src/popup/popup.html` → `popup.js` injects the `CONTENT_FILES` list into the active tab via `chrome.scripting.executeScript` (opening the popup is what grants `activeTab`), then drives the page through `MSQ.command(name, arg)` — a command bridge in `main.js` returning structured-cloneable state (`state`, `activate`, `exit`, `clear`, `deselect`, `searchUrl`). Injection no longer toggles anything; `main.js` has no side effect at the end. Every file re-executes on every popup open, so **all content files must be idempotent** — guarded assignments on the shared `window.MSQ` namespace (`MSQ.x = MSQ.x || ...`), and never bare top-level `const`/`let` (re-injection would throw).

Popup: `src/popup/popupModel.js` is a pure state→view-model function (unit-tested); `popup.js` only injects, dispatches commands, and renders. It deliberately does **not** show the list of supported sites — that lives on the store listing, which can be updated without shipping a build (an installed extension would otherwise advertise a stale list). Feedback and "suggest a site" open a `mailto:` draft (`FEEDBACK_EMAIL`); the extension never transmits anything itself. The popup is the global view of the selection because a user can tick tags belonging to different items on one page (e.g. several Stack Overflow questions) while the in-page bar sits next to only one of them. `applyState(state)` is the single funnel for updating the UI — it is a function declaration on purpose, so browser QA can preview any state.

Background worker (`src/background/serviceWorker.js`) is cosmetic only: it `importScripts` the catalog to build `declarativeContent` rules that swap in `icons/icon-active-*.png` on verified domains (built as `ImageData` via OffscreenCanvas, which MV3 requires), and mirrors the live selection count onto the action badge from `runtime.sendMessage` (`sender.tab.id` avoids needing the `tabs` permission). Domains come from `verifiedDomains()`, derived from each config's host RegExp — never hardcode a second list.

Layering (core must never contain platform-specific logic):
- `src/core/registry.js` — adapter registry defining the PlatformAdapter contract: `{id, matches(url), findSelectableItems(doc), extractItem(el), buildSearchUrl(items), describeStrategy(items), getBarAnchor(doc, els)}`.
- `src/content/main.js` — controller singleton: mode state, chip enhancement/restore, selection Map, MutationObserver for re-renders/SPA nav, and `cleanup()` which must restore the page to pristine state (verified zero leftover `msq-` nodes/classes/attrs/listeners).
- `src/ui/` — action bar, toast, and all CSS (as a JS string in `styles.js`, injected as one `<style id="msq-styles">` tag). Every class is `msq-` prefixed.
- `src/adapters/imdb/` — all IMDb knowledge. `imdbSelectors.js` = DOM discovery only (three fallback strategies; never generated CSS class names). `imdbQueryBuilder.js` = pure functions, UMD-style export so the same file runs in Node tests and the browser. `imdbAdapter.js` = wires both into the contract.

Adding a platform: for most sites, add a config object to `src/adapters/siteCatalog.js` (see below); only write a bespoke folder under `src/adapters/` (like IMDb's) when the site needs custom classification logic. Bespoke files must be appended to `CONTENT_FILES` in `src/popup/popup.js` (order matters: query builder → selectors → adapter, all before `main.js`). Adding a verified site automatically extends the icon rules and `SUPPORTED_SITES.md` — rerun `node tools/generateSupportedSites.js`.

### Multi-site engine (config-driven adapters)

- `src/core/siteAdapterEngine.js` — `MSQ.createSiteAdapter(config)` turns a small config `{id, host, path, tagPattern, buildUrl, ...}` into a full PlatformAdapter. Anchor mode scans `a[href]` against `tagPattern` (capture 1 = raw, still-URL-encoded value); `chipSelector` + `extractValue` handle non-anchor chips (PubMed MeSH buttons). UMD export for Node tests.
- `src/adapters/siteCatalog.js` — 98 sites, 21 categories, max 5/category. **Status field is a hard honesty gate**: `verified` (AND semantics + DOM pattern confirmed live via result-count comparison; registered and active), `draft` (mechanism drafted but unverified; registered only when `MSQ.ENABLE_DRAFT_SITES` in debug.js is true), `research` (no known true-AND URL — never registered). Never promote a site to `verified` without measured counts pasted into its `evidence` field (`combined < min(singles)` = AND). Known negatives are documented in the catalog: GOG's tags param is OR; Open Library's repeated `subject=` is not AND; YouTube hashtags are text relevance.
- Verified beyond IMDb (2026-08-19): Letterboxd, Stack Overflow + 4 SE-network sites, GitHub, npm, Steam (numeric tagids parsed from `InitAppTagModal` JSON on app pages), itch.io (path-composed `/games/tag-a/tag-b`), AO3 (base tag path + `other_tag_names` filter), Discogs (`style_exact`/`genre_exact` repeated params), arXiv (advanced-search `cross_list_category` terms), PubMed (`"X"[MeSH Terms] AND ...`), Safebooru (`tags=a+b`).
- Verification tips: many sites are Cloudflare-walled to curl (SO, npm, Danbooru, Discogs) — verify via a real browser tab and same-origin `fetch` from the page console instead.

## IMDb domain knowledge (verified live 2026-08-19)

- All title-header chips — including plain genres like "Drama" — are IMDb "Interests" linking to `/interest/inNNNNNNN/` with stable IDs (Prison Drama = `in0000085`).
- Advanced Title Search `?interests=id1,id2` is a true AND intersection (verified via result counts: Period 5,162 ∩ Prison 309 → 31). `genres=` and `keywords=` params are also ANDed and combinable in the same URL.
- The query builder passes interest IDs through as the primary mechanism; genre/keyword classification exists only as fallback for legacy link shapes, and slugified-label keyword search is the lossy last resort.
- Chip discovery signals, in order: `[data-testid="interests"]` container → `ref_=tt_ov_in` href marker → heuristic short-label `/interest/in…` links near page top. If IMDb changes markup, fix only `imdbSelectors.js`.

## Debugging

`MSQ.DEBUG` in `src/core/debug.js` gates all logging (console only, prefixed `[MultiSelect]`). Content logs appear in the page console; the service worker console is behind the "service worker" link on the extension's card in `chrome://extensions`.
