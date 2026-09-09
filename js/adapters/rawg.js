// RAWG adapter for Actify — category "Play".
//
// RAWG doesn't expose a session-length field, and game session length is
// inherently flexible (save anywhere, pick up later), so every game is
// reported with minutes: null. The Stage A filter in recommendation.js
// treats null minutes as "always passes the time filter". A small set of
// well-known long-running titles is mapped to a friendlier reason string
// but is otherwise identical to every other game.
//
// Wraps every fetch in try/catch and returns [] on any failure.

const RAWG_API_KEY = 'afa38839014846298a5887351be9f8a0';
const RAWG_BASE = 'https://api.rawg.io/api/games';
const RESULT_LIMIT = 5;

// Titles that the user almost certainly already knows are long-running;
// surfaces them with a "sandbox / save anywhere" reason rather than the
// generic "flexible session" copy.
const FLEXIBLE_GAMES = new Set([
  'Elden Ring',
  'The Elder Scrolls V: Skyrim',
  'Skyrim',
  'Minecraft',
  'The Witcher 3: Wild Hunt',
  'The Legend of Zelda: Breath of the Wild',
  'Stardew Valley',
  'No Man\'s Sky',
  'Terraria',
  'Red Dead Redemption 2',
]);

async function search(freeMinutes) {
  try {
    if (!RAWG_API_KEY) return [];

    const url = new URL(RAWG_BASE);
    url.searchParams.set('ordering', '-rating');
    url.searchParams.set('page_size', String(RESULT_LIMIT));
    url.searchParams.set('key', RAWG_API_KEY);

    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const data = await res.json();
    const results = Array.isArray(data.results) ? data.results : [];

    return results.slice(0, RESULT_LIMIT)
      .filter(g => g && g.name)
      .map(g => ({
        id: `rawg-${g.id}`,
        title: g.name,
        category: 'Play',
        // null = "always passes the time filter" — see recommendation.js Stage A
        minutes: null,
        source: 'rawg',
        reason: FLEXIBLE_GAMES.has(g.name)
          ? 'save anywhere, pick up later'
          : 'flexible session',
        thumbnail: g.background_image || null,
        sourceUrl: `https://rawg.io/games/${g.slug || g.id}`,
        tags: ['gaming'],
      }));
  } catch (e) {
    console.error('RAWG adapter failed:', e);
    return [];
  }
}

window.RAWGAdapter = { search };
