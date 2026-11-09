// 慢递局 Service Worker
// 只负责来信推送通知；不缓存任何页面/资源，避免破坏动态页。

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", () => {
  self.clients.claim();
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    /* 数据不可解析时按空处理 */
  }
  const title = data.title || "慢递局";
  const options = {
    body: data.body || "",
    icon: data.icon || "/assets/logo/A0.png",
    badge: data.badge || "/assets/logo/A0.png",
    data: { link: data.link || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link =
    (event.notification.data && event.notification.data.link) || "/";
  event.waitUntil(self.clients.openWindow(link));
});
