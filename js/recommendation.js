// Recommendation engine for Actify.
//
// Picks top-3 activity suggestions from window.GENERIC_ACTIVITIES based on
// (a) how much free time the user has, (b) their current mood, (c) their
// saved interests, and (d) the last 5 activities they actually did — so we
// don't keep suggesting the same category over and over.
//
// API-backed adapters use the same getRecommendations(freeMinutes, mood)
// interface as the built-in activity dataset.

const MOOD_CATEGORY_FIT = {
  // Watch mirrors Relax, Read mirrors Relax, Play mirrors Create.
  relax:     { GoOut: 0.5, Create: 0.5, Relax: 1,   Social: 0.5, Watch: 1, Play: 0.5, Read: 1 },
  fun:       { GoOut: 1,   Social: 1,   Create: 0.5, Play: 0.5 },
  energetic: { GoOut: 1,   Social: 0.5 },
  learn:     { Create: 1, Play: 1 },
  create:    { Create: 1, Play: 1 },
  social:    { Social: 1,  GoOut: 0.5 },
  bored:     { Create: 0.5, GoOut: 0.5, Social: 0.5, Play: 0.5 },
  // 'surprise' = flat 0.5 across all 7 categories; the random nudge below
  // is what actually shakes up the final order for surprise mood.
  surprise:  { GoOut: 0.5, Create: 0.5, Relax: 0.5, Social: 0.5, Watch: 0.5, Play: 0.5, Read: 0.5 },
};

async function getCurrentUserId() {
  const { data: { user } } = await window.supabaseClient.auth.getUser();
  return user ? user.id : null;
}

// Average rating (1–10) across the item's tags that the user actually has
// in their interests. If none overlap, fall back to 5. Also returns the
// single tag with the highest matching rating, used to build the reason.
function computeInterestMatch(item, interests) {
  if (!item.tags || item.tags.length === 0) return { avg: 5, topTag: null };
  const ratings = [];
  let topTag = null;
  let topRating = -Infinity;
  for (const tag of item.tags) {
    const r = interests[tag];
    if (r != null) {
      ratings.push(r);
      if (r > topRating) {
        topRating = r;
        topTag = tag;
      }
    }
  }
  if (ratings.length === 0) return { avg: 5, topTag: null };
  const avg = ratings.reduce((s, x) => s + x, 0) / ratings.length;
  return { avg, topTag };
}

function buildReason(freeMinutes, topTag, mood) {
  if (topTag) {
    return `You have ${freeMinutes} minutes free and enjoy ${topTag}`;
  }
  if (mood && mood !== 'surprise') {
    return `You have ${freeMinutes} minutes free and feel ${mood}`;
  }
  return `You have ${freeMinutes} minutes free`;
}

async function getRecommendations(freeMinutes, mood) {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  // ---- Stage 0: fetch user context + adapter results in parallel ----
  // Adapters go through Promise.allSettled so one failing source (network
  // error, missing API key, rate limit) never breaks the whole call.
  const adapterCalls = [
    window.TMDBAdapter      && window.TMDBAdapter.search(freeMinutes),
    window.OpenLibraryAdapter && window.OpenLibraryAdapter.search(freeMinutes),
    window.RAWGAdapter      && window.RAWGAdapter.search(freeMinutes),
    window.ArticlesAdapter  && window.ArticlesAdapter.search(freeMinutes),
  ].filter(Boolean);

  const [interestsRes, historyRes, adapterSettled] = await Promise.all([
    window.supabaseClient
      .from('interests')
      .select('tag, rating')
      .eq('user_id', userId),
    window.supabaseClient
      .from('history')
      .select('category')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5),
    Promise.allSettled(adapterCalls),
  ]);

  if (interestsRes.error) throw interestsRes.error;
  if (historyRes.error) throw historyRes.error;

  const interests = {};
  for (const row of (interestsRes.data || [])) {
    interests[row.tag] = row.rating;
  }
  const recentCategories = (historyRes.data || []).map(r => r.category);

  // Flatten fulfilled adapter results; log any rejections but keep going.
  const adapterItems = [];
  for (const r of (Array.isArray(adapterSettled) ? adapterSettled : [])) {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      adapterItems.push(...r.value);
    } else if (r.status === 'rejected') {
      console.error('adapter rejected:', r.reason);
    }
  }

  // ---- Stage A: hard filter ----
  // Pool = GENERIC_ACTIVITIES ∪ all fulfilled adapter items.
  const pool = [
    ...(window.GENERIC_ACTIVITIES || []),
    ...adapterItems,
  ];
  const filtered = pool.filter(item => {
    // minutes: null = "flexible length" (e.g. RAWG games) → always passes.
    if (item.minutes != null && item.minutes > freeMinutes) return false;
    if (
      Array.isArray(item.excludedMoods) &&
      mood &&
      item.excludedMoods.includes(mood)
    ) return false;
    return true;
  });

  if (filtered.length === 0) return [];

  // ---- Stage B: score ----
  const moodTable = MOOD_CATEGORY_FIT[mood] || {};
  const scored = filtered.map(item => {
    // Adapters attach a tags array (e.g. ["movies"], ["gaming"], ["reading"])
    // so this lookup works for both generic and real-content items.
    const { avg: interestMatch, topTag } = computeInterestMatch(item, interests);
    const moodFit = moodTable[item.category] || 0;
    const recentCount = recentCategories.filter(c => c === item.category).length;
    const recentRepeatPenalty = -2 * recentCount;
    const noveltyBonus = recentCount === 0 ? 1 : 0;

    let score = interestMatch * 3
              + moodFit * 2
              + noveltyBonus
              + recentRepeatPenalty;

    // Surprise mood: same scoring, but add a small random nudge so the final
    // ordering isn't fully deterministic. Range ≤ 0.5 — can't override a big
    // interest/mood gap, but breaks ties and shuffles close competitors.
    if (mood === 'surprise') score += Math.random() * 0.5;

    return { item, score, topTag };
  });

  // ---- Stage C: sort + category diversity in the final 3 ----
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 3);

  if (top.length === 3) {
    const cats = new Set(top.map(s => s.item.category));
    if (cats.size === 1) {
      // All three top picks share a category — swap the third for the
      // highest-scoring item from a different category if one exists.
      const swap = scored.slice(3).find(s => !cats.has(s.item.category));
      if (swap) top[2] = swap;
    }
  }

  return top.map(({ item, topTag }) => ({
    id: item.id,
    title: item.title,
    category: item.category,
    minutes: item.minutes,
    // Adapter items carry their own reason ("42 min read", "flexible session",
    // "X min film"). Generic items fall back to the mood-based reason builder.
    source: item.source || 'generic',
    reason: item.reason || buildReason(freeMinutes, topTag, mood),
    thumbnail: item.thumbnail || null,
    sourceUrl: item.sourceUrl || null,
    topTag,
  }));
}

window.getRecommendations = getRecommendations;
