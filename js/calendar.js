// Read-only Google Calendar import for Actify.
//
// Independent from the Supabase Google login — this uses its own OAuth
// consent (Google Identity Services, token-client flow) for the
// calendar.readonly scope. Access tokens live in module memory only and
// are lost on page refresh; the connected flag in google_calendar_tokens
// is purely a "has the user connected before?" hint so the home page can
// render the right button without forcing a fresh OAuth popup just to
// render the page.
//
// Output shape from getTodayCalendarBusyBlocks matches freeTime.js's
// extraBusyBlocks: [{ start: "HH:MM", end: "HH:MM" }].

const CALENDAR_CLIENT_ID =
  '678683499323-r8cqguts1mt2eqdpburvh6uv6d78ba9o.apps.googleusercontent.com';
const CALENDAR_SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';
const GIS_SRC = 'https://accounts.google.com/gsi/client';
const CALENDAR_EVENTS_URL =
  'https://www.googleapis.com/calendar/v3/calendars/primary/events';

// In-memory access token. Cleared on page refresh; never persisted.
let inMemoryToken = null; // { accessToken: string, expiresAt: number (ms epoch) }

// Lazy-load the GIS script the first time we need it.
let gisLoadPromise = null;
function ensureGISLoaded() {
  if (
    typeof google !== 'undefined' &&
    google.accounts &&
    google.accounts.oauth2
  ) {
    return Promise.resolve();
  }
  if (gisLoadPromise) return gisLoadPromise;
  gisLoadPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () =>
      reject(new Error('failed to load Google Identity Services'));
    document.head.appendChild(s);
  });
  return gisLoadPromise;
}

async function getCurrentUserId() {
  const { data: { user } } = await window.supabaseClient.auth.getUser();
  return user ? user.id : null;
}

function hasValidInMemoryToken() {
  return !!(inMemoryToken && inMemoryToken.expiresAt > Date.now());
}

// ---- Public: connect ----
// Triggers a Google OAuth popup for calendar.readonly, stores the access
// token in memory for this session, and persists only the connected:true
// flag in google_calendar_tokens so the UI can show "Connected ✓" later.
async function connectGoogleCalendar() {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('not authenticated');

  await ensureGISLoaded();
  if (
    typeof google === 'undefined' ||
    !google.accounts ||
    !google.accounts.oauth2
  ) {
    throw new Error('Google Identity Services not available');
  }

  // GIS invokes callback (success) or error_callback (popup closed /
  // access denied / etc). Either path settles the promise once.
  const settled = { done: false };
  await new Promise((resolve, reject) => {
    let client;
    try {
      client = google.accounts.oauth2.initTokenClient({
        client_id: CALENDAR_CLIENT_ID,
        scope: CALENDAR_SCOPES,
        callback: (response) => {
          if (settled.done) return;
          settled.done = true;
          if (response.error) {
            reject(new Error(response.error));
            return;
          }
          if (!response.access_token) {
            reject(new Error('no access_token in GIS response'));
            return;
          }
          const expiresIn =
            typeof response.expires_in === 'number' && response.expires_in > 0
              ? response.expires_in
              : 3600;
          inMemoryToken = {
            accessToken: response.access_token,
            // 60s safety margin so we don't try to use a token that's
            // about to expire mid-request.
            expiresAt: Date.now() + (expiresIn - 60) * 1000,
          };
          resolve();
        },
        error_callback: (err) => {
          if (settled.done) return;
          settled.done = true;
          const msg =
            err && (err.message || err.type)
              ? err.message || err.type
              : 'OAuth failed';
          reject(new Error(msg));
        },
      });
    } catch (e) {
      if (!settled.done) {
        settled.done = true;
        reject(e);
      }
      return;
    }
    client.requestAccessToken();
  });

  // Persist the connected flag only — no refresh token on a static-site
  // token flow, and the access token itself lives in memory only.
  const { error } = await window.supabaseClient
    .from('google_calendar_tokens')
    .upsert(
      { user_id: userId, connected: true },
      { onConflict: 'user_id' }
    );
  if (error) throw error;

  return { connected: true, hasToken: true };
}

