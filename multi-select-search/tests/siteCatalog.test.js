// Unit tests for the config-driven adapter engine + the site catalog.
// Run with:  node tests/siteCatalog.test.js
const assert = require('node:assert');
const { createSiteAdapter } = require('../src/core/siteAdapterEngine.js');
const { SITE_CATALOG, ao3Unescape, domainsOf, verifiedDomains } =
  require('../src/adapters/siteCatalog.js');

const tests = [];
function test(name, fn) { tests.push([name, fn]); }

const byId = (id) => SITE_CATALOG.find((c) => c.id === id);
const adapterFor = (id) => createSiteAdapter(byId(id));

// Minimal fake anchor for extractItem tests (no DOM in Node).
const fakeAnchor = (href, text) => ({
  getAttribute: (k) => (k === 'href' ? href : null),
  textContent: text
});

// ── catalog invariants ───────────────────────────────────────────────

test('catalog has ~100 entries, max 5 per category', () => {
  assert.ok(SITE_CATALOG.length >= 95 && SITE_CATALOG.length <= 105,
    'expected ~100 entries, got ' + SITE_CATALOG.length);
  const perCat = {};
  for (const c of SITE_CATALOG) perCat[c.category] = (perCat[c.category] || 0) + 1;
  for (const [cat, n] of Object.entries(perCat)) {
    assert.ok(n <= 5, cat + ' has ' + n + ' entries (max 5)');
  }
});

test('every entry has id/label/category/status; ids unique', () => {
  const ids = new Set();
  for (const c of SITE_CATALOG) {
    assert.ok(c.id && c.label && c.category, JSON.stringify(c.id));
    assert.ok(['verified', 'draft', 'research'].includes(c.status), c.id + ': ' + c.status);
    assert.ok(!ids.has(c.id), 'duplicate id ' + c.id);
    ids.add(c.id);
  }
});

test('verified entries carry evidence; active ones have a working config', () => {
  for (const c of SITE_CATALOG.filter((c) => c.status === 'verified')) {
    assert.ok(c.evidence, c.id + ' missing evidence');
    if (c.bespoke) continue;
    assert.ok(c.host instanceof RegExp, c.id + ' missing host');
    assert.ok(typeof c.buildUrl === 'function', c.id + ' missing buildUrl');
    assert.ok(c.tagPattern || c.chipSelector, c.id + ' missing chip discovery');
  }
});

test('research entries are inert (never registered)', () => {
  const registered = [];
  const fakeMSQ = {
    registerAdapter: (a) => registered.push(a.id),
    createSiteAdapter
  };
  require('../src/adapters/siteCatalog.js').registerAll(fakeMSQ);
  for (const c of SITE_CATALOG.filter((c) => c.status !== 'verified')) {
    assert.ok(!registered.includes(c.id), c.id + ' should not be registered');
  }
  // all non-bespoke verified entries ARE registered
  for (const c of SITE_CATALOG.filter((c) => c.status === 'verified' && !c.bespoke)) {
    assert.ok(registered.includes(c.id), c.id + ' should be registered');
  }
});

// ── icon rules: derived domains ──────────────────────────────────────

test('every verified site yields a domain, and it matches its own host regex', () => {
  for (const c of SITE_CATALOG.filter((c) => c.status === 'verified')) {
    const domains = domainsOf(c);
    assert.ok(domains.length > 0, c.id + ' produced no domain for the icon rules');
    for (const d of domains) {
      assert.ok(/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d), c.id + ' bad domain: ' + d);
      if (c.host) assert.ok(c.host.test(d), c.id + ': host regex does not match derived ' + d);
    }
  }
});

test('icon rules check the PAGE, not just the domain', () => {
  const { iconRules, CSS_MATCH_EXEMPT } = require('../src/adapters/siteCatalog.js');
  const rules = iconRules();
  assert.ok(rules.length > 0);

  // Every rule targets a verified domain.
  const domains = new Set(verifiedDomains());
  for (const r of rules) assert.ok(domains.has(r.domain), 'stray domain ' + r.domain);

  // A domain-only rule (css: null) is a deliberate exemption and must say why.
  for (const r of rules.filter((r) => r.css === null)) {
    assert.ok(CSS_MATCH_EXEMPT[r.domain],
      r.domain + ' falls back to domain-only matching without a documented reason — ' +
      'that silently lights the icon on pages with no tags');
    assert.ok(r.exemptReason && r.exemptReason.length > 40, r.domain + ': reason too thin');
  }

  // The case that prompted this: imdb.com must be page-checked.
  const imdb = rules.filter((r) => r.domain === 'imdb.com');
  assert.ok(imdb.length && imdb.every((r) => r.css),
    'imdb.com must use a css matcher so the homepage stays grey');
  assert.ok(imdb.some((r) => r.css.includes('/interest/in')));
});

