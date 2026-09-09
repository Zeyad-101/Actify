// Feedback persistence and interest-learning logic for Actify.

const CATEGORY_INTEREST_TAGS = {
  Watch: 'movies',
  Read: 'reading',
  Play: 'gaming',
  Create: 'art',
  Social: 'friends',
  GoOut: 'exploring',
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

  const tag = matchedTag || CATEGORY_INTEREST_TAGS[category];
  if (!tag || feedback === 'good') return null;

  const { data: interest, error: interestError } = await window.supabaseClient
    .from('interests')
    .select('rating')
    .eq('user_id', user.id)
    .eq('tag', tag)
    .maybeSingle();
  if (interestError) throw interestError;
  if (!interest) return null;

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
