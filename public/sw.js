// MATS Service Worker for Push Notifications & Background Tasks

const CACHE_NAME = 'mats-v1';
const CRITICAL_ALERT_TYPES = ['SEISMIC', 'AMBULANCE', 'PANIC', 'SOS', 'SKYALERT'];

const PRECACHE_URLS = [
  '/directorio_emergencias_completo.json',
  '/cruz_roja_directorio_completo.json',
  '/resources_pack.json',
  '/fuentes_otras.json',
];

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

// Cache-first for JSON data files, network-first for everything else
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (PRECACHE_URLS.some(p => url.pathname === p)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        // Try network first, fall back to cache
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

// Periodic background sync for keeping connections alive
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'mats-heartbeat') {
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
    // Just a lightweight ping to keep connections warm
    const response = await fetch('/api/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timestamp: Date.now() }),
    }).catch(() => null);
    return response;
  } catch (e) {
    console.warn('[SW] Heartbeat failed:', e);
  }
}

async function syncOfflineActions() {
  console.log('[SW] Syncing offline actions');
  // Will be handled by the offline queue in the app
}

async function checkSkyAlert() {
  try {
    console.log('[SW] Background SkyAlert check');
    // This will be handled by the edge function
  } catch (e) {
    console.warn('[SW] SkyAlert check failed:', e);
  }
}

// Handle push notifications - Enhanced for critical alerts
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
    requireInteraction: isCritical, // Critical alerts require user interaction
    renotify: isCritical, // Re-notify for critical alerts even if same tag
    silent: false,
    vibrate: isCritical 
      ? [500, 200, 500, 200, 500] // Urgent pattern
      : [200, 100, 200], // Normal pattern
    data: { ...data.data, alertType: data.alertType },
    actions: isCritical ? [
      { action: 'view', title: 'Ver ahora' },
      { action: 'dismiss', title: 'Cerrar' },
    ] : [],
  };

  // For seismic alerts, add urgency
  if (data.alertType === 'SEISMIC') {
    options.urgency = 'critical';
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);
  event.notification.close();

  const data = event.notification.data || {};
  let targetUrl = '/';

  // Route based on alert type
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
        // If app is already open, focus it and navigate
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
        // Otherwise open the app at the right page
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// Handle background fetch for large operations
self.addEventListener('backgroundfetchsuccess', (event) => {
  console.log('[SW] Background fetch succeeded:', event.registration.id);
});

// Listen for messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  // Register for periodic background sync if supported
  if (event.data && event.data.type === 'REGISTER_PERIODIC_SYNC') {
    if ('periodicSync' in self.registration) {
      self.registration.periodicSync.register('mats-heartbeat', {
        minInterval: 60 * 1000, // 1 minute minimum
      }).catch(err => console.warn('[SW] Periodic sync registration failed:', err));
    }
  }
});
