const CACHE_NAME = "tanzim-app-v9";
const OWNED_CACHE_PREFIXES = ["tanzim-", "inventory-shell-"];
const scopeUrl = new URL(self.registration.scope);
const scoped = (path) => new URL(path, scopeUrl).toString();
const READY_MARKER = scoped(".__offline-ready-v9");
const APP_SHELL = [
  "./",
  "index.html",
  "favicon.svg",
  "pwa-icon-192.png",
  "pwa-icon-512.png",
  "pwa-icon-maskable-192.png",
  "pwa-icon-maskable-512.png",
  "apple-touch-icon.png",
  "manifest.webmanifest",
].map(scoped);

async function manifestAssets() {
  const response = await fetch(scoped(".vite/manifest.json"), {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Vite manifest is unavailable");

  const manifest = await response.json();
  const assets = new Set();
  for (const entry of Object.values(manifest)) {
    for (const file of [entry.file, ...(entry.css || []), ...(entry.assets || [])]) {
      if (file) assets.add(scoped(file));
    }
  }
  if (assets.size === 0) throw new Error("Vite manifest has no application assets");
  return [...assets];
}

async function precacheApplication() {
  const cache = await caches.open(CACHE_NAME);
  const resources = [...APP_SHELL, ...(await manifestAssets())];

  // Installation is all-or-nothing. Activating a shell whose hashed route
  // chunks are missing would make offline deep links fail with a blank page.
  await cache.addAll(resources);
  await cache.put(
    READY_MARKER,
    new Response(JSON.stringify({ cache: CACHE_NAME, resources: resources.length }), {
      headers: { "content-type": "application/json" },
    }),
  );
}

async function isOfflineReady() {
  const cache = await caches.open(CACHE_NAME);
  return Boolean(await cache.match(READY_MARKER));
}

self.addEventListener("install", (event) => {
  // An update remains waiting until an open client explicitly accepts it.
  event.waitUntil(precacheApplication());
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
                OWNED_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)) &&
                key !== CACHE_NAME,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim())
      .then(async () => {
        if (!(await isOfflineReady())) return;
        const clients = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        for (const client of clients) {
          client.postMessage({ type: "tanzim-offline-ready" });
        }
      }),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "tanzim-activate-update") {
    void self.skipWaiting();
    return;
  }

  if (event.data?.type === "tanzim-check-offline-ready") {
    event.waitUntil(
      isOfflineReady().then((ready) => {
        if (ready) event.source?.postMessage({ type: "tanzim-offline-ready" });
      }),
    );
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  const scopePath = scopeUrl.pathname.endsWith("/")
    ? scopeUrl.pathname
    : `${scopeUrl.pathname}/`;
  const inScope = url.pathname.startsWith(scopePath);
  const relativePath = inScope ? url.pathname.slice(scopePath.length) : "";

  if (
    request.method !== "GET" ||
    url.origin !== scopeUrl.origin ||
    !inScope ||
    relativePath.startsWith("api/") ||
    relativePath.startsWith("uploads/")
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        return (await caches.match(scoped("index.html"))) || Response.error();
      }),
    );
    return;
  }

  event.respondWith(
    // Vite preview and some CDNs add `Vary: Origin` to static files. Install
    // requests and module requests carry different Origin headers even though
    // the URL and public response are identical. These are same-origin,
    // non-API assets, so ignoring Vary prevents false offline cache misses.
    caches.match(request, { ignoreVary: true }).then(async (cached) => {
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

  // Credentials and the durable outbox live in the page context. Background
  // Sync is only a wake-up hint; it does not promise closed-app synchronization.
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
