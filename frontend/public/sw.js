const CACHE_NAME = 'crew-v1'
const CACHE_URLS = ['/crew', '/crew/login']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CACHE_URLS)))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  // Only GET requests are cacheable — never intercept status-update PATCHes etc.
  if (e.request.method !== 'GET') return

  // Network-first for crew job data so the field always sees fresh jobs when
  // online, but falls back to the last cached response when offline.
  if (e.request.url.includes('/crew/jobs')) {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone))
          return response
        })
        .catch(() => caches.match(e.request)),
    )
    return
  }

  // Cache-first for the app shell / static assets.
  e.respondWith(caches.match(e.request).then((cached) => cached || fetch(e.request)))
})
