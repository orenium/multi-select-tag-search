// Shared namespace + debug logging.
// All content files attach to window.MSQ and must survive re-execution
// (the toolbar click re-injects every file), hence the guarded assignments.

window.MSQ = window.MSQ || {};

// Off in shipped builds so the extension stays silent in users' consoles.
// Flip to true while developing to get the full trace (detected platform,
// chips found, selection, mapping decisions, final search URL). Console
// only — nothing ever leaves the browser.
MSQ.DEBUG = (MSQ.DEBUG === undefined) ? false : MSQ.DEBUG;

MSQ.log = MSQ.log || function (...args) {
  if (MSQ.DEBUG) console.log('[MultiSelect]', ...args);
};

MSQ.warn = MSQ.warn || function (...args) {
  if (MSQ.DEBUG) console.warn('[MultiSelect]', ...args);
};

// Dev flag: also register catalog sites whose mechanism is drafted but not
// yet live-verified (status 'draft' in src/adapters/siteCatalog.js). Keep
// false for honest behavior — a draft site's "combined" search might not
// be a true intersection until someone verifies it.
MSQ.ENABLE_DRAFT_SITES = (MSQ.ENABLE_DRAFT_SITES === undefined) ? false : MSQ.ENABLE_DRAFT_SITES;
