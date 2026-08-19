// IMDb platform adapter. Implements the PlatformAdapter contract declared
// in src/core/registry.js. All IMDb-specific knowledge lives in this folder.

window.MSQ = window.MSQ || {};

(function () {
  const qb = MSQ.imdbQueryBuilder;

  const imdbAdapter = {
    id: 'imdb',
    label: 'IMDb',

    // V1 scope: title detail pages only, e.g. https://www.imdb.com/title/tt0111161/
    matches(url) {
      try {
        const u = new URL(url);
        return /(^|\.)imdb\.com$/.test(u.hostname) && /^\/title\/tt\d+/.test(u.pathname);
      } catch (_) {
        return false;
      }
    },

    findSelectableItems(doc) {
      return MSQ.imdbSelectors.findInterestChips(doc);
    },

    // Element → item model. Null when the element can't be mapped to any
    // IMDb search attribute (caller skips it and logs).
    extractItem(el) {
      const label = (el.textContent || '').trim();
      const href = el.getAttribute('href') || '';
      const classified = qb.classifyHref(href, label);
      if (!classified) return null;
      return {
        id: classified.kind + ':' + classified.value,
        label,
        kind: classified.kind,   // 'interest' | 'genre' | 'keyword'
        value: classified.value  // e.g. 'in0000085' | 'drama' | 'prison-drama'
      };
    },

    buildSearchUrl(items) {
      return qb.buildSearchUrl(items);
    },

    describeStrategy(items) {
      return qb.describeStrategy(items);
    },

    // Where the action bar should be placed (right after the chip row).
    getBarAnchor(doc, itemElements) {
      return MSQ.imdbSelectors.findChipsContainer(doc, itemElements);
    }
  };

  MSQ.registerAdapter(imdbAdapter);
})();
