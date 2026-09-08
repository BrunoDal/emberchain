const VERSION = "v12";
const SHELL_CACHE = `emberchain-shell-${VERSION}`;
const RUNTIME_CACHE = `emberchain-runtime-${VERSION}`;
const scopeUrl = new URL("./", self.registration.scope);
const withinScope = (url) => url.origin === scopeUrl.origin && url.href.startsWith(scopeUrl.href);
const appUrl = (path) => new URL(path, scopeUrl).href;
const shell = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg", "./assets/ember-knight.png", "./assets/forge-arena-v2.png", "./assets/goblin-raider-v2.png", "./assets/enemy-roster-v1.png", "./assets/cards-fire-atlas.png", "./assets/cards-attack-atlas.png", "./assets/cards-support-atlas.png", "./assets/cards-equipment-atlas.png"];

const precacheGeneratedAssets = async (cache) => {
  const indexUrl = appUrl("./index.html");
  const response = await fetch(indexUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`Unable to precache ${indexUrl}`);

  const indexHtml = await response.text();
  await cache.put(indexUrl, new Response(indexHtml, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  }));

  const assetUrls = [...indexHtml.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map((match) => new URL(match[1], indexUrl))
    .filter((url) => withinScope(url))
    .map((url) => url.href);

  await cache.addAll([...new Set(assetUrls)]);
};

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await cache.addAll(shell.map(appUrl));
    await precacheGeneratedAssets(cache);
  })());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("emberchain-") && ![SHELL_CACHE, RUNTIME_CACHE].includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || !withinScope(new URL(request.url))) return;

  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreVary: true });

    if (request.mode === "navigate") {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const copy = response.clone();
          void caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      } catch {
        return cached || caches.match(appUrl("./index.html"));
      }
    }

    if (cached) return cached;

    try {
      const response = await fetch(request);
      if (response.ok) {
        const copy = response.clone();
        void caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
      }
      return response;
    } catch {
      return Response.error();
    }
  })());
});
