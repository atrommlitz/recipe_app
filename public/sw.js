/*
 * Shell caching only.
 *
 * Recipe pages are rendered per-request behind auth, so they are deliberately
 * never cached — a cached HTML page would keep showing after sign-out. What we
 * do cache is the immutable build output and icons, which is what makes a
 * relaunch from the home screen feel instant.
 */

const CACHE = "index-shell-v1"
const OFFLINE_URL = "/offline.html"

const CACHEABLE_PREFIXES = ["/_next/static/", "/icons/"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL]))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Navigations: always hit the network so auth and data stay correct.
  // Fall back to a static offline page only when the network is gone.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(OFFLINE_URL)
        return cached ?? Response.error()
      }),
    )
    return
  }

  // Immutable build assets and icons: cache-first.
  if (CACHEABLE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        })
      }),
    )
  }
})
