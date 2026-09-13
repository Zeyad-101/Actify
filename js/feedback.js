// Feedback persistence and interest-learning logic for Actify.

// Maps activity categories to their canonical interest tag.
// Watch and Play must be listed here so that loving/disliking a movie
// or game actually updates the interest score — previously these were
// missing, which silently dropped all Watch/Play rating adjustments.
const CATEGORY_INTEREST_TAGS = {
  Watch:  'movies',
  Read:   'reading',
  Play:   'gaming',
  Create: 'art',
  Social: 'friends',
  GoOut:  'exploring',
  Relax:  'relaxing',
};

async function submitFeedback(
  activityId,
  category,
  mood,
  feedback,
  rejectionReason = null,
  matchedTag = null,
) {
  const { data: { user } } = await window.supabaseClient.auth.getUser();
  if (!user) throw new Error('not authenticated');

  const { error: historyError } = await window.supabaseClient
    .from('history')
    .insert({
      user_id: user.id,
      activity_id: activityId,
      category,
      mood,
      feedback,
      rejection_reason: rejectionReason,
    });
  if (historyError) throw historyError;

  // Determine which interest tag to adjust.
  // matchedTag (from recommendation scoring) takes precedence; fall back to
  // the category-level default. If neither exists, there's nothing to update.
  const tag = matchedTag || CATEGORY_INTEREST_TAGS[category];

  // Only 'loved' and 'meh' adjust the interest rating.
  // 'good' is neutral; 'no' is logged via rejectionReason above.
  if (!tag || feedback === 'good' || feedback === 'no') return null;

  const { data: interest, error: interestError } = await window.supabaseClient
    .from('interests')
    .select('rating')
    .eq('user_id', user.id)
    .eq('tag', tag)
    .maybeSingle();
  if (interestError) throw interestError;

  if (!interest) {
    // Tag not yet in the user's interests — insert it with a starting rating.
    const startRating = feedback === 'loved' ? 6 : 4;
    const { error: insertError } = await window.supabaseClient
      .from('interests')
      .insert({ user_id: user.id, tag, rating: startRating });
    if (insertError) throw insertError;
    return startRating;
  }

  const adjustment = feedback === 'loved' ? 1 : -1;
  const rating = Math.max(1, Math.min(10, interest.rating + adjustment));
  const { error: updateError } = await window.supabaseClient
    .from('interests')
    .update({ rating })
    .eq('user_id', user.id)
    .eq('tag', tag);
  if (updateError) throw updateError;

  return rating;
}

window.submitFeedback = submitFeedback;
