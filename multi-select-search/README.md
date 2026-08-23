# Multi-Select Tag Search (MVP)

A local-only Chrome extension (Manifest V3) that temporarily turns the existing
tags on a page into a **multi-select**, then runs **one combined search** for
everything you selected.

Started as IMDb-only; now ships a config-driven **site catalog**
([src/adapters/siteCatalog.js](src/adapters/siteCatalog.js)) with ~100
candidate sites across 21 categories. Sites are activated **only after their
AND semantics are verified live** — see "Supported sites" below.

**Privacy:** no data collection, no analytics, no telemetry, no backend, no
external APIs, no storage of any kind (`chrome.storage`, `localStorage`,
IndexedDB and cookies are not used). Selection state lives only in page memory
and disappears on reload/exit. The only network activity the extension causes
is opening the results tab you asked for. The toolbar icon lights up on
supported sites through `declarativeContent`, which Chrome evaluates
internally — that mechanism hands the extension no URLs at all. Once you
activate it, the content script does read the current page (and its URL)
locally to pick an adapter; none of it is stored or sent anywhere.

### The toolbar icon tells you where it works

| Icon | Meaning |
| --- | --- |
| Muted slate mark | This site isn't one of the verified ones (the popup lists the ones that are) |
| Vivid violet mark | This site is supported — click to start selecting |
| Violet badge with a number | How many tags you have selected right now |

### The popup is the full picture

Clicking the icon opens a small panel **and** turns multi-select on. The panel
lists every tag you have picked — including tags taken from *different items on
the same page* (e.g. tags from three different Stack Overflow questions) — with
a ✕ to drop any one of them, a **Clear all**, and the **Find matches** CTA.
The in-page bar next to the tags does the same job for a single item; the popup
is the one place that always shows the whole basket.

---

## How to install and test it (step by step)

**STEP 1 — Where the project is**

The extension folder is:

```
/Users/oren/Documents/Multi-label selection/multi-select-search
```

**STEP 2 — Open the extensions page**

In Chrome, go to:

```
chrome://extensions
```

**STEP 3 — Enable Developer mode**

Toggle **Developer mode** ON (top-right corner of the page).

**STEP 4 — Click "Load unpacked"**

A folder picker opens.

**STEP 5 — Select the project directory**

Select the `multi-select-search` folder itself (the one containing
`manifest.json`), not its parent.

**STEP 6 — Pin the extension**

Click the puzzle-piece icon in the Chrome toolbar, find
**Multi-Select Tag Search (MVP)** and click the pin so its icon is always
visible.

**STEP 7 — Open an IMDb movie page**

Start with The Shawshank Redemption:

```
https://www.imdb.com/title/tt0111161/
```

Notice the toolbar icon turns **vivid violet** — that's the signal this site is
supported.

**STEP 8 — Click the extension icon**

The popup opens and multi-select turns on at the same time.

**STEP 9 — Confirm multi-select mode is on**

You should see, within about a second:

- A small empty checkbox appears inside each interest chip
  (Epic, Period Drama, Prison Drama, Psychological Drama, Drama).
- A compact dark action bar appears directly **below the chip row**:
  `Select multiple   0 selected   [Clear]   [Find matches]   ✕`
- In the popup: the site name, `0 selected`, and a greyed-out **Find matches**
  (it needs 2+ selections).
- Hovering a chip shows a "copy" cursor instead of the normal link cursor.
- Clicking a chip now toggles it instead of navigating away.

**STEP 10 — Select two interests**

Click somewhere on the page to dismiss the popup, then click **Period Drama**
and **Prison Drama**. Each turns gold with a ✓, the in-page bar shows
`2 selected`, and the toolbar icon shows a **2** badge.

**STEP 11 — Click "Find matches"**

Either in the in-page bar, or reopen the popup — it now lists both tags with
the CTA reading **Find matches (2)**.

**STEP 12 — What you should expect**

A **new tab** opens (the movie page stays open behind it) at:

```
https://www.imdb.com/search/title/?interests=in0000083,in0000085
```

This is IMDb Advanced Title Search filtered to titles tagged with **both**
Period Drama **and** Prison Drama — a true intersection, about 31 titles at
the time of writing, with The Shawshank Redemption, Schindler's List and The
Green Mile at the top. Adding Psychological Drama as a third selection narrows
it to ~13 titles.

**STEP 13 — Try a cross-item selection**

