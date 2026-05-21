// IRONLOG Service Worker — handles background notifications

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// Handle incoming push notifications
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // If the app tab is in focus, let the page handle it (soft beep / tab flash)
      const focused = clients.find((c) => c.focused);
      if (focused) {
        focused.postMessage({ type: "NEW_MESSAGE_PUSH", from: data.title, body: data.body });
        return;
      }
      // App not visible — show the banner notification as normal
      return self.registration.showNotification(data.title ?? "IRONLOG", {
        body: data.body ?? "New message",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: "ironlog-message",
        renotify: true,
        data: { url: data.url ?? "/" },
      });
    })
  );
});

// Listen for messages from the app to show notifications
self.addEventListener("message", (event) => {
  // App requested an immediate SW activation (used by the "Check for
  // updates" → Refresh Now flow so the next page load uses the new bundle).
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
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
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
