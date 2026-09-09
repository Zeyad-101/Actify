const CACHE_NAME = 'actify-shell-v3';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/onboarding.html',
  '/404.html',
  '/favicon.png',
  '/js/supabaseClient.js',
  '/js/auth.js',
  '/js/character.js',
  '/js/tasks.js',
  '/js/activities.js',
  '/js/freeTime.js',
  '/js/schedule.js',
  '/js/recommendation.js',
  '/js/feedback.js',
  '/js/home.js',
  '/js/installPrompt.js',
  '/js/onboarding.js',
  '/js/calendar.js',
  '/js/adapters/tmdb.js',
  '/js/adapters/openLibrary.js',
  '/js/adapters/rawg.js',
  '/js/adapters/articles.js',
  '/js/adapters/overpass.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];
const NETWORK_ONLY_HOSTS = [
  'supabase.co',
  'themoviedb.org',
  'rawg.io',
  'openlibrary.org',
  'dev.to',
  'algolia.com',
  'hn.algolia.com',
  'overpass-api.de',
  'googleapis.com',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS)));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys
        .filter(name => name !== CACHE_NAME)
        .map(name => caches.delete(name))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || NETWORK_ONLY_HOSTS.some(host => url.hostname.endsWith(host))) {
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request))
  );
});
