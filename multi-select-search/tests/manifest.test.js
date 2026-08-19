// Packaging + hard-constraint guards. These fail loudly if someone later
// adds a permission, a storage call, or a file reference that doesn't exist.
// Run with:  node tests/manifest.test.js
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));

const tests = [];
function test(name, fn) { tests.push([name, fn]); }

const manifest = JSON.parse(read('manifest.json'));

function allSourceFiles(dir = 'src', out = []) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) allSourceFiles(rel, out);
    else if (entry.name.endsWith('.js')) out.push(rel);
  }
  return out;
}

test('manifest is MV3 and every referenced file exists', () => {
  assert.strictEqual(manifest.manifest_version, 3);
  assert.ok(exists(manifest.background.service_worker), 'missing service worker');
  assert.ok(exists(manifest.action.default_popup), 'missing popup html');
  for (const group of [manifest.icons, manifest.action.default_icon]) {
    for (const file of Object.values(group)) {
      assert.ok(exists(file), 'missing icon ' + file);
    }
  }
});

test('permissions stay minimal: no host permissions, no storage, no tabs', () => {
  assert.deepStrictEqual(
    [...manifest.permissions].sort(),
    ['activeTab', 'declarativeContent', 'scripting'],
    'permission set changed — this is a product constraint, not an implementation detail'
  );
  assert.ok(!manifest.host_permissions, 'host_permissions must stay absent');
  assert.ok(!manifest.content_scripts, 'declared content scripts would require host permissions');
});

test('the active-icon variants the worker fetches are present', () => {
  for (const size of [16, 32]) {
    assert.ok(exists(`icons/icon-active-${size}.png`), `icons/icon-active-${size}.png missing`);
  }
});

test('no persistence anywhere in src (storage, cookies, IndexedDB)', () => {
  const banned = [
    /chrome\.storage/, /localStorage/, /sessionStorage/,
    /indexedDB/i, /document\.cookie/
  ];
  for (const file of allSourceFiles()) {
    const src = read(file);
    for (const pattern of banned) {
      assert.ok(!pattern.test(src), file + ' uses ' + pattern);
    }
  }
});

test('no outbound network calls in content/adapter/UI code', () => {
  // The popup and worker legitimately fetch() bundled extension assets; page
  // code must never make requests at all.
  for (const file of allSourceFiles()) {
    if (file.startsWith(path.join('src', 'popup')) ||
        file.startsWith(path.join('src', 'background'))) continue;
    const src = read(file);
    for (const pattern of [/\bfetch\s*\(/, /XMLHttpRequest/, /navigator\.sendBeacon/]) {
      assert.ok(!pattern.test(src), file + ' makes network calls');
    }
  }
});

test('worker + popup only fetch extension-local URLs', () => {
  for (const file of ['src/background/serviceWorker.js', 'src/popup/popup.js']) {
    const src = read(file);
    const calls = src.match(/fetch\(([^)]*)\)/g) || [];
    for (const call of calls) {
      assert.ok(/chrome\.runtime\.getURL/.test(call), file + ' fetches a non-local URL: ' + call);
    }
  }
});

test('popup injects a content file list that all exists, in dependency order', () => {
  const src = read('src/popup/popup.js');
  const block = src.match(/const CONTENT_FILES = \[([\s\S]*?)\];/);
  assert.ok(block, 'CONTENT_FILES not found in popup.js');
  const files = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.ok(files.length >= 8, 'unexpectedly short content file list');
  for (const f of files) assert.ok(exists(f), 'CONTENT_FILES references missing ' + f);
  // main.js consumes everything else, so it must come last.
  assert.strictEqual(files[files.length - 1], 'src/content/main.js');
  // adapters must be registered before main.js runs
  assert.ok(files.indexOf('src/core/registry.js') < files.indexOf('src/adapters/siteCatalog.js'));
  assert.ok(files.indexOf('src/core/siteAdapterEngine.js') < files.indexOf('src/adapters/siteCatalog.js'));
});