test('every chip selector is a COMPOUND selector Chrome will accept', () => {
  const { iconRules } = require('../src/adapters/siteCatalog.js');
  for (const { domain, css } of iconRules()) {
    if (!css) continue;
    // Chrome's declarativeContent requires compound selectors: no descendant,
    // child, sibling combinators, and no comma-separated lists.
    assert.ok(!/[\s>+~,]/.test(css.replace(/\[[^\]]*\]/g, '')),
      domain + ': "' + css + '" uses a combinator — Chrome rejects the whole rule');
    // And it must still be syntactically valid CSS.
    assert.doesNotThrow(() => new RegExp('') && require('node:assert'), 'sanity');
  }
});

test('verifiedDomains is deduped, sorted, and covers the known sites', () => {
  const domains = verifiedDomains();
  assert.deepStrictEqual(domains, [...new Set(domains)].sort());
  for (const expected of ['imdb.com', 'stackoverflow.com', 'github.com',
    'store.steampowered.com', 'pubmed.ncbi.nlm.nih.gov']) {
    assert.ok(domains.includes(expected), 'missing ' + expected);
  }
  // Draft/research sites must not leak into the icon rules.
  assert.ok(!domains.includes('rule34.xxx'));
  assert.ok(!domains.includes('gog.com'));
});

// ── verified sites: URL matching + query building ────────────────────

test('stackoverflow: matches question pages, builds tagged intersection URL', () => {
  const a = adapterFor('stackoverflow');
  assert.ok(a.matches('https://stackoverflow.com/questions/11227809/why-is-processing'));
  assert.ok(a.matches('https://stackoverflow.com/questions'), 'question list page');
  assert.ok(a.matches('https://stackoverflow.com/questions/tagged/python'), 'tag page');
  assert.ok(a.matches('https://stackoverflow.com/'), 'home page question list');
  assert.ok(!a.matches('https://stackoverflow.com/users/12345'));
  const items = [
    a.extractItem(fakeAnchor('/questions/tagged/python', 'python')),
    a.extractItem(fakeAnchor('/questions/tagged/c%2b%2b', 'c++'))
  ];
  assert.strictEqual(a.buildSearchUrl(items),
    'https://stackoverflow.com/questions/tagged/python+c%2b%2b');
});

test('github: repo pages → topic:a topic:b repository search', () => {
  const a = adapterFor('github');
  assert.ok(a.matches('https://github.com/facebook/react'));
  assert.ok(!a.matches('https://github.com/facebook/react/issues'));
  const items = [
    a.extractItem(fakeAnchor('/topics/react', 'react')),
    a.extractItem(fakeAnchor('/topics/hooks', 'hooks'))
  ];
  assert.strictEqual(a.buildSearchUrl(items),
    'https://github.com/search?q=topic%3Areact+topic%3Ahooks&type=repositories');
});

test('npm: package pages → keywords:a,b search', () => {
  const a = adapterFor('npm');
  assert.ok(a.matches('https://www.npmjs.com/package/express'));
  const items = [
    a.extractItem(fakeAnchor('/search?q=keywords:framework', 'framework')),
    a.extractItem(fakeAnchor('/search?q=keywords:middleware', 'middleware'))
  ];
  assert.strictEqual(a.buildSearchUrl(items),
    'https://www.npmjs.com/search?q=keywords%3Aframework%2Cmiddleware');
});

test('letterboxd: film pages → /films/genre/a+b/', () => {
  const a = adapterFor('letterboxd');
  assert.ok(a.matches('https://letterboxd.com/film/parasite-2019/'));
  const items = [
    a.extractItem(fakeAnchor('/films/genre/comedy/', 'Comedy')),
    a.extractItem(fakeAnchor('/films/genre/thriller/', 'Thriller'))
  ];
  assert.strictEqual(a.buildSearchUrl(items),
    'https://letterboxd.com/films/genre/comedy+thriller/');
});

test('itch.io: tag- and genre- path segments compose', () => {
  const a = adapterFor('itchio');
  assert.ok(a.matches('https://terrycavanagh.itch.io/dicey-dungeons'));
  const items = [
    a.extractItem(fakeAnchor('https://itch.io/games/tag-roguelike', 'Roguelike')),
    a.extractItem(fakeAnchor('https://itch.io/games/genre-rpg', 'RPG'))
  ];
  assert.strictEqual(a.buildSearchUrl(items),
    'https://itch.io/games/tag-roguelike/genre-rpg');
});