// ---- Public: fetch today's busy blocks ----
// Returns [] if no in-memory token (caller should prompt to reconnect).
// All-day events (those with a 'date' field instead of 'dateTime') are
// skipped. Output is in the same shape freeTime.js expects as
// extraBusyBlocks: [{ start: "HH:MM", end: "HH:MM" }].
async function getTodayCalendarBusyBlocks() {
  if (!hasValidInMemoryToken()) return [];

  const now = new Date();
  const start = new Date(
    now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0
  );
  const end = new Date(
    now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59
  );

  const url = new URL(CALENDAR_EVENTS_URL);
  url.searchParams.set('timeMin', start.toISOString());
  url.searchParams.set('timeMax', end.toISOString());
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');

  let res;
  try {
    res = await fetch(url.toString(), {
      headers: { Authorization: 'Bearer ' + inMemoryToken.accessToken },
    });
  } catch (e) {
    throw new Error(
      'calendar fetch failed: ' +
        (e && e.message ? e.message : 'network error')
    );
  }

  if (!res.ok) {
    // 401 = token revoked/expired; clear it so the UI knows to reconnect.
    if (res.status === 401) inMemoryToken = null;
    const body = await res.text().catch(() => '');
    throw new Error('Calendar API ' + res.status + ': ' + body.slice(0, 200));
  }

  const json = await res.json();
  const items = Array.isArray(json.items) ? json.items : [];
  const blocks = [];
  for (const ev of items) {
    if (!ev.start || !ev.end) continue;
    // All-day events: start/end are { date: "YYYY-MM-DD" }, not dateTime.
    if (ev.start.date || ev.end.date) continue;
    const s = isoToHHMM(ev.start.dateTime);
    const e = isoToHHMM(ev.end.dateTime);
    if (s && e) blocks.push({ start: s, end: e });
  }
  return blocks;
}

function isoToHHMM(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return (
    String(d.getHours()).padStart(2, '0') +
    ':' +
    String(d.getMinutes()).padStart(2, '0')
  );
}

window.connectGoogleCalendar = connectGoogleCalendar;
window.getTodayCalendarBusyBlocks = getTodayCalendarBusyBlocks;

// ---- UI wiring (home page) ----
(async function () {
  if (!document.getElementById('calConnectBtn')) return;

  const user = await requireAuth();
  if (!user) return;

  const btn = document.getElementById('calConnectBtn');
  const status = document.getElementById('calStatus');

  function setUI(state) {
    if (state.connected && state.hasToken) {
      btn.textContent = 'Connected ✓';
      btn.disabled = true;
      btn.classList.add('connected');
      status.textContent =
        'your busy times are synced for this session';
    } else if (state.connected && !state.hasToken) {
      btn.textContent = 'Reconnect';
      btn.disabled = false;
      btn.classList.remove('connected');
      status.textContent =
        'previously connected — reconnect to fetch events this session';
    } else {
      btn.textContent = 'connect google calendar';
      btn.disabled = false;
      btn.classList.remove('connected');
      status.textContent = "read-only sync of today's busy blocks";
    }
  }

  btn.addEventListener('click', async () => {
    const originalLabel = btn.textContent;
    btn.disabled = true;
    status.textContent = 'waiting for Google…';
    try {
      await connectGoogleCalendar();
      // Re-read so the UI reflects the post-connect truth (in-memory
      // token + DB flag), not just the function's return value.
      const inMemory = hasValidInMemoryToken();
      setUI({ connected: true, hasToken: inMemory });
    } catch (err) {
      console.error(err);
      status.textContent =
        'connection failed: ' +
        (err && err.message ? err.message : 'unknown error');
      btn.textContent = originalLabel;
      btn.disabled = false;
    }
  });

  // Initial paint: read the DB flag and check the in-memory token.
  // We can't read the DB from inside this file without a second query;
  // use a tiny inline read so the IIFE is self-contained.
  const inMemory = hasValidInMemoryToken();
  const userId = await getCurrentUserId();
  let connectedFlag = false;
  if (userId) {
    const { data } = await window.supabaseClient
      .from('google_calendar_tokens')
      .select('connected')
      .eq('user_id', userId)
      .maybeSingle();
    connectedFlag = !!(data && data.connected);
  }
  setUI({ connected: connectedFlag, hasToken: inMemory });
})();
