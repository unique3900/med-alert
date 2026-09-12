/* Med Alert service worker: FCM delivery + a minimal offline shell. */

const SDK_VERSION = '12.19.0';
const CACHE = 'med-alert-shell-v1';
const SHELL = ['/offline.html', '/icons/icon-192.png', '/icons/icon-512.png', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/offline.html')));
    return;
  }

  if (SHELL.includes(url.pathname)) {
    event.respondWith(caches.match(request).then((hit) => hit || fetch(request)));
  }
});

function firebaseConfig() {
  // searchParams already decodes; the client encodes with encodeURIComponent
  // rather than base64 so non-ASCII cannot break registration.
  const raw = new URL(self.location.href).searchParams.get('config');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const config = firebaseConfig();

if (config) {
  importScripts(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app-compat.js`);
  importScripts(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-messaging-compat.js`);

  firebase.initializeApp(config);

  firebase.messaging().onBackgroundMessage((payload) => {
    const data = payload.data || {};
    if (data.kind !== 'dose-alert') return;

    const attempt = Number(data.attempt || '1');
    const title = attempt > 1 ? `Still due: ${data.medication}` : `Time for ${data.medication}`;

    self.registration.showNotification(title, {
      body: data.detail || '',
      tag: `dose-${data.doseId}`,
      renotify: true,
      requireInteraction: true,
      silent: false,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      vibrate: [700, 200, 700, 200, 700, 200, 700],
      timestamp: Date.parse(data.dueAt || '') || Date.now(),
      data: { doseId: data.doseId, attempt },
      actions: [
        { action: 'taken', title: 'Taken' },
        { action: 'snooze', title: 'Snooze 10m' },
      ],
    });
  });
}

async function resolveDose(doseId, action) {
  if (!doseId) return;
  await fetch(`/api/doses/${doseId}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  }).catch(() => {});
}

async function focusApp(doseId) {
  const target = doseId ? `/today?dose=${doseId}` : '/today';
  const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

  for (const client of clientList) {
    if (new URL(client.url).origin === self.location.origin) {
      client.postMessage({ kind: 'dose-alert-open', doseId });
      return client.focus();
    }
  }
  return self.clients.openWindow(target);
}

self.addEventListener('notificationclick', (event) => {
  const { doseId } = event.notification.data || {};
  event.notification.close();

  if (event.action === 'taken' || event.action === 'snooze') {
    event.waitUntil(resolveDose(doseId, event.action));
    return;
  }

  event.waitUntil(focusApp(doseId));
});