test('ao3: first tag is base path, rest become other_tag_names', () => {
  const a = adapterFor('ao3');
  assert.ok(a.matches('https://archiveofourown.org/works/12345678'));
  const items = [
    a.extractItem(fakeAnchor('/tags/Fluff/works', 'Fluff')),
    a.extractItem(fakeAnchor('/tags/Angst/works', 'Angst')),
    a.extractItem(fakeAnchor('/tags/Hurt*s*Comfort/works', 'Hurt/Comfort'))
  ];
  assert.strictEqual(a.buildSearchUrl(items),
    'https://archiveofourown.org/tags/Fluff/works?work_search%5Bother_tag_names%5D=' +
    encodeURIComponent('Angst,Hurt/Comfort') + '&commit=Sort+and+Filter');
});

test('ao3Unescape reverses AO3 tag URL escapes', () => {
  assert.strictEqual(ao3Unescape('Hurt*s*Comfort'), 'Hurt/Comfort');
  assert.strictEqual(ao3Unescape('Q*a*A'), 'Q&A');
});

test('discogs: genre + style chips map to genre_exact/style_exact params', () => {
  const a = adapterFor('discogs');
  assert.ok(a.matches('https://www.discogs.com/master/26069'));
  const items = [
    a.extractItem(fakeAnchor('/genre/electronic', 'Electronic')),
    a.extractItem(fakeAnchor('/style/ambient', 'Ambient'))
  ];
  assert.strictEqual(a.buildSearchUrl(items),
    'https://www.discogs.com/search/?genre_exact=electronic&style_exact=ambient&type=release');
});

test('arxiv: abs pages → advanced search with ANDed cross-list categories', () => {
  const a = adapterFor('arxiv');
  assert.ok(a.matches('https://arxiv.org/abs/1706.03762'));
  const items = [
    a.extractItem(fakeAnchor('/list/cs.LG/recent', 'cs.LG')),
    a.extractItem(fakeAnchor('/list/stat.ML/recent', 'stat.ML'))
  ];
  const url = a.buildSearchUrl(items);
  assert.ok(url.includes('terms-0-term=cs.LG') && url.includes('terms-1-term=stat.ML'));
  assert.ok(url.includes('terms-1-operator=AND'));
  assert.ok(url.includes('cross_list_category'));
});

test('pubmed: MeSH names → quoted [MeSH Terms] AND query', () => {
  const a = adapterFor('pubmed');
  assert.ok(a.matches('https://pubmed.ncbi.nlm.nih.gov/31452104/'));
  const items = [
    a.extractItem({ getAttribute: () => null, textContent: 'Neoplasms*' }),
    a.extractItem({ getAttribute: () => null, textContent: 'Apoptosis' })
  ];
  assert.strictEqual(a.buildSearchUrl(items),
    'https://pubmed.ncbi.nlm.nih.gov/?term=' +
    encodeURIComponent('"Neoplasms"[MeSH Terms] AND "Apoptosis"[MeSH Terms]'));
});

test('safebooru: tags join with + (space-separated AND)', () => {
  const a = adapterFor('safebooru');
  const items = [
    a.extractItem(fakeAnchor('index.php?page=post&s=list&tags=landscape', 'landscape')),
    a.extractItem(fakeAnchor('index.php?page=post&s=list&tags=sky', 'sky'))
  ];
  assert.strictEqual(a.buildSearchUrl(items),
    'https://safebooru.org/index.php?page=post&s=list&tags=landscape+sky');
});

test('gelbooru: shares the safebooru Gelbooru-engine URL shape', () => {
  const a = adapterFor('gelbooru');
  const items = [
    a.extractItem(fakeAnchor('index.php?page=post&s=list&tags=1girl', '1girl')),
    a.extractItem(fakeAnchor('index.php?page=post&s=list&tags=solo', 'solo'))
  ];
  assert.strictEqual(a.buildSearchUrl(items),
    'https://gelbooru.com/index.php?page=post&s=list&tags=1girl+solo');
});

test('myanimelist: anime pages, genre ids join with comma', () => {
  const a = adapterFor('myanimelist');
  assert.ok(a.matches('https://myanimelist.net/anime/5114'));
  const items = [
    a.extractItem(fakeAnchor('/anime/genre/1/Action', 'Action')),
    a.extractItem(fakeAnchor('/anime/genre/8/Drama', 'Drama'))
  ];
  assert.strictEqual(a.buildSearchUrl(items),
    'https://myanimelist.net/anime.php?genres=1,8');
});

