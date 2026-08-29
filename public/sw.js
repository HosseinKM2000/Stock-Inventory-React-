const CACHE_NAME = "tanzim-shell-v6";
const APP_SHELL = [
  "/",
  "/index.html",
  "/favicon.svg",
  "/pwa-icon-192.png",
  "/pwa-icon-512.png",
  "/manifest.webmanifest",
];

async function precacheApplication() {
  const cache = await caches.open(CACHE_NAME);

  await cache.addAll(APP_SHELL);

  try {
    const response = await fetch("/.vite/manifest.json", { cache: "no-store" });

    if (!response.ok) return;

    const manifest = await response.json();
    const assets = new Set();

    for (const entry of Object.values(manifest)) {
      for (const file of [entry.file, ...(entry.css || []), ...(entry.assets || [])]) {
        if (file) assets.add(`/${file}`);
      }
    }

    await cache.addAll([...assets]);
  } catch {
    // The shell remains usable even on hosts that do not expose Vite's
    // manifest. Assets used online are still cached by the fetch handler.
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheApplication());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                (key.startsWith("inventory-shell-") ||
                  key.startsWith("tanzim-shell-")) &&
                key !== CACHE_NAME,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/uploads/")
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        return (await caches.match("/index.html")) || Response.error();
      }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(async (cached) => {
      if (cached) return cached;

      const response = await fetch(request);

      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }

      return response;
    }),
  );
});

self.addEventListener("sync", (event) => {
  if (event.tag !== "inventory-sync") return;

  // Authentication and the durable outbox live in the page context. Ask every
  // open client to run the same single-flight sync service used by foreground
  // connectivity/focus triggers.
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          client.postMessage({ type: "inventory-sync" });
        }
      }),
  );
});
