// Web Push 受信ハンドラ(vite-plugin-pwa の importScripts で SW に組み込まれる)
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: "踊り子ナビ", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "お知らせ", {
      body: data.body || "",
      icon: "/odoriko-navi/icons/icon-192.png",
      badge: "/odoriko-navi/icons/icon-192.png",
      data: { url: data.url || "/odoriko-navi/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) ||
    "/odoriko-navi/";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if ("focus" in client) return client.focus();
        }
        return clients.openWindow(url);
      }),
  );
});
