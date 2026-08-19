// Unit tests for the IMDb query builder (pure functions, no DOM).
// Run with:  node tests/queryBuilder.test.js
const assert = require('node:assert');
const qb = require('../src/adapters/imdb/imdbQueryBuilder.js');

const tests = [];
function test(name, fn) { tests.push([name, fn]); }

// ── classifyHref ─────────────────────────────────────────────────────

test('classifies interest chip hrefs', () => {
  assert.deepStrictEqual(
    qb.classifyHref('/interest/in0000085/?ref_=tt_ov_in_3', 'Prison Drama'),
    { kind: 'interest', value: 'in0000085' }
  );
  assert.deepStrictEqual(
    qb.classifyHref('https://www.imdb.com/interest/in0000076/', 'Drama'),
    { kind: 'interest', value: 'in0000076' }
  );
});

test('classifies legacy genre search hrefs', () => {
  assert.deepStrictEqual(
    qb.classifyHref('/search/title/?genres=drama&explore=genres', 'Drama'),
    { kind: 'genre', value: 'drama' }
  );
});

test('classifies keyword hrefs', () => {
  assert.deepStrictEqual(
    qb.classifyHref('/search/keyword/?keywords=prison-escape', 'Prison Escape'),
    { kind: 'keyword', value: 'prison-escape' }
  );
});

test('falls back to slugified label when href has no known filter', () => {
  assert.deepStrictEqual(
    qb.classifyHref('/some/unknown/path', 'Psychological Drama'),
    { kind: 'keyword', value: 'psychological-drama' }
  );
});

test('returns null when nothing is mappable', () => {
  assert.strictEqual(qb.classifyHref('', ''), null);
  assert.strictEqual(qb.classifyHref('/some/unknown/path', '   '), null);
});

// ── slugifyKeyword ───────────────────────────────────────────────────

test('slugifies labels the way IMDb keywords expect', () => {
  assert.strictEqual(qb.slugifyKeyword('Period Drama'), 'period-drama');
  assert.strictEqual(qb.slugifyKeyword("  Cop's Life! "), 'cops-life');
});

// ── buildSearchUrl ───────────────────────────────────────────────────

const periodDrama = { kind: 'interest', value: 'in0000083', label: 'Period Drama' };
const prisonDrama = { kind: 'interest', value: 'in0000085', label: 'Prison Drama' };
const psychDrama = { kind: 'interest', value: 'in0000086', label: 'Psychological Drama' };

test('two interests → single ANDed interests param', () => {
  assert.strictEqual(
    qb.buildSearchUrl([periodDrama, prisonDrama]),
    'https://www.imdb.com/search/title/?interests=in0000083,in0000085'
  );
});

test('three interests keep selection order', () => {
  assert.strictEqual(
    qb.buildSearchUrl([psychDrama, periodDrama, prisonDrama]),
    'https://www.imdb.com/search/title/?interests=in0000086,in0000083,in0000085'
  );
});

test('mixed kinds combine into one URL (all params ANDed by IMDb)', () => {
  const url = qb.buildSearchUrl([
    { kind: 'genre', value: 'drama' },
    prisonDrama,
    { kind: 'keyword', value: 'wrongful-conviction' }
  ]);
  assert.strictEqual(
    url,
    'https://www.imdb.com/search/title/?interests=in0000085&genres=drama&keywords=wrongful-conviction'
  );
});

test('duplicate items collapse to one filter', () => {
  assert.strictEqual(
    qb.buildSearchUrl([prisonDrama, { ...prisonDrama }, periodDrama]),
    'https://www.imdb.com/search/title/?interests=in0000085,in0000083'
  );
});

test('empty / unusable input → null', () => {
  assert.strictEqual(qb.buildSearchUrl([]), null);
  assert.strictEqual(qb.buildSearchUrl(null), null);
  assert.strictEqual(qb.buildSearchUrl([{ kind: 'bogus', value: 'x' }, {}]), null);
});

test('describeStrategy summarizes the mapping', () => {
  assert.strictEqual(
    qb.describeStrategy([periodDrama, prisonDrama, { kind: 'genre', value: 'drama' }]),
    'interests = in0000083,in0000085  AND  genres = drama'
  );
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
