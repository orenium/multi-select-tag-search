# Where Multi-Select Tag Search works

Every site below was **verified live**: we compared real result counts to
confirm the combined search is a true intersection (all selected tags at
once) rather than an "any of these" search. Sites where no such search
exists are deliberately left out instead of faking it.

**23 sites supported today.** 16 more are drafted and awaiting verification; 59 were examined and have no true combined-tag search to build on.

| Site | Category | You select | One click gives you |
| --- | --- | --- | --- |
| IMDb | Movies & TV | Interests on a title page | Titles matching every interest at once |
| Letterboxd | Movies & TV | Genres on a film page | Films in all those genres at once |
| MyAnimeList | Movies & TV | Genres on an anime page | Anime matching every genre at once |
| AniList | Movies & TV | Genres and tags on an anime page | Anime matching all of them at once |
| Steam | Game stores | Tags on a game page | Games sharing all those tags |
| itch.io | Game stores | Tags on a game page | Games tagged with all of them |
| Stack Overflow | Developer Q&A | Tags on questions | Questions carrying all those tags |
| Super User | Developer Q&A | Tags on questions | Questions carrying all those tags |
| Server Fault | Developer Q&A | Tags on questions | Questions carrying all those tags |
| Ask Ubuntu | Developer Q&A | Tags on questions | Questions carrying all those tags |
| Mathematics SE | Developer Q&A | Tags on questions | Questions carrying all those tags |
| GitHub | Code & packages | Repository topics | Repos matching every topic |
| npm | Code & packages | Package keywords | Packages matching every keyword |
| Royal Road | Books | Tags on a fiction page | Fictions tagged with all of them |
| Archive of Our Own | Fanfiction & writing | Tags on a work | Works tagged with all of them |
| Discogs | Music | Genres and styles on a release | Releases matching every genre/style |
| MusicBrainz | Music | Tags on a release | Releases matching every tag |
| Flickr | Photos | Tags on a photo | Photos carrying all those tags |
| pixiv | Art & design | Tags on an artwork | Artworks matching every tag |
| arXiv | Academic & research | Subject categories on a paper | Papers cross-listed in all of them |
| PubMed | Academic & research | MeSH terms on an article | Articles indexed under all those terms |
| Safebooru | Image boards | Tags on a post | Posts carrying all those tags |
| Gelbooru | Image boards | Tags on a post | Posts carrying all those tags |

## Verification evidence

The counts behind each entry (measured 2026-08-19):