Open `https://stackoverflow.com/questions` (a list page). Activate, then tick
tags belonging to *different questions*. The popup shows them all together and
one click searches for questions carrying every one of them.

To exit: click the **✕** in the in-page bar, or **Turn off multi-select** in
the popup. The page returns to normal (tags navigate again, all extension UI
removed).

---

## Testing after code changes

1. Edit the code.
2. Go to `chrome://extensions` and click the circular **reload** arrow on the
   extension's card.
3. **Refresh the IMDb tab** (the old injected script dies with the reload).
4. Click the toolbar icon to activate again.

The whole loop takes a few seconds. No build step — the files are loaded as-is.

To run the unit tests:

```
cd "/Users/oren/Documents/Multi-label selection/multi-select-search"
node tests/run.js                  # all suites (49 assertions)
```

Individually: `queryBuilder` (IMDb query logic), `siteCatalog` (adapter engine
+ catalog), `popupModel` (popup states), `manifest` (packaging, permission and
no-storage guards).

To exercise the whole selection lifecycle in a browser without loading the
extension, serve the folder and open the harness — it loads the real source
files against a fake tag page:

```
python3 -m http.server 8765 --directory "multi-select-search"
# then open http://localhost:8765/tests/manual/pageHarness.html
# and drive it from the console: await MSQ.command('activate')
```

If you change the icons or the supported-site list, regenerate them:

```
node tools/generateIcons.js           # icons/*.png
node tools/generateSupportedSites.js  # SUPPORTED_SITES.md + landing snippet
```

---

## Publishing to the Chrome Web Store

Everything needed is in [store/](store/):

| File | What it is |
| --- | --- |
| [store/SUBMISSION.md](store/SUBMISSION.md) | Step-by-step submission walkthrough, including the four steps only the account holder can do |
| [store/LISTING.md](store/LISTING.md) | Every listing field, pre-written to the store's character limits |
| [store/PRIVACY.md](store/PRIVACY.md) / [store/privacy-policy.html](store/privacy-policy.html) | Privacy policy — the store requires a public URL for it |
| [store/screenshots/studio.html](store/screenshots/studio.html) | Renders 1280×800 listing screenshots using the extension's real UI |

Build the upload file with `node tools/package.js`. It runs the tests first,
refuses to build if debug logging was left on, and verifies the resulting zip
contains the runtime files and none of the dev ones.

## Feedback and requesting new sites

The popup has **Send feedback** and **Suggest a site**; on an unsupported site
it also offers *"Ask for this site to be added"*, pre-filled with that site's
name. Both open a draft in the user's own mail client — the extension itself
transmits nothing. The destination is one constant, `FEEDBACK_EMAIL` at the
top of [src/popup/popup.js](src/popup/popup.js).

The list of supported sites deliberately **isn't** in the extension UI — it
belongs on the store listing, which is the one copy that can't fall out of
date in an already-installed build.

## Supported sites

The user-facing list (with the evidence behind each site, and a ready-to-paste
HTML block for the landing page) is generated into
[SUPPORTED_SITES.md](SUPPORTED_SITES.md) and
[landing-supported-sites.html](landing-supported-sites.html).

The catalog (`src/adapters/siteCatalog.js`) holds ~100 sites in three states:

- **verified** (active out of the box, 23 sites) — the combined search was
  proven to be a true AND intersection by comparing live result counts, and
  the tag-chip DOM pattern was confirmed. Currently: **IMDb, Letterboxd,
  MyAnimeList, AniList, Steam, itch.io, Stack Overflow, Super User, Server
  Fault, Ask Ubuntu, Mathematics SE, GitHub, npm, Royal Road, Archive of Our
  Own, Discogs, MusicBrainz, Flickr, pixiv, Gelbooru, arXiv, PubMed,
  Safebooru.** Run `SUPPORTED_SITES.md` for the evidence behind each.
- **draft** (off by default, 16 sites) — the mechanism is drafted from strong
  evidence but blocked from live verification (usually Cloudflare/anti-bot,
  e.g. PyPI, RateYourMusic, Nexus Mods, LibraryThing, Scribble Hub, Zerochan)
  or needs a real-browser check curl can't do (TMDB, Trakt — their server HTML
  is a JS shell, which proves nothing either way). Enable all drafts for
  testing with `MSQ.ENABLE_DRAFT_SITES = true` in `src/core/debug.js`.
