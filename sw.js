// Freedom Ledger offline cache. The app opens from the phone's saved copy at once (no waiting on a
// weak signal) and fetches the newest version in the background for next time.
// Market data (Alpha Vantage, Frankfurter) is never cached here; the app keeps its own copy.
const CACHE = "ledger-20261123102636";
const FONTS = "ledger-fonts";   // kept across app updates so fonts survive with no signal
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png"];
// A hanging request on a weak signal counts as offline after this long.
const timed = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== FONTS).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com" || url.hostname === "cdnjs.cloudflare.com") {
    e.respondWith(caches.open(FONTS).then(c => c.match(e.request).then(hit => hit || timed(fetch(e.request), 3000).then(r => { if (r.ok || r.type === "opaque") c.put(e.request, r.clone()); return r; }))));
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (e.request.mode === "navigate") {
    // Only a real copy of the app replaces the saved one: never a Wi-Fi login page, redirect or error page.
    const fresh = fetch(e.request, { cache: "no-store" }).then(r => {
      if (r.ok && !r.redirected && r.type === "basic") { const copy = r.clone(); return caches.open(CACHE).then(c => c.put("index.html", copy)).then(() => r); }
      return r;
    });
    e.waitUntil(fresh.catch(() => {}));
    e.respondWith(caches.match("index.html").then(hit => hit || fresh));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request)));
});