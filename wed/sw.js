'use strict';
// Service worker: lưu giao diện app trong máy để mở được khi không có mạng.
// Nhạc KHÔNG nằm ở đây, nhạc nằm trong IndexedDB của app.
const CACHE = 'nhac-v1';
const SHELL = ['./', 'style.css', 'app.js', 'config.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Lấy từ bộ nhớ trước cho nhanh, đồng thời cập nhật ngầm từ mạng cho lần mở sau.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase và các trang khác: để trình duyệt tự xử lý

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    const update = fetch(req).then(res => {
      if (res && res.ok && !res.redirected && res.type === 'basic') cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (cached) { e.waitUntil(update); return cached; }
    const res = await update;
    if (res) return res;
    if (req.mode === 'navigate') { const home = await cache.match('./'); if (home) return home; }
    return new Response('Đang ngoại tuyến', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  })());
});
