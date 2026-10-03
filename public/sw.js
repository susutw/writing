// 開啟頁面時一律向伺服器確認是否有新版本（GitHub Pages 預設讓頁面快取 10 分鐘），
// 讓新文章發布後馬上看得到。其他資源（圖片、CSS）照常使用快取。
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request, { cache: 'no-cache' }));
  }
});
