// Site catalog: ~100 tag-heavy sites across 21 categories (max 5/category),
// each described as a config for src/core/siteAdapterEngine.js.
//
// STATUS MEANINGS (honesty is the product's core promise — "find items
// matching ALL selected tags"; we never ship a site whose combined search
// we can't back up):
//   verified  — AND semantics + chip DOM pattern confirmed live (dates in
//               `evidence`). Registered and active.
//   draft     — mechanism drafted from strong conventions (often the same
//               engine as a verified site) but NOT confirmed live. Only
//               registered when MSQ.ENABLE_DRAFT_SITES === true.
//   research  — no known true-AND mechanism (or verified NOT to have one).
//               Documented candidate only; never registered.
//
// Verified evidence collected 2026-08-19 via result-count comparison
// (combined < min(single counts) ⇒ intersection), same method as IMDb.

// `self` covers both the page (self === window) and the background service
// worker, which importScripts() this file to learn the supported domains.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.MSQ = root.MSQ || {};
    root.MSQ.SITE_CATALOG = root.MSQ.SITE_CATALOG || api.SITE_CATALOG;
    root.MSQ.verifiedDomains = api.verifiedDomains;
    root.MSQ.iconRules = api.iconRules;
    api.registerAll(root.MSQ);
  }
})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : null), function () {

  const enc = encodeURIComponent;

  // ── shared helpers ─────────────────────────────────────────────────

  // Stack Exchange network sites share one engine (AND verified on
  // stackoverflow.com: python 2,204,944 ∩ pandas 288,857 → 249,196).
  function stackExchangeSite(id, host, label) {
    return {
      id, label, category: 'dev-qa', status: 'verified',
      evidence: 'SE engine AND verified live on stackoverflow.com 2026-08-19; identical /questions/tagged/a+b mechanism across the network',
      host: new RegExp('(^|\\.)' + host.replace(/\./g, '\\.') + '$'),
      // Question detail pages AND question lists (home, /questions,
      // /questions/tagged/x, /search) — all render the same tag chips.
      path: /^\/($|questions(\/|$)|search)/,
      tagPattern: /\/questions\/tagged\/([^\/?"&+]+)$/,
      chipCss: ['a[href*="/questions/tagged/"]'],
      buildUrl: (vals) => 'https://' + host + '/questions/tagged/' + vals.join('+')
    };
  }

  // Gelbooru-engine boorus: tags=a+b is space-separated AND (verified live
  // on safebooru.org: landscape 9,595 ∩ sky 345,024 → 6,151).
  function booruSite(id, host, label, category, status, evidence) {
    return {
      id, label, category, status, evidence,
      host: new RegExp('(^|\\.)' + host.replace(/\./g, '\\.') + '$'),
      tagPattern: /[?&]tags=([^&"+ ]+)$/,
      chipCss: ['a[href*="tags="]'],
      buildUrl: (vals) => 'https://' + host + '/index.php?page=post&s=list&tags=' + vals.join('+')
    };
  }

  // AO3 encodes some characters in tag URL segments; reverse for display names.
  function ao3Unescape(seg) {
    return decodeURIComponent(seg)
      .replace(/\*s\*/g, '/').replace(/\*a\*/g, '&')
      .replace(/\*d\*/g, '.').replace(/\*q\*/g, '?').replace(/\*h\*/g, '#');
  }

  const SITE_CATALOG = [

    // ═══ 1. Movies & TV ═══════════════════════════════════════════════
    {
      id: 'imdb-ref', label: 'IMDb', category: 'movies-tv', status: 'verified',
      bespoke: true, // implemented in src/adapters/imdb/ (interests need custom classification)
      domains: ['imdb.com'], // no host regex here, so state it for the icon rules
      // Verified live 2026-08-23: 15 visible matches on a title page, 0 on the
      // IMDb homepage — the icon now greys out there instead of promising a
      // mode that page can't offer.
      chipCss: ['a[href*="/interest/in"]'],
      evidence: 'interests=a,b AND verified 2026-08-19: Period 5,162 ∩ Prison 309 → 31'
    },
    {
      id: 'letterboxd', label: 'Letterboxd', category: 'movies-tv', status: 'verified',
      evidence: 'combined page self-reports intersection: /films/genre/comedy+thriller/ → "5,257 films in multiple genres" (2026-08-19); chips /films/genre/SLUG/ on film pages',
      host: /(^|\.)letterboxd\.com$/, path: /^\/film\//,
      containerSelector: '#tab-genres',
      tagPattern: /\/films\/genre\/([a-z0-9-]+)\/?$/,
      chipCss: ['a[href*="/films/genre/"]'],
      buildUrl: (vals) => 'https://letterboxd.com/films/genre/' + vals.join('+') + '/'
    },
    {
      id: 'myanimelist', label: 'MyAnimeList', category: 'movies-tv', status: 'verified',
      evidence: 'genre[]=a&genre[]=b AND verified 2026-08-19: Action alone and Drama alone each paginate past 1,900 titles; combined drops to 45-47 unique titles (comma form genres=a,b confirmed identical) — combined << min(singles)',
      host: /(^|\.)myanimelist\.net$/, path: /^\/(anime|manga)\/\d+/,
      tagPattern: /\/anime\/genre\/(\d+)\//,
      chipCss: ['a[href*="/anime/genre/"]'],
      buildUrl: (vals) => 'https://myanimelist.net/anime.php?genres=' + vals.join(',')
    },
    {
      id: 'anilist', label: 'AniList', category: 'movies-tv', status: 'verified',
      evidence: 'genre_in AND verified 2026-08-19 via the public GraphQL API (same one the site itself calls): 20/20 sampled results for Mecha+Romance carried BOTH genres. Item pages expose real chip hrefs at /search/anime/{genre} and ?genres={tag}; the combined-URL search page applies both as simultaneous active filters in its own UI.',
      host: /(^|\.)anilist\.co$/, path: /^\/(anime|manga)\//,
      tagPattern: /\/search\/anime\/([^\/?"]+)$|[?&]genres=([^&"]+)/,
      chipCss: ['a[href*="/search/anime"]'],
      extractValue: (el, m) => m[1] || m[2],
      buildUrl: (vals) => 'https://anilist.co/search/anime?' + vals.map(v => 'genres=' + enc(v)).join('&')
    },
    {
      id: 'tmdb', label: 'TMDB', category: 'movies-tv', status: 'draft',
      evidence: '2026-08-19: discover?with_genres=a,b page is a client-rendered shell — curl gets byte-identical HTML regardless of query params (no total_results embedded), so AND vs OR is still unverified. This only proves curl can\'t check it, not that the mechanism is wrong; needs a real-browser check after JS runs.',
      host: /(^|\.)themoviedb\.org$/, path: /^\/(movie|tv)\//,
      tagPattern: /\/genre\/(\d+)[^"]*\/(?:movie|tv)/,
      buildUrl: (vals) => 'https://www.themoviedb.org/discover/movie?with_genres=' + vals.join(',')
    },

    // ═══ 2. Streaming guides ══════════════════════════════════════════
    { id: 'justwatch', label: 'JustWatch', category: 'streaming', status: 'research',
      notes: 'measured 2026-08-19: /us/movies?genres=act,cmy embeds a real totalCount in server HTML — act alone 26,870, cmy alone 43,499, combined 63,923 (≈ sum of both, unfiltered baseline 162,520). Confirmed OR, not AND. Also no clean genre chip hrefs on movie pages (genre code only appears inside a base64 analytics blob).' },
    { id: 'trakt', label: 'Trakt', category: 'streaming', status: 'draft',
      evidence: '2026-08-19: item and /movies/popular pages are thin SPA shells via curl (no server-rendered movie links to count) — unverified, not confirmed wrong; needs a real-browser check.',
      host: /(^|\.)trakt\.tv$/, path: /^\/(movies|shows)\//,
      tagPattern: /\/(?:movies|shows)\/popular\/?\?genres=([a-z0-9-]+)$/,
      buildUrl: (vals) => 'https://trakt.tv/movies/popular?genres=' + vals.join(',') },
    { id: 'kitsu', label: 'Kitsu', category: 'streaming', status: 'research',
      notes: 'JS app; category filter exists but no stable multi-category URL found yet' },
    { id: 'simkl', label: 'Simkl', category: 'streaming', status: 'research',
      notes: 'no known multi-genre AND URL' },

    // ═══ 3. PC gaming stores ══════════════════════════════════════════
    {
      id: 'steam', label: 'Steam', category: 'gaming-stores', status: 'verified',
      evidence: 'search/?tags=87918,3964 AND verified 2026-08-19: Farming Sim 3,212 ∩ Pixel Graphics 41,821 → 934; numeric IDs read from InitAppTagModal JSON on app pages',
      host: /(^|\.)store\.steampowered\.com$/, path: /^\/app\/\d+/,
      tagPattern: /store\.steampowered\.com\/tags\/[a-z]+\/([^\/?"]+)/,
      chipCss: ['a[href*="/tags/"]'],
      extractValue(el) {
        // Search needs numeric tag IDs; app pages embed name→id JSON.
        if (!window.__msqSteamTagMap) {
          window.__msqSteamTagMap = {};
          for (const s of document.querySelectorAll('script')) {
            const m = (s.textContent || '').match(/InitAppTagModal\([^,]+,\s*(\[.*?\])\s*,/s);
            if (m) {
              try {
                for (const t of JSON.parse(m[1])) window.__msqSteamTagMap[t.name] = String(t.tagid);
              } catch (_) { /* ignore malformed */ }
              break;
            }
          }
        }
        return window.__msqSteamTagMap[(el.textContent || '').trim()] || null;
      },
      buildUrl: (vals) => 'https://store.steampowered.com/search/?tags=' + vals.join(',')
    },
    {
      id: 'itchio', label: 'itch.io', category: 'gaming-stores', status: 'verified',
      evidence: 'path-composed filters; /games/tag-roguelike/tag-deck-builder page titled "Top games tagged deck-builder and Roguelike" (site-stated AND, 2026-08-19); chips itch.io/games/tag-SLUG on game pages',
      host: /(^|\.)itch\.io$/,
      tagPattern: /itch\.io\/games\/((?:tag|genre)-[a-z0-9-]+)$/,
      chipCss: ['a[href*="/games/tag-"]', 'a[href*="/games/genre-"]'],
      buildUrl: (vals) => 'https://itch.io/games/' + vals.join('/')
    },
    { id: 'gog', label: 'GOG', category: 'gaming-stores', status: 'research',
      notes: 'catalog API measured 2026-08-19: tags=in:indie,roguelike → 4,773 (indie 4,359 + roguelike 927) = OR, repeated param = last-wins. No AND mechanism found.' },
    { id: 'epic-games', label: 'Epic Games Store', category: 'gaming-stores', status: 'research',
      notes: 'JS app, tag filters exist in UI; URL semantics unverified' },
    { id: 'humble', label: 'Humble Store', category: 'gaming-stores', status: 'research',
      notes: 'no known multi-tag AND URL' },

    // ═══ 4. Gaming community / DBs ════════════════════════════════════
    { id: 'backloggd', label: 'Backloggd', category: 'gaming-community', status: 'draft',
      evidence: '2026-08-19: real chip hrefs found on item pages are path-segments, e.g. /games/lib/popular/genre:role-playing-rpg/ — NOT the ?genre= query form previously assumed (corrected below). Comma-joined path (genre:a,b/) returned HTTP 500. Page also exposes a separate AJAX filter endpoint (/filters/_games_lib_popular_), suggesting true multi-genre filtering may be POST/JS-driven rather than a plain GET URL. Mechanism still unconfirmed.',
      host: /(^|\.)backloggd\.com$/, path: /^\/games\//,
      tagPattern: /\/games\/lib\/popular\/genre:([a-z0-9-]+)\//,
      buildUrl: (vals) => 'https://www.backloggd.com/games/lib/popular/' + vals.map((v) => 'genre:' + v + '/').join('') },
    { id: 'rawg', label: 'RAWG', category: 'gaming-community', status: 'draft',
      evidence: '2026-08-19: public API requires a key (401 on all requests); HTML fallback (rawg.io/games?tags=id1,id2) returns a generic SEO shell with only a sitewide total, no filtered count. AND semantics documented by RAWG but unverified live.',
      host: /(^|\.)rawg\.io$/, path: /^\/games\//,
      tagPattern: /\/tags\/([a-z0-9-]+)/,
      buildUrl: (vals) => 'https://rawg.io/games?tags=' + vals.join(',') },
    { id: 'nexusmods', label: 'Nexus Mods', category: 'gaming-community', status: 'draft',
      evidence: '2026-08-19: mod pages are Cloudflare-walled to curl (403 challenge); mechanism unverified live.',
      host: /(^|\.)nexusmods\.com$/, path: /\/mods\//,
      tagPattern: /[?&]tags(?:%5B%5D|\[\])?=([^&"]+)/,
      buildUrl: (vals) => 'https://www.nexusmods.com/mods?' + vals.map(v => 'tags[]=' + enc(v)).join('&') },
    { id: 'moddb', label: 'ModDB', category: 'gaming-community', status: 'research',
      notes: 'single-tag browse only' },
    { id: 'boardgamegeek', label: 'BoardGameGeek', category: 'gaming-community', status: 'research',
      notes: 'advanced search is POST-based; no shareable multi-mechanic AND URL' },

    // ═══ 5. Dev Q&A (Stack Exchange network) ══════════════════════════
    stackExchangeSite('stackoverflow', 'stackoverflow.com', 'Stack Overflow'),
    stackExchangeSite('superuser', 'superuser.com', 'Super User'),
    stackExchangeSite('serverfault', 'serverfault.com', 'Server Fault'),
    stackExchangeSite('askubuntu', 'askubuntu.com', 'Ask Ubuntu'),
    stackExchangeSite('math-se', 'math.stackexchange.com', 'Mathematics SE'),

    // ═══ 6. Code hosting & packages ═══════════════════════════════════
    {
      id: 'github', label: 'GitHub', category: 'code', status: 'verified',
      evidence: 'search?q=topic:react+topic:hooks AND verified 2026-08-19: 509,704 ∩ 13,657 → 7,343; chips /topics/SLUG on repo pages',
      host: /(^|\.)github\.com$/, path: /^\/[^\/]+\/[^\/]+\/?$/,
      tagPattern: /^\/topics\/([a-z0-9-]+)$/,
      buildUrl: (vals) => 'https://github.com/search?q=' + vals.map(v => enc('topic:' + v)).join('+') + '&type=repositories'
    },
    {
      id: 'npm', label: 'npm', category: 'code', status: 'verified',
      evidence: 'search?q=keywords:framework,middleware AND verified 2026-08-19: 38,054 ∩ 12,964 → 1,224; chips /search?q=keywords:SLUG on package pages',
      host: /(^|\.)npmjs\.com$/, path: /^\/package\//,
      tagPattern: /\/search\?q=keywords(?::|%3A)([^&"]+)$/,
      chipCss: ['a[href*="keywords:"]', 'a[href*="keywords%3A"]'],
      buildUrl: (vals) => 'https://www.npmjs.com/search?q=' + enc('keywords:' + vals.join(','))
    },
    { id: 'pypi', label: 'PyPI', category: 'code', status: 'draft',
      evidence: '2026-08-19: classifier chips /search/?c=... confirmed on project pages; all /search/?c=... requests hit a Fastly "Client Challenge" JS wall via curl — mechanism still unverified live.',
      host: /(^|\.)pypi\.org$/, path: /^\/project\//,
      tagPattern: /\/search\/?\?c=([^&"]+)/,
      buildUrl: (vals) => 'https://pypi.org/search/?' + vals.map(v => 'c=' + v).join('&') },
    { id: 'gitlab', label: 'GitLab', category: 'code', status: 'research',
      notes: 'measured 2026-08-19: /explore/projects/topics/ruby vs the same URL with a second &topic=rails appended returned byte-identical HTML — the public topic explorer silently ignores any second topic. No multi-topic AND mechanism exists.' },
    { id: 'dockerhub', label: 'Docker Hub', category: 'code', status: 'research',
      notes: 'search facets are JS state, no stable multi-tag URL' },

    // ═══ 7. Books ═════════════════════════════════════════════════════
    { id: 'openlibrary', label: 'Open Library', category: 'books', status: 'research',
      notes: 'measured 2026-08-19: repeated ?subject= is NOT AND (Fantasy 117,663; Magic 30,113; both 30,118). Fielded q=subject:"A" subject:"B" still unverified — candidate for retry.' },
    { id: 'goodreads', label: 'Goodreads', category: 'books', status: 'research',
      notes: 'shelves/genres have no public intersection endpoint' },
    { id: 'librarything', label: 'LibraryThing', category: 'books', status: 'draft',
      evidence: '2026-08-19: all requests (tag pages and the comma-combined form) returned HTTP 403 even with a browser user-agent — mechanism still unverified live.',
      host: /(^|\.)librarything\.com$/, path: /^\/work\//,
      tagPattern: /\/tag\/([^\/?"]+)$/,
      buildUrl: (vals) => 'https://www.librarything.com/tag/' + vals.map(enc).join(',') },
    {
      id: 'royalroad', label: 'Royal Road', category: 'books', status: 'verified',
      evidence: 'fictions/search?tagsAdd=a&tagsAdd=b AND verified 2026-08-19 via pagination totals: Fantasy alone ~92,300 fictions, LitRPG alone ~22,580, combined ~19,380 — combined < min(singles); chips confirmed as /fictions/search?tagsAdd=SLUG on fiction pages',
      host: /(^|\.)royalroad\.com$/, path: /^\/fiction\/\d+/,
      tagPattern: /\/fictions\/search\?(?:.*&)?tagsAdd=([^&"]+)/,
      chipCss: ['a[href*="tagsAdd="]'],
      buildUrl: (vals) => 'https://www.royalroad.com/fictions/search?' + vals.map(v => 'tagsAdd=' + enc(v)).join('&')
    },
    { id: 'storygraph', label: 'The StoryGraph', category: 'books', status: 'research',
      notes: 'browse filters require login session' },

    // ═══ 8. Fanfiction & writing ══════════════════════════════════════
    {
      id: 'ao3', label: 'Archive of Our Own', category: 'fanfic', status: 'verified',
      evidence: '/tags/Fluff/works + other_tag_names=Angst AND verified 2026-08-19: 3,217,599 → 1,076,516; chips /tags/NAME/works on work pages',
      host: /(^|\.)archiveofourown\.org$/, path: /^\/works\/\d+/,
      tagPattern: /^\/tags\/([^\/"]+)\/works$/,
      chipCss: ['a[href*="/tags/"]'],
      buildUrl(vals) {
        const base = vals[0];
        const rest = vals.slice(1).map(ao3Unescape);
        let url = 'https://archiveofourown.org/tags/' + base + '/works';
        if (rest.length) url += '?work_search%5Bother_tag_names%5D=' + enc(rest.join(',')) + '&commit=Sort+and+Filter';
        return url;
      }
    },
    { id: 'ffnet', label: 'FanFiction.net', category: 'fanfic', status: 'research',
      notes: 'Cloudflare-hostile; genre filters exist only in POST-driven filter UI' },
    { id: 'wattpad', label: 'Wattpad', category: 'fanfic', status: 'research',
      notes: 'tag search is single-tag; multi-tag is OR-ish text search' },
    { id: 'scribblehub', label: 'Scribble Hub', category: 'fanfic', status: 'draft',
      evidence: '2026-08-19: series-finder?sf=1&tgi=1,2&mgi=and exposes an explicit AND mode with numeric tag IDs, but all three test requests returned HTTP 403 (Cloudflare) — mechanism still unverified live.',
      host: /(^|\.)scribblehub\.com$/, path: /^\/series\/\d+/,
      tagPattern: /[?&]tgi=(\d+)/,
      buildUrl: (vals) => 'https://www.scribblehub.com/series-finder/?sf=1&tgi=' + vals.join(',') + '&mgi=and&sort=ratings&order=desc' },

    // ═══ 9. Music ═════════════════════════════════════════════════════
    {
      id: 'discogs', label: 'Discogs', category: 'music', status: 'verified',
      evidence: 'search/?style_exact=Ambient&style_exact=Downtempo AND verified 2026-08-19: Ambient 454K+ releases → combined 58K+; chips /genre/X /style/Y on release pages (client-rendered DOM)',
      host: /(^|\.)discogs\.com$/, path: /^\/(release|master)\//,
      tagPattern: /^\/(genre|style)\/([^\/?"]+)/,
      chipCss: ['a[href^="/genre/"]', 'a[href^="/style/"]'],
      extractValue: (el, m) => m[1] + ':' + decodeURIComponent(m[2]),
      buildUrl(vals) {
        const params = vals.map((v) => {
          const [kind, name] = v.split(/:(.*)/s);
          return (kind === 'genre' ? 'genre_exact=' : 'style_exact=') + enc(name);
        });
        return 'https://www.discogs.com/search/?' + params.join('&') + '&type=release';
      }
    },
    { id: 'rateyourmusic', label: 'Rate Your Music', category: 'music', status: 'draft',
      evidence: '2026-08-19: /charts/top/album/all-time/g:ambient,dream-pop/ returned HTTP 403 (Cloudflare Turnstile) — mechanism still unverified live.',
      host: /(^|\.)rateyourmusic\.com$/, path: /^\/release\//,
      tagPattern: /\/genre\/([^\/?"]+)/,
      buildUrl: (vals) => 'https://rateyourmusic.com/charts/top/album/all-time/g:' + vals.map(enc).join(',') },
    { id: 'bandcamp', label: 'Bandcamp', category: 'music', status: 'research',
      notes: 'measured 2026-08-19: the discover JSON API (get_web?g=SLUG) only accepts one genre slug — an undocumented second param changes total_count (1624→1840) but neither matches AND (would need <1624) nor OR (would need ≥2584), so it is not a real combining filter, just noise. No genuine multi-genre mechanism found.' },
    {
      id: 'musicbrainz', label: 'MusicBrainz', category: 'music', status: 'verified',
      evidence: '"tag:a AND tag:b" Lucene query AND verified 2026-08-19 via the public ws/2 API: tag:ambient 111,861 ∩ tag:downtempo 51,205 → 11,299 (combined well below min of singles). Chip hrefs confirmed live in a real browser on a release-group page (/tag/SLUG links, e.g. /tag/progressive%20rock) — item pages are behind a JS proof-of-work wall that blocks curl but resolves normally for real browsers.',
      host: /(^|\.)musicbrainz\.org$/, path: /^\/(release|release-group|artist)\//,
      tagPattern: /\/tag\/([^\/?"]+)/,
      chipCss: ['a[href^="/tag/"]'],
      buildUrl: (vals) => 'https://musicbrainz.org/search?type=release_group&method=advanced&query=' + enc(vals.map(v => 'tag:"' + decodeURIComponent(v) + '"').join(' AND '))
    },
    { id: 'lastfm', label: 'Last.fm', category: 'music', status: 'research',
      notes: 'tag pages are single-tag; no intersection endpoint' },

    // ═══ 10. Photos ═══════════════════════════════════════════════════
    {
      id: 'flickr', label: 'Flickr', category: 'photos', status: 'verified',
      evidence: 'search/?tags=a,b&tag_mode=all AND verified 2026-08-19: tags=sunset 978,795 ∩ tags=ocean 946,949 → 514,107 (from the "totalItems" value embedded next to apiParams in the search page\'s server-rendered JSON, not the paginated-fetch total which is capped at 4,000). Chip hrefs confirmed live on a real photo page (/photos/tags/SLUG).',
      host: /(^|\.)flickr\.com$/, path: /^\/photos\/[^\/]+\/\d+/,
      tagPattern: /\/photos\/tags\/([^\/?"]+)/,
      chipCss: ['a[href*="/photos/tags/"]'],
      buildUrl: (vals) => 'https://www.flickr.com/search/?tags=' + vals.map((v) => enc(decodeURIComponent(v))).join(',') + '&tag_mode=all'
    },
    { id: 'unsplash', label: 'Unsplash', category: 'photos', status: 'research', notes: 'text search only' },
    { id: 'pexels', label: 'Pexels', category: 'photos', status: 'research', notes: 'text search only' },
    { id: 'pixabay', label: 'Pixabay', category: 'photos', status: 'research', notes: 'text search treats terms loosely' },
    { id: '500px', label: '500px', category: 'photos', status: 'research', notes: 'JS app, no stable multi-tag URL' },

    // ═══ 11. Art & design ═════════════════════════════════════════════
    {
      id: 'pixiv', label: 'pixiv', category: 'art', status: 'verified',
      evidence: '/tags/A%20B/artworks (space-separated tags) AND verified 2026-08-19: scenery (風景) 310,039 works ∩ cat (猫) 237,166 works → 3,787 combined — no login required. Chip hrefs confirmed live on a real artwork page (/tags/SLUG, e.g. /en/tags/%E9%A2%A8%E6%99%AF).',
      host: /(^|\.)pixiv\.net$/, path: /\/artworks\/\d+/,
      tagPattern: /\/tags\/([^\/?"]+)(?:\/artworks)?$/,
      chipCss: ['a[href*="/tags/"]'],
      buildUrl: (vals) => 'https://www.pixiv.net/tags/' + vals.join('%20') + '/artworks'
    },
    { id: 'artstation', label: 'ArtStation', category: 'art', status: 'research',
      notes: 'search is JS; tag AND not URL-addressable' },
    { id: 'deviantart', label: 'DeviantArt', category: 'art', status: 'research',
      notes: 'tag pages single-tag; multi-word becomes text search' },
    { id: 'behance', label: 'Behance', category: 'art', status: 'research', notes: 'text search only' },
    { id: 'dribbble', label: 'Dribbble', category: 'art', status: 'research', notes: 'single tag pages only' },

    // ═══ 12. Academic ═════════════════════════════════════════════════
    {
      id: 'arxiv', label: 'arXiv', category: 'academic', status: 'verified',
      evidence: 'advanced search cross_list_category AND verified 2026-08-19: cs.LG 139,718 ∩ stat.ML 58,104 → 11,552; chips /list/CODE/... on abs pages',
      host: /(^|\.)arxiv\.org$/, path: /^\/abs\//,
      tagPattern: /^\/list\/([a-z-]+(?:\.[A-Z]{2})?)\//,
      chipCss: ['a[href^="/list/"]'],
      buildUrl(vals) {
        const terms = vals.map((v, i) =>
          'terms-' + i + '-operator=AND&terms-' + i + '-term=' + enc(v) + '&terms-' + i + '-field=cross_list_category');
        return 'https://arxiv.org/search/advanced?advanced=&' + terms.join('&') + '&start=0';
      }
    },
    {
      id: 'pubmed', label: 'PubMed', category: 'academic', status: 'verified',
      evidence: '?term=A[MeSH] AND B[MeSH] verified 2026-08-19: Neoplasms 4,282,732 ∩ Apoptosis 372,314 → 149,069; MeSH chips are <button> elements on article pages',
      host: /(^|\.)pubmed\.ncbi\.nlm\.nih\.gov$/, path: /^\/\d+\/?$/,
      chipSelector: '#mesh-terms button.keyword-actions-trigger',
      chipCss: ['button.keyword-actions-trigger'],
      extractValue: (el) => (el.textContent || '').trim().replace(/\*$/, '') || null,
      buildUrl: (vals) => 'https://pubmed.ncbi.nlm.nih.gov/?term=' + enc(vals.map(v => '"' + v + '"[MeSH Terms]').join(' AND '))
    },
    { id: 'semanticscholar', label: 'Semantic Scholar', category: 'academic', status: 'research',
      notes: 'fields-of-study filter is JS state' },
    { id: 'openalex', label: 'OpenAlex', category: 'academic', status: 'draft',
      evidence: '2026-08-19: the AND mechanism itself is confirmed via the public API (filter=concepts.id:A,concepts.id:B: Computer Science 106,846,825 ∩ Machine Learning 4,702,674 → 4,686,177 — repeated &filter= params do NOT combine, only the comma form works). But the openalex.org UI is a facet/stats explorer, not a list of clickable concept chips on a work page — no real chip element was found live, so DOM discovery is still unconfirmed.',
      host: /(^|\.)openalex\.org$/, path: /^\/works\//,
      tagPattern: /concepts\.id:([A-Za-z0-9]+)/,
      buildUrl: (vals) => 'https://openalex.org/works?filter=' + enc(vals.map(v => 'concepts.id:' + v).join(',')) },
    { id: 'ssrn', label: 'SSRN', category: 'academic', status: 'research', notes: 'no multi-topic URL' },

    // ═══ 13. Anime imageboards (SFW) ══════════════════════════════════
    booruSite('safebooru', 'safebooru.org', 'Safebooru', 'imageboards', 'verified',
      'API count verified 2026-08-19: landscape 9,595 ∩ sky 345,024 → 6,151 via tags=landscape+sky'),
    booruSite('gelbooru', 'gelbooru.com', 'Gelbooru', 'imageboards', 'verified',
      'tags=a+b AND verified 2026-08-19 via pagination totals: 1girl alone ~8,902,320 posts, solo alone ~7,119,546, combined ~6,221,670 — combined < min(singles); chip hrefs confirmed as index.php?page=post&s=list&tags=X on a real post page'),
    {
      id: 'danbooru', label: 'Danbooru', category: 'imageboards', status: 'draft',
      evidence: 'space-separated tags=a b is Danbooru\'s canonical AND (2-tag limit anonymous); Cloudflare-blocked for automated verification',
      host: /(^|\.)danbooru\.donmai\.us$/,
      tagPattern: /\/posts\?tags=([^&"+ ]+)$/,
      buildUrl: (vals) => 'https://danbooru.donmai.us/posts?tags=' + vals.slice(0, 2).map(enc).join('+')
    },
    { id: 'zerochan', label: 'Zerochan', category: 'imageboards', status: 'draft',
      evidence: '2026-08-19: /A,B comma path is the site\'s own multi-tag AND browse, but all requests returned HTTP 503 (Cloudflare JS challenge) — mechanism still unverified live.',
      host: /(^|\.)zerochan\.net$/,
      tagPattern: /^\/([^\/?",]+)$/,
      buildUrl: (vals) => 'https://www.zerochan.net/' + vals.map(enc).join(',') },

    // ═══ 14. Recipes ══════════════════════════════════════════════════
    { id: 'allrecipes', label: 'Allrecipes', category: 'recipes', status: 'research', notes: 'category pages single; search is text' },
    { id: 'epicurious', label: 'Epicurious', category: 'recipes', status: 'research', notes: 'facets are JS state' },
    { id: 'seriouseats', label: 'Serious Eats', category: 'recipes', status: 'research', notes: 'no tag intersection' },
    { id: 'food52', label: 'Food52', category: 'recipes', status: 'research', notes: 'no tag intersection' },

    // ═══ 15. E-commerce ═══════════════════════════════════════════════
    { id: 'ebay', label: 'eBay', category: 'ecommerce', status: 'draft',
      evidence: 'aspect filters chain in URL params and are ANDed per facet, but the facet NAMES are category-specific and not guessable: tested &Brand=Dell&Hard%20Drive%20Capacity=512%20GB on a laptop search 2026-08-19 and the second param was silently ignored (result count identical to Brand=Dell alone) because that exact aspect name is wrong for the category. Needs a real per-category facet-name lookup, not a single generic pattern.',
      host: /(^|\.)ebay\.com$/, path: /^\/itm\//,
      tagPattern: /\/b\/([^\/?"]+)\//,
      buildUrl: (vals) => 'https://www.ebay.com/sch/i.html?_nkw=' + enc(vals.join(' ')) },
    { id: 'etsy', label: 'Etsy', category: 'ecommerce', status: 'research', notes: 'attribute facets are session-bound; tag links are text search' },
    { id: 'amazon', label: 'Amazon', category: 'ecommerce', status: 'research', notes: 'the AND mechanism itself is real and confirmed 2026-08-19 (rh=p_89:Dell,p_72:2661618011 combines two DIFFERENT facet types as a true intersection: Dell 1,000 ∩ 4-star-and-up ~100,000 → 538). But facet codes like p_89/p_72 are opaque, undocumented, and differ per category, so there is no single generic tagPattern/buildUrl — would need a per-category facet-ID lookup table. Amazon\'s own search page also already offers native checkbox multi-select filtering, which undercuts the extension\'s core pitch of "turning single-click tags into multi-select" — the problem this product solves does not really exist here.' },
    { id: 'aliexpress', label: 'AliExpress', category: 'ecommerce', status: 'research', notes: 'text search only' },
    { id: 'walmart', label: 'Walmart', category: 'ecommerce', status: 'research', notes: 'facets are JS state' },

    // ═══ 16. Travel ═══════════════════════════════════════════════════
    { id: 'airbnb', label: 'Airbnb', category: 'travel', status: 'draft',
      evidence: 'amenities[]=4&amenities[]=5 are ANDed filters; listing-page "amenity chips" are not links though — needs custom chipSelector work',
      host: /(^|\.)airbnb\.com$/, path: /^\/rooms\//,
      chipSelector: '[data-section-id="AMENITIES_DEFAULT"] div',
      extractValue: () => null, // placeholder: amenity→id mapping required
      buildUrl: (vals) => 'https://www.airbnb.com/s/homes?' + vals.map(v => 'amenities[]=' + enc(v)).join('&') },
    { id: 'booking', label: 'Booking.com', category: 'travel', status: 'research', notes: 'nflt= filter param is opaque/session-bound' },
    { id: 'tripadvisor', label: 'TripAdvisor', category: 'travel', status: 'research', notes: 'facets are JS state' },
    { id: 'hostelworld', label: 'Hostelworld', category: 'travel', status: 'research', notes: 'no tag URLs' },

    // ═══ 17. Jobs ═════════════════════════════════════════════════════
    { id: 'linkedin-jobs', label: 'LinkedIn Jobs', category: 'jobs', status: 'research', notes: 'filters require login session' },
    { id: 'indeed', label: 'Indeed', category: 'jobs', status: 'research', notes: 'attribute filters (&sc=) are encoded/opaque' },
    { id: 'glassdoor', label: 'Glassdoor', category: 'jobs', status: 'research', notes: 'login-walled' },
    { id: 'wellfound', label: 'Wellfound', category: 'jobs', status: 'research', notes: 'role/location combos only, not free tags' },

    // ═══ 18. Blogging & news ══════════════════════════════════════════
    { id: 'devto', label: 'DEV Community', category: 'blogging', status: 'research',
      notes: 'tag chips /t/SLUG exist but search has no tag-AND (single-tag pages only)' },
    { id: 'medium', label: 'Medium', category: 'blogging', status: 'research', notes: 'single-tag pages only' },
    { id: 'hashnode', label: 'Hashnode', category: 'blogging', status: 'research', notes: 'single-tag pages only' },
    { id: 'tumblr', label: 'Tumblr', category: 'blogging', status: 'research', notes: 'multi-tag search is OR for anonymous users' },

    // ═══ 19. Video platforms ══════════════════════════════════════════
    { id: 'youtube', label: 'YouTube', category: 'video', status: 'research',
      notes: 'hashtag pages are single-tag; multi-hashtag search degrades to relevance text match — would violate the AND promise' },
    { id: 'twitch', label: 'Twitch', category: 'video', status: 'research',
      notes: 'measured 2026-08-19 in a real browser: /directory/category/{game}/tags/{tag} silently redirects to the plain category page — the tags path segment is dropped, not applied. No working multi-tag URL found. Live-stream results are also inherently volatile (viewer counts change every second), a poor fit for the site\'s own "search results" model even if a mechanism existed.' },
    { id: 'vimeo', label: 'Vimeo', category: 'video', status: 'research', notes: 'categories are single-select' },
    { id: 'dailymotion', label: 'Dailymotion', category: 'video', status: 'research', notes: 'no tag AND' },
    { id: 'tiktok', label: 'TikTok', category: 'video', status: 'research', notes: 'hashtag pages single; app-gated' },

    // ═══ 20. Adult (large-market category; drafted from URL conventions
    //         only — NOT verified in this workspace) ═══════════════════
    //
    // MSQ-STRIP-BEGIN adult
    // Everything between these markers is removed from Chrome Web Store
    // builds by tools/package.js. These entries are drafts, so they are
    // never registered and the shipped extension behaves identically
    // without them — but store reviewers read source, and adult domains in
    // the package invite questions the product doesn't need to answer yet.
    // Keep the markers in place; the packager fails loudly if they vanish.
    { id: 'rule34', label: 'Rule34', category: 'adult', status: 'draft',
      evidence: 'Gelbooru engine (same as verified safebooru.org): index.php?page=post&s=list&tags=a+b is native AND; not verified here',
      host: /(^|\.)rule34\.xxx$/,
      tagPattern: /[?&]tags=([^&"+ ]+)$/,
      buildUrl: (vals) => 'https://rule34.xxx/index.php?page=post&s=list&tags=' + vals.join('+') },
    { id: 'e621', label: 'e621', category: 'adult', status: 'draft',
      evidence: 'Danbooru-style engine: /posts?tags=a+b native AND (2-tag anon limit); not verified here',
      host: /(^|\.)e621\.net$/,
      tagPattern: /\/posts\?tags=([^&"+ ]+)$/,
      buildUrl: (vals) => 'https://e621.net/posts?tags=' + vals.slice(0, 2).map(enc).join('+') },
    { id: 'pornhub', label: 'Pornhub', category: 'adult', status: 'research',
      notes: 'video pages have category/tag links but search is single-category (?c=ID) or text; no known multi-category AND URL — shipping it would fake the intersection' },
    { id: 'xvideos', label: 'XVideos', category: 'adult', status: 'research', notes: 'k= is text search, tags not ANDable' },
    { id: 'xhamster', label: 'xHamster', category: 'adult', status: 'research', notes: 'single-category browse only' },
    // MSQ-STRIP-END adult

    // ═══ 21. Makers & misc ════════════════════════════════════════════
    { id: 'ravelry', label: 'Ravelry', category: 'makers', status: 'research',
      notes: 'confirmed 2026-08-19: /patterns/search now redirects anonymous visitors to /account/login (HTTP 302, "You must log in"). The generated search URL would just dead-end at a login wall for most users, not only unverifiable — a product-level blocker, not just a verification gap.' },
    { id: 'thingiverse', label: 'Thingiverse', category: 'makers', status: 'research', notes: 'single-tag pages only' },
    { id: 'instructables', label: 'Instructables', category: 'makers', status: 'research', notes: 'channel pages single' },
    { id: 'untappd', label: 'Untappd', category: 'makers', status: 'research', notes: 'style pages single; login-gated search' },
    { id: 'alltrails', label: 'AllTrails', category: 'makers', status: 'research', notes: 'attribute filters are JS state' }
  ];

  // Domain names behind each config's host RegExp. Every host pattern in
  // this file has the shape /(^|\.)example\.com$/, so the domain can be
  // derived rather than duplicated (a test asserts they stay in sync).
  // Used by the background worker to light the toolbar icon on supported
  // sites via declarativeContent — Chrome evaluates those rules internally,
  // so that mechanism passes no URLs to the extension.
  function domainsOf(cfg) {
    if (cfg.domains) return cfg.domains;
    if (!cfg.host) return [];
    const m = cfg.host.source.match(/^\(\^\|\\\.\)(.+)\$$/);
    return m ? [m[1].replace(/\\\./g, '.')] : [];
  }

  function verifiedDomains() {
    return [...new Set(
      SITE_CATALOG.filter((c) => c.status === 'verified').flatMap(domainsOf)
    )].sort();
  }

  // Sites deliberately matched by domain alone, with a reason. Chrome's
  // declarativeContent css matcher only counts *displayed* elements, so a
  // site that hides its chips at some viewport widths would produce a
  // false-negative grey icon on a narrow window — worse than being slightly
  // over-eager, because the extension genuinely does work there.
  const CSS_MATCH_EXEMPT = {
    'github.com': 'topics live in the About sidebar, which GitHub hides below ~1000px (hide-sm hide-md) — verified live 2026-08-23; a css rule would grey the icon on narrow windows even though the extension works'
  };

  // Per-page icon rules: which (domain, css) pairs should light the icon.
  // `css: null` means "match on domain alone" (see CSS_MATCH_EXEMPT).
  // Selectors must be COMPOUND (no combinators) — Chrome rejects the rest.
  function iconRules() {
    const rules = [];
    for (const cfg of SITE_CATALOG) {
      if (cfg.status !== 'verified') continue;
      for (const domain of domainsOf(cfg)) {
        if (CSS_MATCH_EXEMPT[domain]) {
          rules.push({ domain, css: null, exemptReason: CSS_MATCH_EXEMPT[domain] });
        } else if (cfg.chipCss && cfg.chipCss.length) {
          for (const css of cfg.chipCss) rules.push({ domain, css });
        } else {
          rules.push({ domain, css: null });
        }
      }
    }
    return rules;
  }

  function registerAll(MSQ) {
    if (!MSQ.registerAdapter || !MSQ.createSiteAdapter) return;
    for (const cfg of SITE_CATALOG) {
      if (cfg.bespoke) continue; // e.g. IMDb — has its own hand-written adapter
      const enabled = cfg.status === 'verified' ||
        (cfg.status === 'draft' && MSQ.ENABLE_DRAFT_SITES === true);
      if (!enabled || !cfg.buildUrl || (!cfg.tagPattern && !cfg.chipSelector)) continue;
      MSQ.registerAdapter(MSQ.createSiteAdapter(cfg));
    }
  }

  return { SITE_CATALOG, registerAll, ao3Unescape, domainsOf, verifiedDomains, iconRules, CSS_MATCH_EXEMPT };
});
