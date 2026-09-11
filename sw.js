/* Twyn service worker — cache + web push (iOS + Android) */
const CACHE = "twyn-v42-reels-video";

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

  const url = req.url || "";
  if (
    url.includes("supabase.co") ||
    url.includes("/rest/") ||
    url.includes("/auth/") ||
    url.includes("/functions/") ||
    url.includes("/storage/")
  ) {
    return;
  }

  // App shell (js/css/html) = network first so updates land
  const isAppShell =
    url.includes("/script.js") ||
    url.includes("/style.css") ||
    url.includes("/index.html") ||
    url.endsWith("/script.js") ||
    url.endsWith("/style.css") ||
    req.mode === "navigate";

  event.respondWith(
    (async () => {
      if (isAppShell) {
        try {
          const res = await fetch(req);
          if (res && res.ok) {
            try {
              const copy = res.clone();
              const c = await caches.open(CACHE);
              await c.put(req, copy);
            } catch (_) {}
          }
          return res;
        } catch {
          const cached = await caches.match(req);
          return cached || caches.match("./index.html");
        }
      }

      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res && res.ok && url.startsWith(self.location.origin)) {
          try {
            const copy = res.clone();
            const c = await caches.open(CACHE);
            await c.put(req, copy);
          } catch (_) {}
        }
        return res;
      } catch {
        return caches.match("./index.html");
      }
    })()
  );
});

self.addEventListener("push", (event) => {
  let data = {
    title: "Twyn",
    body: "You have a new notification",
    url: "./",
    tag: "twyn-notif"
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
      vibrate: [160, 80, 160],
      renotify: true,
      requireInteraction: false,
      tag: data.tag || "twyn-notif"
    })
  );
});

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
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
