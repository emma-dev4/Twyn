/* Twyn service worker — cache + web push */
const CACHE = "twyn-v36";

const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./supabase.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => console.log("SW install cache error:", err))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Don't cache API / Supabase / non-http
  const url = req.url || "";
  if (
    url.includes("supabase") ||
    url.includes("/rest/") ||
    url.includes("/auth/") ||
    url.includes("/functions/")
  ) {
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          // Optional: refresh cache for same-origin assets
          try {
            if (res && res.ok && url.startsWith(self.location.origin)) {
              const copy = res.clone();
              caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
            }
          } catch (_) {}
          return res;
        })
        .catch(() => cached || caches.match("./index.html"));

      // Prefer network for HTML so updates show; cache fallback offline
      if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
        return network;
      }
      return cached || network;
    })
  );
});

/* ========== PUSH ========== */
self.addEventListener("push", (event) => {
  let data = {
    title: "Twyn",
    body: "You have a new notification",
    url: "./"
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch (_) {
    try {
      if (event.data) data.body = event.data.text();
    } catch (_) {}
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Twyn", {
      body: data.body || "",
      icon: "./icons/icon-192.png",
      badge: "./icons/icon-192.png",
      data: { url: data.url || "./" },
      vibrate: [120, 60, 120]
    })
  );
});

/* ========== CLICK NOTIFICATION ========== */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "./";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          if ("navigate" in client) {
            try {
              client.navigate(targetUrl);
            } catch (_) {}
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});