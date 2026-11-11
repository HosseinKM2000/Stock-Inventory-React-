const BUILD_ID = "tz-v1-05a-commit-b";
const CACHE_NAME = `tanzim-app-${BUILD_ID}`;
const OWNED_CACHE_PREFIX = "tanzim-app-";
const clientBuilds = new Map();
const scopeUrl = new URL(self.registration.scope);
const scoped = (path) => new URL(path, scopeUrl).toString();
const READY_MARKER = scoped(`.__offline-ready-${BUILD_ID}`);
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
  "app-release.json",
  "fonts/vazirmatn/Vazirmatn-Variable.woff2",
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

async function notifyClients(message) {
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of clients) client.postMessage(message);
}

async function cleanupObsoleteCachesIfSafe() {
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  if (clients.some((client) => clientBuilds.get(client.id) !== BUILD_ID)) return false;
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((key) => key.startsWith(OWNED_CACHE_PREFIX) && key !== CACHE_NAME)
      .map((key) => caches.delete(key)),
  );
  return true;
}

self.addEventListener("install", (event) => {
  // An update remains waiting until an open client explicitly accepts it.
  event.waitUntil(precacheApplication());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    self.clients.claim()
      .then(async () => {
        if (!(await isOfflineReady())) return;
        await notifyClients({ type: "tanzim-update-activated", buildId: BUILD_ID });
        await notifyClients({ type: "tanzim-offline-ready", buildId: BUILD_ID });
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
    return;
  }

  if (event.data?.type === "tanzim-client-build" && event.source?.id) {
    clientBuilds.set(event.source.id, event.data.buildId);
    event.waitUntil(cleanupObsoleteCachesIfSafe());
    return;
  }

  if (event.data?.type === "tanzim-query-build") {
    event.source?.postMessage({
      type: "tanzim-build-status",
      buildId: BUILD_ID,
      ready: true,
    });
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
        const activeCache = await caches.open(CACHE_NAME);
        return (await activeCache.match(scoped("index.html"))) || Response.error();
      }),
    );
    return;
  }

  if (relativePath === "app-release.json") {
    event.respondWith(
      fetch(request, { cache: "no-store" }).catch(async () => {
        const activeCache = await caches.open(CACHE_NAME);
        return activeCache.match(request);
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
