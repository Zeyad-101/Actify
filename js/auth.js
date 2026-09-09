// Auth helpers for the Actify site.
// Depends on js/supabaseClient.js being loaded first so window.supabaseClient exists.

async function signInWithGoogle() {
  const { error } = await window.supabaseClient.auth.signInWithOAuth({
    provider: 'google',
  });
  if (error) {
    console.error('Google sign-in error:', error);
    alert('Sign in failed: ' + error.message);
  }
}

async function signOut() {
  await window.supabaseClient.auth.signOut();
  window.location.href = 'login.html';
}

async function requireAuth() {
  const { data: { session } } = await window.supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }
  return session.user;
}

async function isFirstLogin(userId) {
  const { data, error } = await window.supabaseClient
    .from('profiles')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('isFirstLogin error:', error);
    return false;
  }
  // maybeSingle returns null when no row matches.
  return data === null;
}
