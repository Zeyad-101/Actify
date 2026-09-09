// TMDB adapter for Actify — category "Watch".
//
// Discovers popular movies, fetches each candidate's runtime via the movie
// details endpoint, filters to runtime <= freeMinutes, and returns up to 5
// normalized items in the shared shape used by getRecommendations.
//
// Wraps every fetch in try/catch and returns [] on any failure so a TMDB
// outage never breaks the recommendation call.

const TMDB_API_KEY = '6649f01fd522af338eec1213fc4dd08a'; // v3 API key
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG = 'https://image.tmdb.org/t/p/w200';
const TMDB_CANDIDATE_LIMIT = 5; // discover call + 5 detail calls = 6 requests

async function fetchRuntime(movieId) {
  const url = `${TMDB_BASE}/movie/${movieId}?api_key=${encodeURIComponent(TMDB_API_KEY)}`;
  const res = await fetch(url);
  if (!res.ok) return 0;
  const detail = await res.json();
  return Number.isFinite(detail.runtime) ? detail.runtime : 0;
}

async function search(freeMinutes) {
  try {
    if (!TMDB_API_KEY) return [];

    const discoverUrl = new URL(`${TMDB_BASE}/discover/movie`);
    discoverUrl.searchParams.set('sort_by', 'popularity.desc');
    discoverUrl.searchParams.set('api_key', TMDB_API_KEY);
    discoverUrl.searchParams.set('page', '1');
    discoverUrl.searchParams.set('include_adult', 'false');
    discoverUrl.searchParams.set('language', 'en-US');

    const res = await fetch(discoverUrl.toString());
    if (!res.ok) return [];
    const data = await res.json();
    const candidates = (Array.isArray(data.results) ? data.results : [])
      .slice(0, TMDB_CANDIDATE_LIMIT);

    // Detail calls are independent — fetch in parallel.
    const detailed = await Promise.all(
      candidates.map(async (m) => {
        try {
          const runtime = await fetchRuntime(m.id);
          return { m, runtime };
        } catch {
          return { m, runtime: 0 };
        }
      })
    );

    const filtered = detailed
      .filter(({ m, runtime }) =>
        runtime > 0 && runtime <= freeMinutes
        && (m.title || m.original_title)
      )
      .slice(0, 5);

    return filtered.map(({ m, runtime }) => ({
      id: `tmdb-${m.id}`,
      title: m.title || m.original_title,
      category: 'Watch',
      minutes: runtime,
      source: 'tmdb',
      reason: `${runtime} min film`,
      thumbnail: m.poster_path ? `${TMDB_IMG}${m.poster_path}` : null,
      sourceUrl: `https://www.themoviedb.org/movie/${m.id}`,
      tags: ['movies'],
    }));
  } catch (e) {
    console.error('TMDB adapter failed:', e);
    return [];
  }
}

window.TMDBAdapter = { search };
