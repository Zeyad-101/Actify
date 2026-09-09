// Articles adapter for Actify — category "Read" with subCategory "article".
//
// Combines dev.to's public /api/articles (reading_time_minutes is provided
// directly) and Hacker News' Algolia search (no word count, so every
// story is estimated at a flexible 10 minutes). Each source is fetched
// in parallel; either failing is logged and skipped so the other can
// still contribute. Returns up to 5 combined results.
//
// Wraps every fetch in try/catch and returns [] on any failure.

const DEVTO_URL = 'https://dev.to/api/articles?per_page=10&top=7';
const HN_URL = 'https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=10';
const HN_DEFAULT_MINUTES = 10; // HN gives no word count → flexible default
const DEVTO_DEFAULT_MINUTES = 5; // reading_time_minutes usually present
const PER_SOURCE = 3; // up to 3 from each side, then merged up to 5 total

async function fetchDevto(freeMinutes) {
  const res = await fetch(DEVTO_URL);
  if (!res.ok) return [];
  const articles = await res.json();
  if (!Array.isArray(articles)) return [];

  const out = [];
  for (const a of articles) {
    if (!a || !a.title) continue;
    const minutes = Number.isFinite(a.reading_time_minutes) && a.reading_time_minutes > 0
      ? a.reading_time_minutes
      : DEVTO_DEFAULT_MINUTES;
    if (minutes > freeMinutes) continue;

    out.push({
      id: `devto-${a.id}`,
      title: a.title,
      category: 'Read',
      minutes,
      source: 'articles',
      reason: `${minutes} min read`,
      thumbnail: a.cover_image || a.social_image || null,
      sourceUrl: a.url || a.canonical_url || '',
      tags: ['reading'],
      subCategory: 'article',
    });
    if (out.length >= PER_SOURCE) break;
  }
  return out;
}

async function fetchHN(freeMinutes) {
  const res = await fetch(HN_URL);
  if (!res.ok) return [];
  const data = await res.json();
  const hits = Array.isArray(data.hits) ? data.hits : [];

  const out = [];
  for (const h of hits) {
    if (!h || !h.title) continue;
    const minutes = HN_DEFAULT_MINUTES;
    if (minutes > freeMinutes) continue;

    out.push({
      id: `hn-${h.objectID}`,
      title: h.title,
      category: 'Read',
      minutes,
      source: 'articles',
      reason: `${minutes} min read`,
      thumbnail: null,
      sourceUrl: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      tags: ['reading'],
      subCategory: 'article',
    });
    if (out.length >= PER_SOURCE) break;
  }
  return out;
}

async function search(freeMinutes) {
  try {
    // Fetch both sources in parallel; either rejection is caught here and
    // treated as an empty contribution so the other side still shows.
    const [devtoResult, hnResult] = await Promise.allSettled([
      fetchDevto(freeMinutes),
      fetchHN(freeMinutes),
    ]);

    const devto = devtoResult.status === 'fulfilled' ? devtoResult.value : [];
    const hn = hnResult.status === 'fulfilled' ? hnResult.value : [];

    if (devtoResult.status === 'rejected') {
      console.error('Articles: dev.to failed:', devtoResult.reason);
    }
    if (hnResult.status === 'rejected') {
      console.error('Articles: HN failed:', hnResult.reason);
    }

    return [...devto, ...hn].slice(0, 5);
  } catch (e) {
    console.error('Articles adapter failed:', e);
    return [];
  }
}

window.ArticlesAdapter = { search };
