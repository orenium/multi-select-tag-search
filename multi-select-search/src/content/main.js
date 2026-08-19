// Content-side controller: owns mode state, chip enhancement, selection,
// and cleanup. Platform knowledge comes exclusively from the adapter picked
// out of the registry — nothing IMDb-specific lives here.
//
// This file is re-executed on every toolbar click (see serviceWorker.js);
// the controller singleton is created once and toggle() runs each time.

window.MSQ = window.MSQ || {};

MSQ.controller = MSQ.controller || (function () {
  // All state is in-memory only. Nothing is ever persisted.
  const state = {
    active: false,
    activating: false,
    adapter: null,
    activationHref: null,
    records: [],            // [{el, item, checkboxEl, originals, onClick, onKeydown}]
    selected: new Map(),    // item.id -> item (insertion order = selection order)
    bar: null,
    styleEl: null,
    observer: null,
    observerTimer: null
  };

  // ── styles ──────────────────────────────────────────────────────────

  function ensureStyles() {
    if (document.getElementById(MSQ.STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = MSQ.STYLE_ID;
    style.textContent = MSQ.CSS;
    document.head.appendChild(style);
    state.styleEl = style;
  }

  // ── chip enhancement ───────────────────────────────────────────────

  function enhanceChip(el, item) {
    const originals = {
      role: el.getAttribute('role'),
      ariaChecked: el.getAttribute('aria-checked')
    };

    el.classList.add('msq-selectable');
    el.setAttribute('role', 'checkbox');
    el.setAttribute('aria-checked', 'false');

    const checkboxEl = document.createElement('span');
    checkboxEl.className = 'msq-checkbox';
    checkboxEl.setAttribute('aria-hidden', 'true');
    el.prepend(checkboxEl);

    const record = { el, item, checkboxEl, originals, onClick: null, onKeydown: null };

    // Capture phase + stopPropagation so IMDb's own navigation handlers
    // never see the click while the mode is on.
    record.onClick = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      toggleSelect(record);
    };
    // Enter fires a click on anchors natively; Space needs explicit handling.
    record.onKeydown = (ev) => {
      if (ev.key === ' ' || ev.key === 'Spacebar') {
        ev.preventDefault();
        ev.stopPropagation();
        toggleSelect(record);
      }
    };
    el.addEventListener('click', record.onClick, true);
    el.addEventListener('keydown', record.onKeydown, true);

    state.records.push(record);
    return record;
  }

  function restoreChip(record) {
    const { el, originals } = record;
    el.removeEventListener('click', record.onClick, true);
    el.removeEventListener('keydown', record.onKeydown, true);
    el.classList.remove('msq-selectable', 'msq-selected');
    if (originals.role === null) el.removeAttribute('role');
    else el.setAttribute('role', originals.role);
    if (originals.ariaChecked === null) el.removeAttribute('aria-checked');
    else el.setAttribute('aria-checked', originals.ariaChecked);
    record.checkboxEl.remove();
  }

  function applySelectionVisual(record, isSelected) {
    record.el.classList.toggle('msq-selected', isSelected);
    record.el.setAttribute('aria-checked', String(isSelected));
    record.checkboxEl.textContent = isSelected ? '✓' : '';
  }

  function toggleSelect(record) {
    const { item } = record;
    if (state.selected.has(item.id)) {
      state.selected.delete(item.id);
      applySelectionVisual(record, false);
    } else {
      state.selected.set(item.id, item);
      applySelectionVisual(record, true);
    }
    if (state.bar) state.bar.setCount(state.selected.size);
    notifyCount();
    MSQ.log('Selected:', [...state.selected.values()].map((i) => i.label).join(', ') || '(none)');
  }

  // Mirror the count onto the toolbar badge so it stays visible while the
  // popup is closed. Best-effort: silently ignored if the worker is gone or
  // this bundle was injected outside the extension (e.g. a console test).
  function notifyCount() {
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) return;
      const p = chrome.runtime.sendMessage({ type: 'msq-count', count: state.selected.size });
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (_) { /* no receiver — badge just won't update */ }
  }

  function clearSelection() {
    state.selected.clear();
    state.records.forEach((r) => applySelectionVisual(r, false));
    if (state.bar) state.bar.setCount(0);
    notifyCount();
    MSQ.log('Selection cleared');
  }

  // Remove one item by its id (used by the popup's per-row × button).
  function deselectById(id) {
    const record = state.records.find((r) => r.item.id === id);
    if (record) {
      toggleSelect(record);
      return true;
    }
    // The chip may have scrolled out of a re-rendered list; drop the
    // selection anyway so the popup stays in sync with reality.
    if (state.selected.delete(id)) {
      if (state.bar) state.bar.setCount(state.selected.size);
      return true;
    }
    return false;
  }

  // ── search execution ───────────────────────────────────────────────

  // Pure: current selection → combined search URL (null if not buildable).
  function getSearchUrl() {
    const items = [...state.selected.values()];
    if (items.length < 2 || !state.adapter) return null;
    try {
      return state.adapter.buildSearchUrl(items) || null;
    } catch (err) {
      MSQ.warn('buildSearchUrl threw', err);
      return null;
    }
  }

  function runSearch() {
    const items = [...state.selected.values()];
    if (items.length < 2) return; // button is disabled; belt and braces
    const url = getSearchUrl();
    if (!url) {
      MSQ.ui.toast('Could not build a combined search for this selection.');
      return;
    }
    MSQ.log('Query strategy:\n  ' + state.adapter.describeStrategy(items));
    MSQ.log('Search URL:', url);
    // New tab so the source page stays open for comparison. Change to
    // `location.assign(url)` here if same-tab navigation is preferred later.
    window.open(url, '_blank', 'noopener');
  }

  // Serializable snapshot for the toolbar popup. Selection can span several
  // items on the page (e.g. tags from different Stack Overflow questions),
  // so the popup is the one place that always shows the whole basket.
  function getState() {
    const adapter = state.adapter || MSQ.findAdapter(location.href);
    return {
      supported: !!adapter,
      active: state.active,
      siteId: adapter ? adapter.id : null,
      siteLabel: adapter ? adapter.label : null,
      host: location.hostname,
      items: [...state.selected.values()].map((i) => ({ id: i.id, label: i.label })),
      searchUrl: getSearchUrl()
    };
  }

  // ── dynamic re-render handling ─────────────────────────────────────

  // IMDb re-renders parts of the header and navigates SPA-style. A narrow
  // observer on the chip row's parent (not the whole document) lets us
  // re-enhance replaced chips or shut down cleanly on navigation.
  function startObserver(container) {
    const target = container.parentElement || document.body;
    state.observer = new MutationObserver(() => {
      clearTimeout(state.observerTimer);
      state.observerTimer = setTimeout(onDomChanged, 200);
    });
    state.observer.observe(target, { childList: true, subtree: true });
  }

  function onDomChanged() {
    if (!state.active) return;
    if (location.href !== state.activationHref) {
      MSQ.log('URL changed — exiting multi-select mode');
      cleanup();
      return;
    }
    const lost = state.records.some((r) => !r.el.isConnected);
    const barLost = state.bar && !state.bar.el.isConnected;
    if (!lost && !barLost) return;

    MSQ.log('Chips re-rendered — re-applying enhancement');
    const previousSelection = new Map(state.selected);

    // Tear down element-level work (keep bar/style/observer), then re-scan.
    state.records.filter((r) => r.el.isConnected).forEach(restoreChip);
    state.records = [];

    const els = state.adapter.findSelectableItems(document);
    els.forEach((el) => {
      const item = state.adapter.extractItem(el);
      if (!item) return;
      const record = enhanceChip(el, item);
      if (previousSelection.has(item.id)) applySelectionVisual(record, true);
    });

    // Drop selections whose chips no longer exist on the page.
    const liveIds = new Set(state.records.map((r) => r.item.id));
    [...state.selected.keys()].forEach((id) => {
      if (!liveIds.has(id)) state.selected.delete(id);
    });

    if (barLost || !state.bar.el.isConnected) {
      const anchor = state.adapter.getBarAnchor(document, els);
      if (anchor) anchor.insertAdjacentElement('afterend', state.bar.el);
      else document.body.prepend(state.bar.el);
    }
    state.bar.setCount(state.selected.size);
    notifyCount();
  }

  // ── activation / deactivation ──────────────────────────────────────

  // IMDb renders progressively; retry chip discovery briefly before giving up.
  function waitForItems(adapter, tries = 10, delayMs = 300) {
    return new Promise((resolve) => {
      const attempt = (remaining) => {
        let els = [];
        try {
          els = adapter.findSelectableItems(document) || [];
        } catch (err) {
          MSQ.warn('findSelectableItems threw', err);
        }
        if (els.length > 0 || remaining <= 0) return resolve(els);
        setTimeout(() => attempt(remaining - 1), delayMs);
      };
      attempt(tries);
    });
  }

  async function activate() {
    if (state.active || state.activating) return;
    state.activating = true;
    ensureStyles();

    try {
      const adapter = MSQ.findAdapter(location.href);
      if (!adapter) {
        MSQ.log('No adapter for', location.href);
        MSQ.ui.toast('Multi-select is not available on this page yet.');
        return;
      }
      MSQ.log(adapter.label + ' detected');

      const els = await waitForItems(adapter);
      if (els.length === 0) {
        MSQ.ui.toast('No selectable tags were found on this page.');
        return;
      }

      state.adapter = adapter;
      state.activationHref = location.href;

      let mapped = 0;
      els.forEach((el) => {
        const item = adapter.extractItem(el);
        if (!item) {
          MSQ.warn('Could not map element, skipping:', el);
          return;
        }
        enhanceChip(el, item);
        mapped++;
      });
      MSQ.log(mapped + ' interests detected:',
        state.records.map((r) => r.item.label).join(', '));

      if (mapped === 0) {
        state.records = [];
        MSQ.ui.toast('Tags were found but none could be mapped to a search.');
        return;
      }

      state.bar = MSQ.ui.createActionBar({
        onClear: clearSelection,
        onFind: runSearch,
        onExit: cleanup
      });
      const anchor = adapter.getBarAnchor(document, els);
      if (anchor) anchor.insertAdjacentElement('afterend', state.bar.el);
      else document.body.prepend(state.bar.el);
      state.bar.setCount(0);

      startObserver(anchor || document.body);
      state.active = true;
      MSQ.log('Multi-select mode ON');
      if (mapped === 1) {
        MSQ.ui.toast('Only one tag found — at least 2 are needed for a combined search.');
      }
    } finally {
      state.activating = false;
    }
  }

  // Restores the page to its original state. Must be safe to call twice.
  function cleanup() {
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }
    clearTimeout(state.observerTimer);
    state.records.forEach((r) => {
      try { restoreChip(r); } catch (err) { MSQ.warn('restore failed', err); }
    });
    state.records = [];
    state.selected.clear();
    if (state.bar) {
      state.bar.remove();
      state.bar = null;
    }
    document.querySelectorAll('.msq-toast').forEach((t) => t.remove());
    const style = document.getElementById(MSQ.STYLE_ID);
    if (style) style.remove();
    state.styleEl = null;
    state.adapter = null;
    state.activationHref = null;
    state.active = false;
    notifyCount(); // clears the badge
    MSQ.log('Multi-select mode OFF — page restored');
  }

  function toggle() {
    if (state.active) cleanup();
    else activate();
  }

  return {
    activate, cleanup, toggle, clearSelection, deselectById,
    runSearch, getSearchUrl, getState, _state: state
  };
})();

// Command bridge for the toolbar popup. The popup injects these files and
// then calls MSQ.command(name) via chrome.scripting.executeScript; every
// return value must be structured-cloneable (plain objects only).
MSQ.command = MSQ.command || function (name, arg) {
  const c = MSQ.controller;
  switch (name) {
    case 'state':
      return c.getState();
    case 'activate':
      // activate() is async (it waits for late-rendering chips).
      return Promise.resolve(c.activate()).then(() => c.getState());
    case 'exit':
      c.cleanup();
      return c.getState();
    case 'clear':
      c.clearSelection();
      return c.getState();
    case 'deselect':
      c.deselectById(arg);
      return c.getState();
    case 'searchUrl':
      return c.getSearchUrl();
    default:
      MSQ.warn('unknown command', name);
      return null;
  }
};