- **research** — the site has clickable tags but **no known true-AND search
  URL**, confirmed by measurement rather than assumed. E.g. JustWatch's
  `genres=a,b` is OR (combined ≈ sum); GitLab silently drops a second `topic`
  param; Twitch drops the `/tags/x` path segment entirely; GOG's API is OR;
  Open Library's repeated `subject=` is NOT AND; Amazon's `rh=` facets are a
  real AND but the facet codes are opaque and per-category (and the site
  already has native checkbox filtering, so the product's pitch doesn't
  apply); Ravelry's search now redirects anonymous users to a login wall.
  Shipping any of these would fake the intersection, so they stay
  documented-only.

### Promoting a draft site to verified

1. Pick two tags with very different sizes on the target site.
2. Get result counts for tag A alone, tag B alone, and the combined URL the
   config builds (the extension logs it — see Debug).
3. If `combined < min(A, B)` and spot-checked results carry both tags, it's
   AND: change `status: 'draft'` to `'verified'`, paste the counts into
   `evidence`, reload, test the full flow on an item page.
4. If combined ≥ max(A, B) it's OR — demote to `'research'` with a note.

---

## What we learned about IMDb search (documented findings)

Verified live on 2026-08-19:

1. **All title-header chips are "Interests"** — including plain genres.
   Every chip links to `/interest/inNNNNNNN/` (e.g. Prison Drama =
   `in0000085`, Drama = `in0000076`). IMDb no longer links header chips to
   `?genres=` searches.