test('service worker can read verified domains the way it does at runtime', () => {
  // Emulate the worker global: importScripts-style load attaches to `self`.
  const sandboxSelf = {};
  const prevSelf = global.self;
  global.self = sandboxSelf;
  try {
    delete require.cache[require.resolve('../src/adapters/siteCatalog.js')];
    require('../src/adapters/siteCatalog.js');
    assert.ok(sandboxSelf.MSQ, 'catalog did not attach to self');
    const domains = sandboxSelf.MSQ.verifiedDomains();
    assert.ok(domains.includes('imdb.com') && domains.length >= 10);
  } finally {
    global.self = prevSelf;
    delete require.cache[require.resolve('../src/adapters/siteCatalog.js')];
  }
});

test('store-build strip markers exist and wrap exactly the adult entries', () => {
  const src = read('src/adapters/siteCatalog.js');
  const begin = src.indexOf('MSQ-STRIP-BEGIN adult');
  const end = src.indexOf('MSQ-STRIP-END adult');
  assert.ok(begin > 0 && end > begin,
    'tools/package.js relies on these markers to keep adult sites out of store builds');

  const section = src.slice(begin, end);
  const { SITE_CATALOG } = require('../src/adapters/siteCatalog.js');
  for (const site of SITE_CATALOG.filter((c) => c.category === 'adult')) {
    assert.ok(section.includes("id: '" + site.id + "'"),
      site.id + ' is an adult entry outside the strip markers — it would ship');
  }
  // ...and nothing else hides inside them. (Ids can appear as an object
  // literal or as a helper argument, e.g. stackExchangeSite('superuser', …),
  // so match the quoted id rather than the `id:` key.)
  const outside = src.slice(0, begin) + src.slice(end);
  for (const site of SITE_CATALOG.filter((c) => c.category !== 'adult')) {
    assert.ok(outside.includes("'" + site.id + "'"),
      site.id + ' sits inside the strip markers and would be dropped from store builds');
  }
});

test('no adult entry is ever enabled', () => {
  const { SITE_CATALOG } = require('../src/adapters/siteCatalog.js');
  for (const site of SITE_CATALOG.filter((c) => c.category === 'adult')) {
    assert.notStrictEqual(site.status, 'verified',
      site.id + ' is marked verified — adult sites are excluded from shipped builds, ' +
      'so promoting one here would silently do nothing');
  }
});

test('one contact address, used consistently everywhere', () => {
  const popup = read('src/popup/popup.js');
  const match = popup.match(/const FEEDBACK_EMAIL = '([^']+)'/);
  assert.ok(match, 'FEEDBACK_EMAIL not found in popup.js');
  const email = match[1];
  assert.ok(/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(email), 'not a valid address: ' + email);

  // The generator bakes it into the published pages; the privacy policy is a
  // legal document that must name a reachable address. All must agree.
  const mustMention = [
    'tools/generateSupportedSites.js',
    'store/PRIVACY.md',
    'store/privacy-policy.html',
    '../docs/index.html',
    '../docs/privacy.html'
  ];
  for (const file of mustMention) {
    assert.ok(read(file).includes(email), file + ' does not use ' + email);
  }

  // No other address may appear anywhere — this catches a stale contact
  // being left behind far more reliably than blocklisting known-bad strings.
  const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  const scanned = [...mustMention, 'src/popup/popup.js', 'store/LISTING.md',
    'store/SUBMISSION.md', 'store/LEGAL-NOTES.md', 'README.md'];
  for (const file of scanned) {
    for (const found of read(file).match(EMAIL_RE) || []) {
      // noreply@ addresses belong to tooling, not to us.
      if (found.startsWith('noreply@')) continue;
      assert.strictEqual(found, email,
        file + ' contains a different contact address: ' + found);
    }
  }
});

test('generated supported-sites doc matches the catalog', () => {
  const { SITE_CATALOG } = require('../src/adapters/siteCatalog.js');
  const verified = SITE_CATALOG.filter((c) => c.status === 'verified');
  const doc = read('SUPPORTED_SITES.md');
  assert.ok(doc.includes(`**${verified.length} sites supported today.**`),
    'SUPPORTED_SITES.md is stale — rerun node tools/generateSupportedSites.js');
  for (const s of verified) {
    assert.ok(doc.includes('| ' + s.label + ' |'), 'doc missing ' + s.label);
  }
});

let failed = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log('  ✓', name); }
  catch (err) { failed++; console.error('  ✗', name); console.error('   ', err.message); }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
