// IMDb DOM discovery. Kept separate from the adapter so selector churn
// (IMDb redesigns often) stays in one small file.
//
// Deliberately avoids generated CSS class names (sc-xxxx…). Signals used,
// in order of preference:
//   1. data-testid="interests" container in the title header (stable,
//      semantic, present in server-rendered HTML on title pages)
//   2. href ref-marker `tt_ov_in` — IMDb tags overview-interest chips with
//      this referrer param, independent of any styling
//   3. any /interest/inNNNNNNN/ anchor above the fold that looks like a
//      chip (short visible text, not a card/nav link)

window.MSQ = window.MSQ || {};

MSQ.imdbSelectors = MSQ.imdbSelectors || {
  // Returns the interest-chip anchors from the title header, deduped by
  // interest ID. Empty array if none found (page may still be rendering).
  findInterestChips(doc) {
    // Strategy 1: the semantic interests container.
    let anchors = Array.from(
      doc.querySelectorAll('[data-testid="interests"] a[href*="/interest/in"]')
    );
    let strategy = 'data-testid="interests" container';

    // Strategy 2: ref marker on the href (survives testid renames).
    if (anchors.length === 0) {
      anchors = Array.from(
        doc.querySelectorAll('a[href*="/interest/in"][href*="ref_=tt_ov_in"]')
      );
      strategy = 'href ref marker tt_ov_in';
    }

    // Strategy 3: heuristic — chip-like interest links near the page top.
    if (anchors.length === 0) {
      anchors = Array.from(doc.querySelectorAll('a[href*="/interest/in"]')).filter((a) => {
        const text = (a.textContent || '').trim();
        if (!text || text.length > 40) return false; // chips have short labels
        const rect = a.getBoundingClientRect();
        // Title-header chips sit in the first ~1.5 screens of the document.
        const docTop = rect.top + (doc.defaultView ? doc.defaultView.scrollY : 0);
        return docTop < 1200;
      });
      strategy = 'heuristic chip-like interest links';
    }

    // Dedupe by interest ID (the related-interests rail lower on the page
    // repeats the same IDs; strategies 2-3 could pick those up).
    const seen = new Set();
    const chips = [];
    for (const a of anchors) {
      const m = (a.getAttribute('href') || '').match(/\/interest\/(in\d+)/);
      const key = m ? m[1] : a.getAttribute('href');
      if (seen.has(key)) continue;
      seen.add(key);
      chips.push(a);
    }

    if (chips.length) MSQ.log('chip discovery strategy:', strategy);
    return chips;
  },

  // The element the action bar should be inserted after: the chip list
  // container if we can find it, else the common parent of the chips.
  findChipsContainer(doc, chips) {
    const container = doc.querySelector('[data-testid="interests"]');
    if (container) return container;
    if (chips && chips.length) return chips[0].parentElement;
    return null;
  }
};