2. **Advanced Title Search accepts `?interests=id1,id2,...`** and combines
   them with **AND** (true intersection). Measured by result counts:
   - Period Drama alone: 5,162 titles
   - Prison Drama alone: 309 titles
   - Period + Prison: **31** (less than either alone → AND, not OR)
   - Drama + Prison Drama: 271 (subset of Prison Drama's 309)
   - Period + Prison + Psychological: **13**
3. `?genres=a,b` and `?keywords=a,b` on the same endpoint are also ANDed and
   can be combined with `interests=` in one URL. The query builder therefore
   buckets each selected item as interest / genre / keyword and emits e.g.
   `?interests=in0000085&genres=drama&keywords=wrongful-conviction`.
4. Because interests are IMDb's own first-class taxonomy, **no lossy
   text-to-keyword mapping is needed** for chips — we pass IMDb's own IDs
   back to IMDb's own filter. Genre/keyword handling exists only as a
   fallback for older or unusual link shapes.

**Known limitation (honest caveat):** the intersection is exact with respect
to IMDb's own tagging. If IMDb hasn't tagged a title with an interest, it
won't appear even if it "should". That's an IMDb data property, not a query
artifact.

---

## Architecture (short)

```
multi-select-search/
├── manifest.json                     MV3, permissions: activeTab + scripting only
├── src/
│   ├── background/serviceWorker.js   toolbar click → inject content bundle
│   ├── content/main.js               controller: mode state, selection, cleanup
│   ├── core/
│   │   ├── debug.js                  MSQ namespace + DEBUG logging
│   │   └── registry.js               adapter registry (platform-agnostic)
│   ├── ui/
│   │   ├── styles.js                 all CSS (msq- prefixed), one <style> tag
│   │   └── actionBar.js              action bar + toast (platform-agnostic)
│   └── adapters/
│       └── imdb/
│           ├── imdbSelectors.js      DOM discovery (3 fallback strategies)
│           ├── imdbQueryBuilder.js   pure query compilation (unit-testable)
│           └── imdbAdapter.js        PlatformAdapter implementation
└── tests/
    └── queryBuilder.test.js          node tests/queryBuilder.test.js
```

- **Activation:** toolbar click → `chrome.scripting.executeScript` injects the
  files above (idempotent — each file guards its definitions) and `main.js`
  ends with `MSQ.controller.toggle()`, so the icon is an on/off switch.
- **Adding a platform later:** create `src/adapters/<platform>/`, implement
  `{id, matches, findSelectableItems, extractItem, buildSearchUrl, getBarAnchor}`,
  call `MSQ.registerAdapter(...)`, and add the files to `CONTENT_FILES` in the
  service worker. Core/UI stay untouched.
- **DOM robustness:** chip discovery never relies on generated class names.
  Strategy 1: `[data-testid="interests"]` container; strategy 2: the
  `ref_=tt_ov_in` referrer marker IMDb puts on header-chip hrefs; strategy 3:
  heuristic chip-like `/interest/in…` links near the top of the page.
- **Dynamic pages:** a narrow, debounced MutationObserver (chip row's parent
  only) re-applies enhancement if IMDb re-renders the chips (selection is
  preserved by interest ID) and exits cleanly if the URL changes (SPA nav).
- **Cleanup:** exit removes all injected nodes, classes, attributes and
  listeners, disconnects the observer and clears in-memory state. Verified to
  leave zero `msq-` traces in the DOM.

---

## Manual QA checklist

| # | Case | Expected |
|---|------|----------|
| 1 | Activate on Shawshank (`tt0111161`) | checkboxes + action bar appear, console logs "5 interests detected" |
| 2 | Deactivate via toolbar icon | page fully restored, chips navigate normally |
| 3 | Deactivate via ✕ | same as above |
| 4 | Select / deselect chips | gold highlight + ✓ toggles, count updates |
| 5 | 0 or 1 selected | Find matches disabled (tooltip explains) |
| 6 | Clear | all deselected, count 0, CTA disabled |
| 7 | 2-item search (Period + Prison) | new tab, `?interests=in0000083,in0000085`, ~31 titles |
| 8 | 3-item search (+ Psychological) | new tab, ~13 titles |
| 9 | Genre + subgenre (Drama + Prison) | new tab, `?interests=in0000076,in0000085`, ~271 titles |
| 10 | Source tab preserved | movie page still open & in multi-select mode behind the results tab |
| 11 | Page reload while active | mode gone (nothing persisted) — expected |
| 12 | Repeated activate/deactivate ×5 | no duplicated bars/checkboxes, no console errors |
| 13 | Another title: The Green Mile (`tt0120689`) | same behavior (Period Drama, Prison Drama, Psychological Drama, Tragedy, Crime, Drama, Fantasy…) |
| 14 | Unsupported site (e.g. google.com) | toast: "Multi-select is not available on this page yet." |
| 15 | Restricted page (chrome://extensions) | small "n/a" badge on the toolbar icon, nothing else |
| 16 | Keyboard: Tab to a chip, Space/Enter | toggles selection, visible focus ring |

---

## Troubleshooting

**The extension doesn't appear in the toolbar**
It's loaded but not pinned — click the puzzle-piece icon and pin it. If it's
not listed in `chrome://extensions`, Load unpacked again and make sure you
selected the folder containing `manifest.json`.

**Nothing happens after clicking the icon**
- Refresh the IMDb page first (required after every extension reload) and
  click the icon again.
- Check the page console (see below) for `[MultiSelect]` lines.
- Make sure you're on a *title* page (`imdb.com/title/tt...`) — the IMDb home
  page, person pages, and list pages are not supported in V1 and show the
  "not available" toast.

**Tags aren't detected ("No selectable tags were found")**
The page may still be loading (the extension retries for ~3 s — try again),
or this title genuinely has no interest chips, or IMDb changed its markup
(next item).

**IMDb changed its HTML**
Open [src/adapters/imdb/imdbSelectors.js](src/adapters/imdb/imdbSelectors.js)
— all DOM discovery is in that one file. Check which of the three strategies
stopped matching: inspect a chip in DevTools and update the container testid /
href patterns. Nothing else needs to change.

**The generated search URL seems wrong**
Activate the mode with the console open — the extension logs the mapping
decisions and the final URL:

```
[MultiSelect] Query strategy:
  interests = in0000083,in0000085
[MultiSelect] Search URL: https://www.imdb.com/search/title/?interests=...
```

Compare the interest IDs with the chip hrefs on the page. The pure mapping
logic is in [src/adapters/imdb/imdbQueryBuilder.js](src/adapters/imdb/imdbQueryBuilder.js)
and covered by `node tests/queryBuilder.test.js`.

**Console errors**
Two consoles matter:
- **Page console** (content script logs): on the IMDb tab press
  `Cmd+Option+J` (mac) / `F12` (win), or right-click → Inspect → Console.
  All extension logs are prefixed `[MultiSelect]`.
- **Service worker console**: `chrome://extensions` → the extension's card →
  click the **"service worker"** link.

**Turning off debug logging**
Set `MSQ.DEBUG = false` at the top of [src/core/debug.js](src/core/debug.js).
