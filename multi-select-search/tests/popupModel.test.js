// Unit tests for the popup view-model.
// Run with:  node tests/popupModel.test.js
const assert = require('node:assert');
const { buildPopupModel } = require('../src/popup/popupModel.js');

const tests = [];
function test(name, fn) { tests.push([name, fn]); }

const activeState = (over = {}) => ({
  supported: true, active: true, siteId: 'stackoverflow', siteLabel: 'Stack Overflow',
  host: 'stackoverflow.com', items: [], searchUrl: null, ...over
});

test('null state (restricted page) → blocked, nothing actionable, CTA hidden', () => {
  const m = buildPopupModel(null);
  assert.strictEqual(m.mode, 'blocked');
  assert.strictEqual(m.canSearch, false);
  assert.strictEqual(m.showExit, false);
  assert.strictEqual(m.showCta, false);
  // Nothing to request: we don't know what site the user is on.
  assert.strictEqual(m.showRequestSite, false);
});

test('unsupported page names the host and offers a site request', () => {
  const m = buildPopupModel({ supported: false, active: false, host: 'example.com', items: [] });
  assert.strictEqual(m.mode, 'unsupported');
  assert.ok(m.message.includes('example.com'));
  assert.strictEqual(m.canSearch, false);
  assert.strictEqual(m.showCta, false);
  assert.strictEqual(m.showRequestSite, true);
  assert.strictEqual(m.host, 'example.com', 'host is needed to prefill the request');
});

test('site request is suppressed when the host is unknown', () => {
  const m = buildPopupModel({ supported: false, active: false, items: [] });
  assert.strictEqual(m.showRequestSite, false);
});

test('supported but off → inactive with a turn-on message, no items shown', () => {
  const m = buildPopupModel(activeState({ active: false, items: [{ id: 'a', label: 'x' }] }));
  assert.strictEqual(m.mode, 'inactive');
  assert.deepStrictEqual(m.items, []);
  assert.strictEqual(m.showExit, false);
  assert.strictEqual(m.canSearch, false);
});

test('active with 0 selected → CTA disabled, cross-item hint', () => {
  const m = buildPopupModel(activeState());
  assert.strictEqual(m.mode, 'active');
  assert.strictEqual(m.count, 0);
  assert.strictEqual(m.canSearch, false);
  assert.strictEqual(m.showClear, false);
  assert.ok(/different items/i.test(m.ctaHint));
});

test('active with 1 selected → CTA still disabled, explains why', () => {
  const m = buildPopupModel(activeState({ items: [{ id: 'tag:python', label: 'python' }] }));
  assert.strictEqual(m.canSearch, false);
  assert.strictEqual(m.showClear, true);
  assert.ok(/one more tag/i.test(m.ctaHint));
  assert.strictEqual(m.ctaLabel, 'Find matches');
});

test('active with 2+ selected and a URL → CTA enabled and counted', () => {
  const m = buildPopupModel(activeState({
    items: [{ id: 'tag:python', label: 'python' }, { id: 'tag:pandas', label: 'pandas' }],
    searchUrl: 'https://stackoverflow.com/questions/tagged/python+pandas'
  }));
  assert.strictEqual(m.showCta, true);
  assert.strictEqual(m.canSearch, true);
  assert.strictEqual(m.ctaLabel, 'Find matches (2)');
  assert.strictEqual(m.searchUrl, 'https://stackoverflow.com/questions/tagged/python+pandas');
  assert.strictEqual(m.ctaHint, '');
});

test('2+ selected but no buildable URL → CTA disabled and says so', () => {
  const m = buildPopupModel(activeState({
    items: [{ id: 'a', label: 'a' }, { id: 'b', label: 'b' }], searchUrl: null
  }));
  assert.strictEqual(m.canSearch, false);
  assert.strictEqual(m.searchUrl, null, 'no URL is exposed when the CTA is off');
  assert.ok(/cannot be combined/i.test(m.ctaHint));
});

test('cross-item selection keeps every label in order', () => {
  const items = [
    { id: 'tag:javascript', label: 'javascript' },
    { id: 'tag:http-redirect', label: 'http-redirect' },
    { id: 'tag:ajax', label: 'ajax' }
  ];
  const m = buildPopupModel(activeState({ items, searchUrl: 'https://x/y' }));
  assert.deepStrictEqual(m.items.map((i) => i.label), ['javascript', 'http-redirect', 'ajax']);
  assert.strictEqual(m.ctaLabel, 'Find matches (3)');
});

test('malformed items array degrades to empty rather than throwing', () => {
  const m = buildPopupModel(activeState({ items: undefined }));
  assert.deepStrictEqual(m.items, []);
  assert.strictEqual(m.count, 0);
});

let failed = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log('  ✓', name); }
  catch (err) { failed++; console.error('  ✗', name); console.error('   ', err.message); }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
