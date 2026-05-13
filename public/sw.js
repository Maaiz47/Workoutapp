// IRONLOG Service Worker — handles background notifications

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// Listen for messages from the app to show notifications
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "REST_DONE") {
    self.registration.showNotification("IRONLOG", {
      body: "Rest over — time for your next set 💪",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "ironlog-rest",
      requireInteraction: false,
      vibrate: [200, 100, 200],
    });
  }
});

// Handle notification click — focus the app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow("/");
    })
  );
});
