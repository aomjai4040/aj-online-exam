// AJ Exam Online - Service Worker (network-first, safe for auth & exam data)
// Version: 1.0.0

const CACHE_NAME = "aj-exam-shell-v1";

// Only cache these static shell assets — never cache API/auth/exam routes
const PRECACHE_URLS = ["/", "/login"];

// Routes that must NEVER be served from cache
const NO_CACHE_PATTERNS = [
  /\/api\//,
  /\/exam\//,
  /\/result\//,
  /\/activate/,
  /\/admin/,
  /__nextjs/,
  /firestore\.googleapis\.com/,
  /identitytoolkit\.googleapis\.com/,
  /securetoken\.googleapis\.com/,
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests
  if (request.method !== "GET" || url.origin !== location.origin) return;

  // Always go to network for sensitive routes
  const neverCache = NO_CACHE_PATTERNS.some((p) => p.test(url.pathname + url.search));
  if (neverCache) return; // browser default fetch

  // Network-first for everything else
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Only cache successful same-origin navigation responses
        if (response.ok && response.type === "basic") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request)) // offline fallback
  );
});
