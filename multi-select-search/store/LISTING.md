# Chrome Web Store listing — copy/paste fields

Everything below is written to fit the Web Store's limits. Paste each block
into the matching field in the Developer Dashboard.

---

## Extension name (45 char limit)

```
Multi-Select Tag Search
```

## Short description / summary (132 char limit — currently 118)

```
Pick several tags on a page at once, then open one search that finds only the items matching all of them together.
```

## Category

`Productivity` (secondary fit: `Search Tools`)

## Language

English (United States)

---

## Detailed description

```
Most sites let you click one tag at a time. Click "Prison Drama" on IMDb and
you get every prison drama — but you can't say "prison drama AND period drama
AND psychological drama" without fighting an advanced search form.

Multi-Select Tag Search turns the tags already on the page into checkboxes.
Tick the ones you want, click Find matches, and it opens the one search URL
that site actually understands for combining them.

HOW IT WORKS

1. Open a supported page. The toolbar icon lights up.
2. Click the icon. Every tag on the page gets a checkbox.
3. Tick two or more — they can come from different items on the same page.
4. Click Find matches. Results open in a new tab; your page stays put.

A TRUE INTERSECTION, NOT A WORD SEARCH

This is the part we refuse to fake. For every supported site we measured real
result counts to confirm the combined search returns only items carrying ALL
the selected tags. On IMDb, "Period Drama" has 5,162 titles and "Prison Drama"
has 309 — together they return 31. That's an intersection.

Sites that have clickable tags but no true combined search were deliberately
left out rather than shipped with a word-soup search that quietly returns the
wrong thing.

WHERE IT WORKS TODAY

Movies & TV: IMDb, Letterboxd
Games: Steam, itch.io
Developer Q&A: Stack Overflow, Super User, Server Fault, Ask Ubuntu,
  Mathematics Stack Exchange
Code: GitHub, npm
Writing: Archive of Our Own
Music: Discogs
Research: arXiv, PubMed
Images: Safebooru

More are being verified. If you want a site added, use "Suggest a site" in the
popup — it opens a pre-filled email draft you can edit or discard.

PRIVACY: NOTHING LEAVES YOUR BROWSER

No accounts. No analytics. No telemetry. No server of any kind.
Nothing is stored — not your selections, not your history, nothing. There is
no chrome.storage, no localStorage, no cookies.
Nothing about the pages you visit is transmitted or retained. The icon lights
up through Chrome's own declarativeContent rules, which Chrome evaluates
internally. When you activate the extension it reads the current page locally,
just long enough to find the tags and build your search.
It only runs on a page after you click its icon, and the only network request
it ever causes is opening the results tab you asked for.

OPEN ABOUT ITS LIMITS

Results are only as good as the site's own tagging: if a site never tagged a
title, it won't appear. The extension doesn't invent data — it just drives the
site's real search.

---

Multi-Select Tag Search is an independent tool. It is not affiliated with,
endorsed by, or sponsored by any of the websites named above. All product
names, logos and trademarks are the property of their respective owners, and
are used here only to describe where the extension works.
```

---

## Screenshots (1280×800 PNG, up to 5 — at least 1 required)

Ready in `store/screenshots/`, all exactly 1280×800, captured from the real
extension on the live sites (`node tools/captureScreenshots.js` regenerates
them). Upload in this order:

1. `01-imdb-select.png` — IMDb title page, three interests ticked, action bar.
2. `04-popup-overview.png` — the popup holding all three tags, with the CTA.
3. `03-stackoverflow-cross-item.png` — tags ticked across different questions,
   the cross-item case the in-page bar alone can't show.
4. `02-imdb-results.png` — the combined results, proving the intersection.

The store rejects any other pixel size, including 2× retina captures.

## Small promo tile (440×280 PNG, optional but recommended)

`store/screenshots/promo-tile.html` renders one at the exact size.

---

## Single purpose (required field)

```
Multi-Select Tag Search has one purpose: to let a user select multiple tags
already displayed on a web page and open that site's own combined search for
all of the selected tags at once.
```

## Permission justifications (required, one per permission)

**activeTab**
```
The extension only acts on the tab where the user clicked its toolbar icon.
It has no standing access to any tab. This is what lets us read the tag labels
and links on that one page in order to build the combined search URL.
```

**scripting**
```
Needed to inject the selection interface into the current tab on demand via
chrome.scripting.executeScript when the user opens the popup. The extension
declares no content scripts, so no code runs on any page until the user
explicitly invokes it.
```

**declarativeContent**
```
Used solely to change the toolbar icon's colour on the sites the extension
supports, so users can tell at a glance where it works. The matching rules are
evaluated by Chrome itself, so this permission gives the extension no access
to page URLs or content. (Page access happens only through activeTab, after
the user clicks the icon.)
```

**Host permissions**
```
None requested. activeTab covers the only access the extension needs.
```

**Remote code**
```
No. All code is contained in the uploaded package. Nothing is fetched or
evaluated at runtime.
```

## Data usage disclosures

Tick **nothing** in the data collection list, then certify all three
statements. For the record, so you can answer honestly if a reviewer asks:

- The extension reads tag text and link URLs from the active page **in memory
  only**, purely to build a search URL, and discards it when you exit or the
  page reloads. Nothing is written to disk and nothing is transmitted.
- "Suggest a site" and "Send feedback" open a pre-filled draft in the user's
  own mail client. The user chooses whether to send it. The extension itself
  transmits nothing.

## Privacy policy URL

Required. Host `store/PRIVACY.md` (or the ready-made
`store/privacy-policy.html`) on your landing page and paste that URL here.
