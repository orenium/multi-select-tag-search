// Generic, config-driven site adapter factory.
//
// Most tag-heavy sites differ only in four things: which URLs are item
// pages, what a tag link's href looks like, how to pull the tag value out
// of that href, and how to compose the combined search URL. So instead of
// one bespoke folder per platform, a site is described by a small config
// object (see src/adapters/siteCatalog.js) and this factory turns it into
// a PlatformAdapter (contract in src/core/registry.js).
//
// Config shape:
//   id           string, unique
//   label        string, human name
//   category     string, catalog grouping (docs only)
//   status       'verified' | 'draft' | 'research'
//                verified  = AND semantics + DOM pattern confirmed live;
//                            registered and active.
//                draft     = mechanism drafted from known URL conventions
//                            but NOT live-verified; only registered when
//                            MSQ.ENABLE_DRAFT_SITES is true.
//                research  = no known AND mechanism; never registered,
//                            kept in the catalog as a documented candidate.
//   host         RegExp on location.hostname
//   path         RegExp on location.pathname (optional; default: any)
//   tagPattern   RegExp on the anchor href; capture group 1 = tag value
//   containerSelector  optional CSS selector limiting where chips live
//   maxLabel     optional max chip label length (default 60)
//   minChips     optional minimum chips to treat page as supported (default 1)
//   kind         label for the value type in logs (default 'tag')
//   buildUrl     (values: string[]) => string — the combined AND search URL
//   extractValue optional (el, match) => string|null — override value
//                extraction when the href alone isn't enough (e.g. Steam
//                needs numeric tag IDs found elsewhere on the page)
//   evidence     short string: how/when AND semantics were verified
//
// UMD-style so buildUrl logic is unit-testable in Node.

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.MSQ = root.MSQ || {};
    root.MSQ.createSiteAdapter = root.MSQ.createSiteAdapter || api.createSiteAdapter;
  }
})(typeof window !== 'undefined' ? window : null, function () {

  function createSiteAdapter(config) {
    // Two chip-discovery modes:
    //  - anchor mode (default): scan <a href> against config.tagPattern;
    //    value = raw capture group 1 (kept URL-encoded so it can be reused
    //    verbatim in the search URL) unless extractValue overrides.
    //  - element mode: config.chipSelector matches non-anchor chips (e.g.
    //    PubMed MeSH <button>s); config.extractValue is required.
    function matchChip(el) {
      const label = (el.textContent || '').trim();
      if (!label || label.length > (config.maxLabel || 60)) return null;
      let m = null;
      if (config.tagPattern) {
        const href = el.getAttribute('href') || '';
        m = href.match(config.tagPattern);
        if (!m) return null;
      }
      let value = null;
      try {
        value = config.extractValue ? config.extractValue(el, m) : (m && m[1]);
      } catch (_) { /* fall through to null */ }
      return value ? { value, label } : null;
    }

    return {
      id: config.id,
      label: config.label,
      _config: config,

      matches(url) {
        try {
          const u = new URL(url);
          if (!config.host.test(u.hostname)) return false;
          return config.path ? config.path.test(u.pathname) : true;
        } catch (_) {
          return false;
        }
      },

      findSelectableItems(doc) {
        let candidates;
        if (config.chipSelector) {
          candidates = Array.from(doc.querySelectorAll(config.chipSelector));
        } else {
          const scope = config.containerSelector
            ? doc.querySelector(config.containerSelector)
            : null;
          candidates = Array.from((scope || doc).querySelectorAll('a[href]'));
        }
        const seen = new Set();
        const out = [];
        for (const el of candidates) {
          const hit = matchChip(el);
          if (!hit || seen.has(hit.value)) continue;
          seen.add(hit.value);
          out.push(el);
        }
        return out.length >= (config.minChips || 1) ? out : [];
      },

      extractItem(el) {
        const hit = matchChip(el);
        if (!hit) return null;
        return {
          id: (config.kind || 'tag') + ':' + hit.value,
          label: hit.label,
          kind: config.kind || 'tag',
          value: hit.value
        };
      },

      buildSearchUrl(items) {
        const values = [];
        const seen = new Set();
        for (const item of items || []) {
          if (!item || !item.value || seen.has(item.value)) continue;
          seen.add(item.value);
          values.push(item.value);
        }
        if (values.length === 0) return null;
        try {
          return config.buildUrl(values);
        } catch (err) {
          if (typeof MSQ !== 'undefined' && MSQ.warn) MSQ.warn('buildUrl threw for', config.id, err);
          return null;
        }
      },

      describeStrategy(items) {
        const vals = (items || []).map((i) => i && i.value).filter(Boolean);
        return (config.kind || 'tag') + 's = ' + vals.join(',') + '  (' + config.id + ', AND)';
      },

      getBarAnchor(doc, itemElements) {
        if (config.containerSelector) {
          const c = doc.querySelector(config.containerSelector);
          if (c) return c;
        }
        if (itemElements && itemElements.length) {
          // The chips' closest shared block keeps the bar visually attached.
          return itemElements[0].closest('ul, section, div') || itemElements[0].parentElement;
        }
        return null;
      }
    };
  }

  return { createSiteAdapter };
});