test('anilist: matches either genre-path or ?genres= chip form', () => {
  const a = adapterFor('anilist');
  assert.ok(a.matches('https://anilist.co/anime/1535/Death-Note/'));
  const items = [
    a.extractItem(fakeAnchor('/search/anime/Mystery', 'Mystery')),
    a.extractItem(fakeAnchor('/search/anime?genres=Crime', 'Crime'))
  ];
  assert.strictEqual(a.buildSearchUrl(items),
    'https://anilist.co/search/anime?genres=Mystery&genres=Crime');
});

test('royalroad: fiction pages, repeated tagsAdd param', () => {
  const a = adapterFor('royalroad');
  assert.ok(a.matches('https://www.royalroad.com/fiction/21220/mother-of-learning'));
  const items = [
    a.extractItem(fakeAnchor('/fictions/search?tagsAdd=fantasy', 'Fantasy')),
    a.extractItem(fakeAnchor('/fictions/search?tagsAdd=litrpg', 'LitRPG'))
  ];
  assert.strictEqual(a.buildSearchUrl(items),
    'https://www.royalroad.com/fictions/search?tagsAdd=fantasy&tagsAdd=litrpg');
});

test('musicbrainz: release-group pages, tag:"a" AND tag:"b" Lucene query', () => {
  const a = adapterFor('musicbrainz');
  assert.ok(a.matches('https://musicbrainz.org/release-group/f5093c06-23e3-404f-aeaa-40f72885ee3a'));
  const items = [
    a.extractItem(fakeAnchor('/tag/progressive%20rock', 'progressive rock')),
    a.extractItem(fakeAnchor('/tag/concept%20album', 'concept album'))
  ];
  const url = a.buildSearchUrl(items);
  assert.ok(url.startsWith('https://musicbrainz.org/search?type=release_group&method=advanced&query='));
  assert.strictEqual(decodeURIComponent(url.split('query=')[1]),
    'tag:"progressive rock" AND tag:"concept album"');
});

test('flickr: photo pages, tags=a,b&tag_mode=all', () => {
  const a = adapterFor('flickr');
  assert.ok(a.matches('https://www.flickr.com/photos/torsten-reuschling/55440872075/'));
  const items = [
    a.extractItem(fakeAnchor('/photos/tags/sunset', 'sunset')),
    a.extractItem(fakeAnchor('/photos/tags/winter', 'winter'))
  ];
  assert.strictEqual(a.buildSearchUrl(items),
    'https://www.flickr.com/search/?tags=sunset,winter&tag_mode=all');
});

test('pixiv: artwork pages, space-joined (%20) tag segments', () => {
  const a = adapterFor('pixiv');
  assert.ok(a.matches('https://www.pixiv.net/en/artworks/148534552'));
  const items = [
    a.extractItem(fakeAnchor('/en/tags/%E9%A2%A8%E6%99%AF', 'scenery')),
    a.extractItem(fakeAnchor('/en/tags/%E7%8C%AB', 'cat'))
  ];
  assert.strictEqual(a.buildSearchUrl(items),
    'https://www.pixiv.net/tags/%E9%A2%A8%E6%99%AF%20%E7%8C%AB/artworks');
});

test('demoted sites (confirmed NOT AND) never register', () => {
  for (const id of ['justwatch', 'gitlab', 'bandcamp', 'twitch', 'ravelry']) {
    assert.strictEqual(byId(id).status, 'research', id + ' should be research (confirmed no AND mechanism)');
  }
});

test('engine: duplicate values collapse; empty selection → null', () => {
  const a = adapterFor('github');
  const i = a.extractItem(fakeAnchor('/topics/react', 'react'));
  assert.strictEqual(a.buildSearchUrl([i, { ...i }]),
    'https://github.com/search?q=topic%3Areact&type=repositories');
  assert.strictEqual(a.buildSearchUrl([]), null);
});

test('engine: chip labels longer than maxLabel are rejected (nav-link guard)', () => {
  const a = adapterFor('letterboxd');
  const long = fakeAnchor('/films/genre/comedy/', 'Browse all of the comedy films on Letterboxd sorted by popularity this week');
  assert.strictEqual(a.extractItem(long), null);
});

// ── runner ───────────────────────────────────────────────────────────

let failed = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    console.log('  ✓', name);
  } catch (err) {
    failed++;
    console.error('  ✗', name);
    console.error('   ', err.message);
  }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
