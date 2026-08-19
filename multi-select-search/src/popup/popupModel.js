// Pure view-model for the toolbar popup: page state → what to render.
// Kept free of DOM and chrome.* so it can be unit tested in Node
// (tests/popupModel.test.js).
//
// Input `state` is whatever MSQ.command('state') returned in the page, or
// null when the content script could not run there at all.

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.MSQ = root.MSQ || {};
    root.MSQ.buildPopupModel = api.buildPopupModel;
  }
})(typeof window !== 'undefined' ? window : null, function () {

  const MIN_SELECTION = 2;

  function buildPopupModel(state) {
    // Restricted pages (chrome://, Web Store, PDF viewer) — injection threw.
    if (!state) {
      return {
        mode: 'blocked',
        heading: 'Not available here',
        message: 'Chrome blocks extensions on this page. Open a supported site and try again.',
        items: [], count: 0, canSearch: false,
        ctaLabel: 'Find matches', ctaHint: '',
        showExit: false, showClear: false, showCta: false,
        host: null, showRequestSite: false
      };
    }

    if (!state.supported) {
      return {
        mode: 'unsupported',
        heading: 'Multi-select is not available on this page yet',
        message: 'No verified tag search for ' + (state.host || 'this site') + '.',
        items: [], count: 0, canSearch: false,
        ctaLabel: 'Find matches', ctaHint: '',
        showExit: false, showClear: false, showCta: false,
        // The one place asking for a new site is genuinely useful: the user
        // is standing on the site they want supported.
        host: state.host || null, showRequestSite: !!state.host
      };
    }

    const items = Array.isArray(state.items) ? state.items : [];
    const count = items.length;
    const canSearch = state.active && count >= MIN_SELECTION && !!state.searchUrl;

    if (!state.active) {
      return {
        mode: 'inactive',
        heading: state.siteLabel || 'Supported site',
        message: 'Multi-select is off. Turn it on to select several tags at once.',
        items: [], count: 0, canSearch: false,
        ctaLabel: 'Find matches', ctaHint: '',
        showExit: false, showClear: false, showCta: false,
        host: state.host || null, showRequestSite: false
      };
    }

    let ctaHint = '';
    if (count === 0) {
      ctaHint = 'Click tags on the page — you can mix tags from different items.';
    } else if (count === 1) {
      ctaHint = 'Select one more tag to combine (one tag is just a normal click).';
    } else if (!state.searchUrl) {
      ctaHint = 'These tags cannot be combined into one search.';
    }

    return {
      mode: 'active',
      heading: state.siteLabel || 'Multi-select on',
      message: '',
      items,
      count,
      canSearch,
      searchUrl: canSearch ? state.searchUrl : null,
      ctaLabel: count >= MIN_SELECTION ? 'Find matches (' + count + ')' : 'Find matches',
      ctaHint,
      showCta: true,
      showExit: true,
      showClear: count > 0,
      host: state.host || null,
      showRequestSite: false
    };
  }

  return { buildPopupModel, MIN_SELECTION };
});