- **IMDb** — interests=a,b AND verified 2026-08-19: Period 5,162 ∩ Prison 309 → 31
- **Letterboxd** — combined page self-reports intersection: /films/genre/comedy+thriller/ → "5,257 films in multiple genres" (2026-08-19); chips /films/genre/SLUG/ on film pages
- **MyAnimeList** — genre[]=a&genre[]=b AND verified 2026-08-19: Action alone and Drama alone each paginate past 1,900 titles; combined drops to 45-47 unique titles (comma form genres=a,b confirmed identical) — combined << min(singles)
- **AniList** — genre_in AND verified 2026-08-19 via the public GraphQL API (same one the site itself calls): 20/20 sampled results for Mecha+Romance carried BOTH genres. Item pages expose real chip hrefs at /search/anime/{genre} and ?genres={tag}; the combined-URL search page applies both as simultaneous active filters in its own UI.
- **Steam** — search/?tags=87918,3964 AND verified 2026-08-19: Farming Sim 3,212 ∩ Pixel Graphics 41,821 → 934; numeric IDs read from InitAppTagModal JSON on app pages
- **itch.io** — path-composed filters; /games/tag-roguelike/tag-deck-builder page titled "Top games tagged deck-builder and Roguelike" (site-stated AND, 2026-08-19); chips itch.io/games/tag-SLUG on game pages
- **Stack Overflow** — SE engine AND verified live on stackoverflow.com 2026-08-19; identical /questions/tagged/a+b mechanism across the network
- **Super User** — SE engine AND verified live on stackoverflow.com 2026-08-19; identical /questions/tagged/a+b mechanism across the network
- **Server Fault** — SE engine AND verified live on stackoverflow.com 2026-08-19; identical /questions/tagged/a+b mechanism across the network
- **Ask Ubuntu** — SE engine AND verified live on stackoverflow.com 2026-08-19; identical /questions/tagged/a+b mechanism across the network
- **Mathematics SE** — SE engine AND verified live on stackoverflow.com 2026-08-19; identical /questions/tagged/a+b mechanism across the network
- **GitHub** — search?q=topic:react+topic:hooks AND verified 2026-08-19: 509,704 ∩ 13,657 → 7,343; chips /topics/SLUG on repo pages
- **npm** — search?q=keywords:framework,middleware AND verified 2026-08-19: 38,054 ∩ 12,964 → 1,224; chips /search?q=keywords:SLUG on package pages
- **Royal Road** — fictions/search?tagsAdd=a&tagsAdd=b AND verified 2026-08-19 via pagination totals: Fantasy alone ~92,300 fictions, LitRPG alone ~22,580, combined ~19,380 — combined < min(singles); chips confirmed as /fictions/search?tagsAdd=SLUG on fiction pages
- **Archive of Our Own** — /tags/Fluff/works + other_tag_names=Angst AND verified 2026-08-19: 3,217,599 → 1,076,516; chips /tags/NAME/works on work pages
- **Discogs** — search/?style_exact=Ambient&style_exact=Downtempo AND verified 2026-08-19: Ambient 454K+ releases → combined 58K+; chips /genre/X /style/Y on release pages (client-rendered DOM)
- **MusicBrainz** — "tag:a AND tag:b" Lucene query AND verified 2026-08-19 via the public ws/2 API: tag:ambient 111,861 ∩ tag:downtempo 51,205 → 11,299 (combined well below min of singles). Chip hrefs confirmed live in a real browser on a release-group page (/tag/SLUG links, e.g. /tag/progressive%20rock) — item pages are behind a JS proof-of-work wall that blocks curl but resolves normally for real browsers.
- **Flickr** — search/?tags=a,b&tag_mode=all AND verified 2026-08-19: tags=sunset 978,795 ∩ tags=ocean 946,949 → 514,107 (from the "totalItems" value embedded next to apiParams in the search page's server-rendered JSON, not the paginated-fetch total which is capped at 4,000). Chip hrefs confirmed live on a real photo page (/photos/tags/SLUG).
- **pixiv** — /tags/A%20B/artworks (space-separated tags) AND verified 2026-08-19: scenery (風景) 310,039 works ∩ cat (猫) 237,166 works → 3,787 combined — no login required. Chip hrefs confirmed live on a real artwork page (/tags/SLUG, e.g. /en/tags/%E9%A2%A8%E6%99%AF).
- **arXiv** — advanced search cross_list_category AND verified 2026-08-19: cs.LG 139,718 ∩ stat.ML 58,104 → 11,552; chips /list/CODE/... on abs pages
- **PubMed** — ?term=A[MeSH] AND B[MeSH] verified 2026-08-19: Neoplasms 4,282,732 ∩ Apoptosis 372,314 → 149,069; MeSH chips are <button> elements on article pages
- **Safebooru** — API count verified 2026-08-19: landscape 9,595 ∩ sky 345,024 → 6,151 via tags=landscape+sky
- **Gelbooru** — tags=a+b AND verified 2026-08-19 via pagination totals: 1girl alone ~8,902,320 posts, solo alone ~7,119,546, combined ~6,221,670 — combined < min(singles); chip hrefs confirmed as index.php?page=post&s=list&tags=X on a real post page

_Generated by `node tools/generateSupportedSites.js` — do not edit by hand._
