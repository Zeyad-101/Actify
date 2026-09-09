// Open Library adapter for Actify — category "Read" (books).
//
// Hits Open Library's public search API with one rotated subject per call
// (fiction / science / history / self-help) so successive calls surface
// variety. Estimates minutes from page count (40 pages / hour), or falls
// back to a flexible 60-minute default when the count is missing.
//
// Wraps every fetch in try/catch and returns [] on any failure.

const OPEN_LIBRARY_BASE = 'https://openlibrary.org/search.json';
const COVER_BASE = 'https://covers.openlibrary.org/b/id';
const SUBJECTS = ['fiction', 'science', 'history', 'self_help'];
const DEFAULT_MINUTES = 60;
const OL_CANDIDATE_LIMIT = 15; // page boundary varies; over-fetch then filter

function estimateMinutes(doc) {
  // Open Library exposes several page-count fields depending on the work.
  // number_of_pages_median is the most reliable when present.
  const pages =
    doc.number_of_pages_median ||
    (Array.isArray(doc.pagination) ? parseInt(doc.pagination[0], 10) : null) ||
    doc.pagination ||
    null;
  if (pages && Number.isFinite(pages) && pages > 0) {
    return Math.max(1, Math.round((pages / 40) * 60));
  }
  return DEFAULT_MINUTES;
}

function pickSubject() {
  return SUBJECTS[Math.floor(Math.random() * SUBJECTS.length)];
}

async function search(freeMinutes) {
  try {
    const subject = pickSubject();
    const url = new URL(OPEN_LIBRARY_BASE);
    url.searchParams.set('subject', subject);
    url.searchParams.set('limit', String(OL_CANDIDATE_LIMIT));
    url.searchParams.set('fields', 'key,title,cover_i,number_of_pages_median,pagination,subject');

    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const data = await res.json();
    const docs = Array.isArray(data.docs) ? data.docs : [];

    const results = [];
    for (const doc of docs) {
      if (!doc.key || !doc.title) continue;
      const minutes = estimateMinutes(doc);
      if (minutes > freeMinutes) continue;

      const hasPages =
        doc.number_of_pages_median ||
        doc.pagination;
      results.push({
        id: `ol-${doc.key}`,
        title: doc.title,
        category: 'Read',
        minutes,
        source: 'openlibrary',
        reason: hasPages ? `~${minutes} min read` : 'flexible read',
        thumbnail: doc.cover_i ? `${COVER_BASE}/${doc.cover_i}-M.jpg` : null,
        sourceUrl: `https://openlibrary.org${doc.key}`,
        tags: ['reading'],
      });
      if (results.length >= 5) break;
    }
    return results;
  } catch (e) {
    console.error('Open Library adapter failed:', e);
    return [];
  }
}

window.OpenLibraryAdapter = { search };
