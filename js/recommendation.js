// Recommendation engine for Actify.
//
// Picks top-3 activity suggestions from window.GENERIC_ACTIVITIES based on:
//   (a) how much free time the user has
//   (b) their current mood
//   (c) their saved interests
//   (d) per-activity moodTags (direct mood match bonus)
//   (e) the last 5 activities they actually did — penalised more heavily
//       to avoid repeating the same category
//   (f) a session-level seenIds set so rejected items never reappear
//
// API-backed adapters use the same getRecommendations(freeMinutes, mood, seenIds)
// interface as the built-in activity dataset.

const MOOD_CATEGORY_FIT = {
  relax:     { GoOut: 0.5, Create: 0.5, Relax: 1,   Social: 0.5, Watch: 1,   Play: 0.5, Read: 1   },
  fun:       { GoOut: 1,   Social: 1,   Create: 0.5, Play: 1,     Watch: 0.5, Relax: 0.5           },
  energetic: { GoOut: 1,   Social: 0.5, Create: 0.5, Play: 0.5                                     },
  learn:     { Create: 1,  Play: 0.5,   Read: 1,     GoOut: 0.5                                     },
  create:    { Create: 1,  Play: 0.5,   GoOut: 0.5                                                  },
  social:    { Social: 1,  GoOut: 0.5,  Watch: 0.5                                                  },
  // Bored users need variety — open up all categories at a base level so
  // interest + moodTag bonuses can actually differentiate picks.
  bored:     { Create: 0.5, GoOut: 0.5, Social: 0.5, Play: 0.5, Watch: 0.5, Relax: 0.5, Read: 0.5 },
  // surprise = flat across all categories; random nudge does the sorting.
  surprise:  { GoOut: 0.5, Create: 0.5, Relax: 0.5, Social: 0.5, Watch: 0.5, Play: 0.5, Read: 0.5 },
};

async function getCurrentUserId() {
  const { data: { user } } = await window.supabaseClient.auth.getUser();
  return user ? user.id : null;
}

// Average rating (1–10) across the item's tags that the user has in their
// interests. Falls back to 5 when no tags overlap. Also returns the single
// tag with the highest matching rating, used to build the reason string.
function computeInterestMatch(item, interests) {
  if (!item.tags || item.tags.length === 0) return { avg: 5, topTag: null };
  const ratings = [];
  let topTag = null;
  let topRating = -Infinity;
  for (const tag of item.tags) {
    const r = interests[tag];
    if (r != null) {
      ratings.push(r);
      if (r > topRating) { topRating = r; topTag = tag; }
    }
  }
  if (ratings.length === 0) return { avg: 5, topTag: null };
  const avg = ratings.reduce((s, x) => s + x, 0) / ratings.length;
  return { avg, topTag };
}

function buildReason(freeMinutes, topTag, mood) {
  if (topTag) return `You have ${freeMinutes} minutes free and enjoy ${topTag}`;
  if (mood && mood !== 'surprise') return `You have ${freeMinutes} minutes free and feel ${mood}`;
  return `You have ${freeMinutes} minutes free`;
}

// Enforce category diversity in the top-N picks.
// Swaps out items to ensure no single category takes more than `maxPerCat`
// slots, pulling replacements from the scored-but-not-yet-picked remainder.
function diversify(top, remainder, maxPerCat = 1) {
  const catCount = {};
  const result = [];

  for (const entry of top) {
    const cat = entry.item.category;
    catCount[cat] = (catCount[cat] || 0) + 1;
    if (catCount[cat] <= maxPerCat) {
      result.push(entry);
    } else {
      // Find the best remainder item from a category that still has room.
      const swapIdx = remainder.findIndex(r => {
        const c = r.item.category;
        return (catCount[c] || 0) < maxPerCat;
      });
      if (swapIdx !== -1) {
        const swap = remainder.splice(swapIdx, 1)[0];
        catCount[swap.item.category] = (catCount[swap.item.category] || 0) + 1;
        result.push(swap);
      } else {
        // No diverse swap available — keep original to maintain count.
        result.push(entry);
      }
    }
  }
  return result;
}

// seenIds: optional Set of activity IDs already shown/dismissed this session.
async function getRecommendations(freeMinutes, mood, seenIds = new Set()) {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  // ---- Stage 0: fetch user context + adapter results in parallel ----
  const adapterCalls = [
    window.TMDBAdapter       && window.TMDBAdapter.search(freeMinutes),
    window.OpenLibraryAdapter && window.OpenLibraryAdapter.search(freeMinutes),
    window.RAWGAdapter       && window.RAWGAdapter.search(freeMinutes),
    window.ArticlesAdapter   && window.ArticlesAdapter.search(freeMinutes),
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
  if (historyRes.error)   throw historyRes.error;

  const interests = {};
  for (const row of (interestsRes.data || [])) {
    interests[row.tag] = row.rating;
  }
  const recentCategories = (historyRes.data || []).map(r => r.category);

  // Flatten fulfilled adapter results; log rejections but keep going.
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
    // Skip items already shown or dismissed this session.
    if (seenIds.has(item.id)) return false;
    // minutes: null = flexible length (e.g. RAWG games) → always passes time filter.
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
    const { avg: interestMatch, topTag } = computeInterestMatch(item, interests);
    const moodFit      = moodTable[item.category] || 0;
    const recentCount  = recentCategories.filter(c => c === item.category).length;
    // Stronger penalty (×3) so recently-done categories can't dominate
    // even when interest scores are high.
    const repeatPenalty = -3 * recentCount;
    const noveltyBonus  = recentCount === 0 ? 1 : 0;

    // Per-activity moodTag bonus: if this specific activity lists the
    // current mood in its moodTags, add 1.5 — rewarding precision matches
    // over category-level mood fit alone.
    const moodTagBonus = (
      mood &&
      Array.isArray(item.moodTags) &&
      item.moodTags.includes(mood)
    ) ? 1.5 : 0;

    let score = interestMatch * 2.5  // slightly reduced weight so other signals matter
              + moodFit * 2
              + moodTagBonus
              + noveltyBonus
              + repeatPenalty
              // Tiny universal jitter breaks deterministic ties so the same
              // top-3 doesn't appear every single time.
              + Math.random() * 0.2;

    // Surprise mood: larger random nudge on top of the jitter.
    if (mood === 'surprise') score += Math.random() * 0.5;

    return { item, score, topTag };
  });

  // ---- Stage C: sort + category diversity in the final 3 ----
  scored.sort((a, b) => b.score - a.score);

  const top3     = scored.slice(0, 3);
  const remainder = scored.slice(3);

  // Enforce max 1 item per category across the 3 picks when the pool is
  // large enough. Falls back gracefully when options are limited.
  const diversified = filtered.length > 5
    ? diversify(top3, remainder, 1)
    : top3;

  return diversified.map(({ item, topTag }) => ({
    id:        item.id,
    title:     item.title,
    category:  item.category,
    minutes:   item.minutes,  // may be null for games — UI should handle gracefully
    source:    item.source || 'generic',
    reason:    item.reason || buildReason(freeMinutes, topTag, mood),
    thumbnail: item.thumbnail || null,
    sourceUrl: item.sourceUrl || null,
    topTag,
  }));
}

window.getRecommendations = getRecommendations;
