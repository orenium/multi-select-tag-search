# Submitting to the Chrome Web Store — step by step

Decisions already made and built in:

- Adult-category entries are **stripped from the uploaded package** by
  `tools/package.js` (they were disabled drafts, so nothing is lost). They stay
  in the repo for later.
- The privacy policy will be hosted on **GitHub Pages**, generated into
  `docs/`.

## What only you can do

| Step | Why |
| --- | --- |
| Signing in to Google | Credentials are yours; the account requires 2FA anyway |
| Paying the one-time **$5** developer fee | A payment on your card |
| Accepting the Developer Agreement | A legal agreement you must accept yourself |
| Pressing **Publish** | Publishing publicly is your call |

Everything else below is prepared; you're running commands and pasting text.

---

## STEP 1 — Put the site on GitHub Pages (gets you the privacy URL)

The pages are already generated in `docs/` at the repo root:
`index.html` (landing page with the 16 sites) and `privacy.html`.

From the project root:

```bash
cd "/Users/oren/Documents/Multi-label selection"
git init
git add .
git commit -m "Multi-Select Tag Search v1.0.0"
```

Create an **empty public repo** on GitHub (e.g. `multi-select-tag-search`),
then:

```bash
git remote add origin https://github.com/<your-user>/multi-select-tag-search.git
git branch -M main
git push -u origin main
```

In the repo: **Settings → Pages → Source: Deploy from a branch →
Branch: `main`, folder: `/docs`** → Save.
(Branch deploys only offer `/` or `/docs` at the repo root, which is why the
site is generated there rather than inside the extension folder.)

Wait ~1 minute, then confirm both URLs load:

```
https://<your-user>.github.io/multi-select-tag-search/
https://<your-user>.github.io/multi-select-tag-search/privacy.html
```

**Copy the privacy.html URL — you need it in step 5.**

> Prefer not to make the code public? Put just the two files from `docs/` in a
> separate public repo. The store only needs the privacy URL to be reachable.

## STEP 2 — Test the real extension one more time

The service worker (icon colour + badge) can only be verified in Chrome:

1. `chrome://extensions` → remove any older copy of this extension.
2. **Load unpacked** → select `multi-select-search`.
3. Open `https://www.imdb.com/title/tt0111161/` → **the icon should turn
   violet**.
4. Click it → checkboxes appear → tick two interests → **the icon should show
   a "2" badge** → click **Find matches** → results open in a new tab.
5. Open `https://stackoverflow.com/questions` → tick tags on different
   questions → the popup should list them all together.
6. Open any unsupported site → popup should offer *"Ask for this site to be
   added"*.

If the icon never turns violet, reload the extension **fully** (remove + Load
unpacked): the icon rules register on install.

## STEP 3 — Build the upload file

```bash
cd "/Users/oren/Documents/Multi-label selection/multi-select-search"
node tools/package.js
```

It runs the tests, refuses to build if debug logging was left on, strips the
adult section, verifies the result still has all 16 supported sites, and
checks no dev files slipped in. Output:

```
dist/multi-select-tag-search-v1.0.0.zip
```

## STEP 4 — Register as a developer

1. <https://chrome.google.com/webstore/devconsole>
2. Sign in → accept the agreement → pay the $5 one-time fee.
3. Fill in publisher details. **The publisher email must be verified** or the
   item can't go live. Use details consistent with the privacy policy contact
   (`oren.broshi@gmail.com`).

## STEP 5 — Create the item and fill the listing

1. **Add new item** → upload the zip from step 3.
2. Open `store/LISTING.md` and paste each block into the matching field:
   name, short description, detailed description, category **Productivity**.
3. **Privacy practices tab**:
   - Single purpose → the paragraph in LISTING.md
   - One justification per permission → the four blocks in LISTING.md
   - "Are you using remote code?" → **No**
   - Data collection → **tick nothing**, then certify all three statements
   - Privacy policy URL → the GitHub Pages URL from step 1

## STEP 6 — Screenshots

At least one 1280×800 PNG is required.

```bash
python3 -m http.server 8765 --directory "multi-select-search"
# open http://localhost:8765/store/screenshots/studio.html
```

Capture each `.scene` (DevTools → Cmd+Shift+P → "Capture node screenshot" for a
pixel-exact crop). Or take real screenshots of the extension running on IMDb
and Stack Overflow — those are more convincing if you have them.

## STEP 7 — Submit

**Submit for review.** Typically a few days. Rejections almost always cite a
permission justification; yours are pre-written and accurate, which is the
usual sticking point.

---

## After it goes live

- Put the store URL into `docs/index.html` (repo root) (the "Store link goes here" line),
  regenerate with `node tools/generateSupportedSites.js`, push.
- **Feedback** and **site requests** arrive at `FEEDBACK_EMAIL`
  (`src/popup/popup.js`). Verify any requested site with the counts method in
  the README before marking it `verified` — that promise is the product's
  whole credibility.
- **Updating**: bump `version` in `manifest.json`, rerun `node tools/package.js`,
  upload to the same item. The version must increase.
