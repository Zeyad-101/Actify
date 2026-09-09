// Task CRUD for Actify.
// Same pattern as js/schedule.js: getCurrentUserId() is fetched inside each
// function so they are self-contained. No UI in this file — home.js will
// render the list.

async function getCurrentUserId() {
  const { data: { user } } = await window.supabaseClient.auth.getUser();
  return user ? user.id : null;
}

async function addTask(title) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('not authenticated');
  const cleanTitle = String(title || '').trim();
  if (!cleanTitle) throw new Error('title is required');
  const { data, error } = await window.supabaseClient
    .from('tasks')
    .insert({ user_id: userId, title: cleanTitle, done: false })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function toggleTask(id) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('not authenticated');
  // Fetch current state, then flip.
  const { data: existing, error: fetchErr } = await window.supabaseClient
    .from('tasks')
    .select('done')
    .eq('id', id)
    .eq('user_id', userId)
    .single();
  if (fetchErr) throw fetchErr;
  if (!existing) throw new Error('task not found');

  const { data, error } = await window.supabaseClient
    .from('tasks')
    .update({ done: !existing.done })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteTask(id) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('not authenticated');
  const { error } = await window.supabaseClient
    .from('tasks')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

async function getAllTasks() {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const { data, error } = await window.supabaseClient
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('done', { ascending: true })        // false (0) before true (1) — incomplete first
    .order('created_at', { ascending: false }); // newest first within each group
  if (error) throw error;
  return data || [];
}

window.addTask = addTask;
window.toggleTask = toggleTask;
window.deleteTask = deleteTask;
window.getAllTasks = getAllTasks;
