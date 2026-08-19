// IMDb query compilation. Pure functions — no DOM — so this file is unit
// testable in Node (see tests/queryBuilder.test.js) and reused verbatim in
// the content script.
//
// ── What we verified against the live site (2026-08-19) ──────────────────
// IMDb has folded the title-header chips (both broad genres like "Drama"
// and subgenres like "Prison Drama") into "Interests", each with a stable
// ID: e.g. /interest/in0000085/ = Prison Drama. Advanced Title Search
// accepts   https://www.imdb.com/search/title/?interests=in0000083,in0000085
// and comma-separated interests are ANDed (true intersection), measured by
// result counts:
//   Period Drama alone            5,162 titles
//   Prison Drama alone              309 titles
//   Period + Prison                  31 titles   (< min of the two → AND)
//   Period + Prison + Psychological  13 titles
// Genres (?genres=a,b) and keywords (?keywords=a,b) on the same endpoint
// are also ANDed, and all three params can be combined in one URL.
// Interests are the most precise mechanism, so they are our primary target;
// genres/keywords remain as fallbacks for older link shapes.

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api; // Node (unit tests)
  }
  if (root) {
    root.MSQ = root.MSQ || {};
    root.MSQ.imdbQueryBuilder = api; // browser (content script)
  }
})(typeof window !== 'undefined' ? window : null, function () {
  const SEARCH_BASE = 'https://www.imdb.com/search/title/';

  // Map a chip's href (+ visible label) to a typed search attribute.
  // Returns {kind: 'interest'|'genre'|'keyword', value} or null.
  function classifyHref(href, label) {
    if (!href) return null;

    // Primary: interest pages, e.g. /interest/in0000085/?ref_=tt_ov_in_3
    const interest = href.match(/\/interest\/(in\d+)/);
    if (interest) return { kind: 'interest', value: interest[1] };

    // Fallback: legacy genre chip links, e.g. /search/title/?genres=drama
    const genre = href.match(/[?&]genres=([^&,]+)/);
    if (genre) return { kind: 'genre', value: decodeURIComponent(genre[1]) };

    // Fallback: keyword links, e.g. /search/keyword/?keywords=prison
    // or /search/title/?keywords=prison-drama
    const keyword = href.match(/[?&]keywords=([^&,]+)/);
    if (keyword) return { kind: 'keyword', value: decodeURIComponent(keyword[1]) };

    // Last resort: no recognizable filter in the URL — search the label as
    // an IMDb keyword slug. Loses precision; logged by the caller.
    if (label && label.trim()) {
      return { kind: 'keyword', value: slugifyKeyword(label) };
    }
    return null;
  }

  // IMDb keyword slugs are lowercase, hyphen-separated.
  function slugifyKeyword(label) {
    return label
      .trim()
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // items: [{kind, value, label}] → one Advanced Title Search URL whose
  // filters are ALL applied together (intersection), or null if nothing
  // usable was selected.
  function buildSearchUrl(items) {
    if (!Array.isArray(items) || items.length === 0) return null;

    const buckets = { interest: [], genre: [], keyword: [] };
    const seen = new Set();
    for (const item of items) {
      if (!item || !item.kind || !item.value) continue;
      const key = item.kind + ':' + item.value;
      if (seen.has(key)) continue; // duplicate chips collapse to one filter
      seen.add(key);
      if (buckets[item.kind]) buckets[item.kind].push(item.value);
    }

    const params = [];
    if (buckets.interest.length) params.push('interests=' + buckets.interest.join(','));
    if (buckets.genre.length) params.push('genres=' + buckets.genre.join(','));
    if (buckets.keyword.length) params.push('keywords=' + buckets.keyword.join(','));
    if (params.length === 0) return null;

    return SEARCH_BASE + '?' + params.join('&');
  }

  // Human-readable strategy description for debug logging.
  function describeStrategy(items) {
    const parts = [];
    for (const kind of ['interest', 'genre', 'keyword']) {
      const vals = (items || []).filter((i) => i && i.kind === kind).map((i) => i.value);
      if (vals.length) parts.push(kind + 's = ' + vals.join(','));
    }
    return parts.join('  AND  ') || '(nothing mappable)';
  }

  return { SEARCH_BASE, classifyHref, slugifyKeyword, buildSearchUrl, describeStrategy };
});
