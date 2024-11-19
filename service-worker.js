const CACHE_NAME = "chat-app-cache-v1";
const urlsToCache = [
  "/",
  "/index.html",
  "/index.js",
  "/style.css",
  "/manifest.json",
];

// インストール時にキャッシュを行う
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

// リクエストをキャッシュから取得する
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response; // キャッシュからのレスポンス
      }
      return fetch(event.request); // ネットワークからのレスポンス
    })
  );
});

// サービスワーカーの更新時にキャッシュをクリアする
self.addEventListener("activate", (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
