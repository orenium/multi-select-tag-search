// Builds the Chrome Web Store upload zip.
//
//   node tools/package.js
//
// Only runtime files go in (manifest, icons, src). Tests, tools, store copy
// and generated docs are excluded — reviewers see a smaller, clearer package.
// Refuses to build if the tests fail or DEBUG logging was left on.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const INCLUDE = ['manifest.json', 'icons', 'src'];

function fail(msg) {
  console.error('✗ ' + msg);
  process.exit(1);
}

// ── preflight ────────────────────────────────────────────────────────

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));

if (/mvp|test|wip/i.test(manifest.name)) fail('manifest name still looks like a dev name: ' + manifest.name);
if (manifest.description.length > 132) fail('description is ' + manifest.description.length + ' chars (store limit 132)');

const debugSrc = fs.readFileSync(path.join(root, 'src/core/debug.js'), 'utf8');
if (!/MSQ\.DEBUG === undefined\) \? false/.test(debugSrc)) {
  fail('MSQ.DEBUG defaults to true — shipped builds must be silent');
}

try {
  execFileSync(process.execPath, [path.join(root, 'tests/run.js')], { stdio: 'pipe' });
} catch (err) {
  process.stdout.write(err.stdout || '');
  fail('tests are failing — not packaging');
}

// ── stage ────────────────────────────────────────────────────────────

// Build from a staging copy so the shipped catalog can differ from the
// repo's. Sections wrapped in MSQ-STRIP-BEGIN/END markers are removed —
// currently the adult category, whose entries are disabled drafts anyway.
const outDir = path.join(root, 'dist');
const stageDir = path.join(outDir, 'build');
fs.rmSync(stageDir, { recursive: true, force: true });
fs.mkdirSync(stageDir, { recursive: true });
for (const item of INCLUDE) {
  fs.cpSync(path.join(root, item), path.join(stageDir, item), { recursive: true });
}

const STRIP_SECTIONS = ['adult'];
const catalogRel = 'src/adapters/siteCatalog.js';
const stagedCatalog = path.join(stageDir, catalogRel);
let catalogSrc = fs.readFileSync(stagedCatalog, 'utf8');

for (const section of STRIP_SECTIONS) {
  const pattern = new RegExp(
    `[^\\n]*MSQ-STRIP-BEGIN ${section}[\\s\\S]*?MSQ-STRIP-END ${section}[^\\n]*\\n`
  );
  if (!pattern.test(catalogSrc)) {
    fail(`MSQ-STRIP markers for "${section}" not found in ${catalogRel} — ` +
         'either they were removed or renamed; refusing to ship an unfiltered catalog');
  }
  catalogSrc = catalogSrc.replace(pattern, '');
}
fs.writeFileSync(stagedCatalog, catalogSrc);

// The stripped catalog must still parse and still describe the same product.
execFileSync(process.execPath, ['--check', stagedCatalog]);
const staged = require(stagedCatalog);
const repoCatalog = require(path.join(root, catalogRel));
const stagedVerified = staged.SITE_CATALOG.filter((c) => c.status === 'verified');
const repoVerified = repoCatalog.SITE_CATALOG.filter((c) => c.status === 'verified');
if (stagedVerified.length !== repoVerified.length) {
  fail(`stripping changed the supported-site count (${repoVerified.length} → ${stagedVerified.length})`);
}
if (staged.SITE_CATALOG.some((c) => c.category === 'adult')) {
  fail('adult entries survived stripping');
}
for (const banned of ['rule34', 'e621', 'pornhub', 'xvideos', 'xhamster']) {
  if (catalogSrc.includes(banned)) fail(`"${banned}" still present in the packaged catalog`);
}

// ── build ────────────────────────────────────────────────────────────

const zipName = `multi-select-tag-search-v${manifest.version}.zip`;
const zipPath = path.join(outDir, zipName);
fs.rmSync(zipPath, { force: true });

execFileSync('zip', ['-r', '-q', '-X', zipPath, ...INCLUDE, '-x', '*.DS_Store'], { cwd: stageDir });

// ── verify the archive ───────────────────────────────────────────────

const listing = execFileSync('zip', ['-sf', zipPath], { encoding: 'utf8' });
const entries = listing.split('\n').map((l) => l.trim()).filter((l) => l && !l.endsWith('/') && !l.startsWith('Archive'));

const mustContain = [
  'manifest.json',
  'src/popup/popup.html',
  'src/background/serviceWorker.js',
  'src/content/main.js',
  'icons/icon-128.png',
  'icons/icon-active-16.png'
];
for (const f of mustContain) {
  if (!entries.includes(f)) fail('zip is missing ' + f);
}
for (const f of entries) {
  if (/^(tests|tools|store|dist)\//.test(f)) fail('zip contains dev file ' + f);
  if (f.includes('.DS_Store')) fail('zip contains .DS_Store');
}

const kb = (fs.statSync(zipPath).size / 1024).toFixed(1);
console.log(`✓ ${path.relative(root, zipPath)} — ${entries.length} files, ${kb} KB`);
console.log(`  ${stagedVerified.length} supported sites; ${STRIP_SECTIONS.join(', ')} section(s) stripped`);
console.log('  Upload this file at https://chrome.google.com/webstore/devconsole');
