// The seller's notifications, and nothing else: no caching, no fetch handling,
// so the site behaves exactly as it does without it. Registered only from the
// admin notifications page.

self.addEventListener("push", (event) => {
  let alert = { title: "Kunji", body: "", url: "/admin" };
  try {
    alert = { ...alert, ...event.data.json() };
  } catch {
    // An unreadable payload still says something happened.
  }
  event.waitUntil(
    self.registration.showNotification(alert.title, {
      body: alert.body,
      data: { url: alert.url },
      icon: "/favicon.ico",
    }),
  );
});

// Opens the queue, reusing a tab already on this site. Only ever a page on
// this site, whatever the payload says.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  let target = new URL("/admin", self.location.origin);
  try {
    const url = new URL(event.notification.data?.url ?? "/admin", self.location.origin);
    if (url.origin === self.location.origin) target = url;
  } catch {
    // Keep the queue.
  }
  event.waitUntil(
    (async () => {
      const tabs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const tab = tabs.find((t) => new URL(t.url).origin === target.origin);
      // navigate() only works on a tab this worker controls (one under
      // /admin/); any other tab is left alone and a new one opens.
      const moved = tab ? await tab.navigate(target.href).catch(() => null) : null;
      if (moved) await moved.focus();
      else await self.clients.openWindow(target.href);
    })(),
  );
});
