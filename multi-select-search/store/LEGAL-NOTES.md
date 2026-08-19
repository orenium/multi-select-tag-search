# Legal and policy notes

**Not legal advice.** This is an engineer's risk map so you know which
questions are worth asking a lawyer, not a substitute for one.

## 1. Naming other companies' sites — low risk, mitigated

The listing names 16 websites. Describing what your product is compatible with
is normally permitted ("nominative fair use"): you may use a trademark to
refer to the trademark owner's product, as long as you use no more of the mark
than necessary and don't suggest sponsorship.

What keeps us on the right side of it:

- The extension's own name contains no one else's mark.
- No third-party logos anywhere — not in the icon, not in the screenshots.
  The screenshot studio uses deliberately generic page content.
- The listing ends with an explicit disclaimer of affiliation (already written
  into `LISTING.md`).

What would cross the line: putting "for IMDb" in the extension name, using
their logo or brand colours as your icon, or wording that implies partnership.

## 2. The target sites' terms of use — low risk

The extension:

- makes **no network requests** of its own, so it can't "scrape" or crawl;
- reads only the page already rendered in the user's own browser;
- navigates to a normal search URL on the same site, as the user, by their
  click;
- bypasses no paywall, no login, no rate limit, no technical protection.

Most site terms prohibit automated collection, robots and circumvention. None
of those apply here. Client-side modification of a page you are viewing is the
same category as a userstyle, a reader mode, or an ad blocker.

The realistic worst case isn't a lawsuit — it's a site asking Google to remove
the extension. Keeping the tool obviously user-driven (nothing runs until the
icon is clicked) is your best protection, and that's already how it works.

## 3. Chrome Web Store policies — one open decision

Compliant already: single purpose, minimum permissions, no remote code, no
obfuscation, accurate privacy disclosures, no data collection.

**The open item:** `src/adapters/siteCatalog.js` contains entries for two
adult sites (`rule34.xxx`, `e621.net`) as *drafts*. Drafts are never
registered, so the shipped extension does nothing on those sites — but the
domain strings are readable in the uploaded package, and reviewers do read
source. The Web Store restricts sexually explicit material and can require
mature-content labelling. See the question I asked you; removing them from the
v1 package costs zero functionality.

## 4. Privacy law — minimal exposure

The extension collects nothing, so GDPR/CCPA obligations around collected data
essentially don't arise. One small exception: when a user emails feedback, you
are processing their email address and whatever they wrote. The privacy policy
already discloses this and limits the use to replying and prioritising sites.
Keep that true and it stays a non-issue.

## 5. Warranty

You're publishing a free tool. Consider whether you want a one-line "provided
as is, without warranty" note in the listing or on your landing page. Not
required, commonly done.

## 6. Publisher identity

Whatever you register (personal name or a company) should match the contact
details in the privacy policy. Inconsistent publisher identity is a common
cause of listing rejections and looks worse than it is.
