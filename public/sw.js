// MATS Service Worker for Push Notifications, Background Tasks & Keep-Alive

const CACHE_NAME = 'mats-v1';
const CRITICAL_ALERT_TYPES = ['SEISMIC', 'AMBULANCE', 'PANIC', 'SOS', 'SKYALERT'];

const PRECACHE_URLS = [
  '/directorio_emergencias_completo.json',
  '/cruz_roja_directorio_completo.json',
  '/resources_pack.json',
  '/fuentes_otras.json',
];

// ─── Keep-alive for Android PWA background survival ─────────────────────────
let keepAliveInterval = null;

function startKeepAlive() {
  if (keepAliveInterval) return;
  keepAliveInterval = setInterval(() => {
    // Ping all open clients to prevent the browser from freezing them
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ type: 'SW_KEEP_ALIVE_PING', ts: Date.now() });
      });
    });
  }, 20000); // every 20 seconds
  console.log('[SW] Keep-alive started');
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
    console.log('[SW] Keep-alive stopped');
  }
}

// ─── Lifecycle ──────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching directory files');
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Service worker activated');
  event.waitUntil(clients.claim());
});

// ─── Fetch (cache-first for JSON data files) ────────────────────────────────

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (PRECACHE_URLS.some(p => url.pathname === p)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        try {
          const networkResponse = await fetch(event.request);
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        } catch (e) {
          const cached = await cache.match(event.request);
          if (cached) return cached;
          throw e;
        }
      })
    );
  }
});

// ─── Periodic background sync ───────────────────────────────────────────────

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'mats-heartbeat' || event.tag === 'mats-keep-alive') {
    event.waitUntil(sendHeartbeat());
  }
  if (event.tag === 'skyalert-check') {
    event.waitUntil(checkSkyAlert());
  }
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'mats-sync-actions') {
    event.waitUntil(syncOfflineActions());
  }
});

async function sendHeartbeat() {
  try {
    console.log('[SW] Sending background heartbeat');
    // Ping clients to wake them up
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    allClients.forEach((client) => {
      client.postMessage({ type: 'SW_HEARTBEAT', ts: Date.now() });
    });
    return true;
  } catch (e) {
    console.warn('[SW] Heartbeat failed:', e);
  }
}

async function syncOfflineActions() {
  console.log('[SW] Syncing offline actions');
}

async function checkSkyAlert() {
  try {
    console.log('[SW] Background SkyAlert check');
  } catch (e) {
    console.warn('[SW] SkyAlert check failed:', e);
  }
}

// ─── Push notifications ─────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);
  
  let data = {
    title: 'MATS',
    body: 'Tienes una nueva notificación',
    icon: '/icon-192-v2.png',
    badge: '/icon-192-v2.png',
    alertType: 'GENERAL',
  };

  try {
    if (event.data) {
      const payload = event.data.json();
      data = {
        title: payload.title || data.title,
        body: payload.body || data.body,
        icon: payload.icon || data.icon,
        badge: payload.badge || data.badge,
        tag: payload.tag,
        data: payload.data,
        alertType: payload.alertType || 'GENERAL',
      };
    }
  } catch (e) {
    console.error('[SW] Error parsing push data:', e);
  }

  const isCritical = CRITICAL_ALERT_TYPES.includes(data.alertType);

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag || 'mats-notification',
    requireInteraction: isCritical,
    renotify: isCritical,
    silent: false,
    vibrate: isCritical 
      ? [500, 200, 500, 200, 500]
      : [200, 100, 200],
    data: { ...data.data, alertType: data.alertType },
    actions: isCritical ? [
      { action: 'view', title: 'Ver ahora' },
      { action: 'dismiss', title: 'Cerrar' },
    ] : [],
  };

  if (data.alertType === 'SEISMIC') {
    options.urgency = 'critical';
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ─── Notification click ─────────────────────────────────────────────────────

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);
  event.notification.close();

  const data = event.notification.data || {};
  let targetUrl = '/';

  if (data.alertType === 'SEISMIC') {
    targetUrl = '/alerts?tab=seismic';
  } else if (data.alertType === 'SKYALERT') {
    targetUrl = '/alerts?tab=skyalert';
  } else if (data.alertType === 'AMBULANCE' || data.alertType === 'SOS') {
    targetUrl = '/status';
  } else if (data.alertType === 'PANIC') {
    targetUrl = '/map';
  } else if (data.alertType === 'MESSAGE') {
    targetUrl = '/community';
  }

  if (event.action === 'dismiss') {
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            client.postMessage({
              type: 'NOTIFICATION_CLICK',
              alertType: data.alertType,
              data: data,
            });
            return client;
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// ─── Background fetch ───────────────────────────────────────────────────────

self.addEventListener('backgroundfetchsuccess', (event) => {
  console.log('[SW] Background fetch succeeded:', event.registration.id);
});

// ─── Messages from app ─────────────────────────────────────────────────────

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'REGISTER_PERIODIC_SYNC') {
    if ('periodicSync' in self.registration) {
      self.registration.periodicSync.register('mats-heartbeat', {
        minInterval: 60 * 1000,
      }).catch(err => console.warn('[SW] Periodic sync registration failed:', err));
    }
  }

  // Keep-alive control from useBackgroundSurvival hook
  if (event.data && event.data.type === 'START_KEEP_ALIVE') {
    startKeepAlive();
  }
  if (event.data && event.data.type === 'STOP_KEEP_ALIVE') {
    stopKeepAlive();
  }
});
