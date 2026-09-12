'use client';

import { getApps, initializeApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, onMessage, type MessagePayload } from 'firebase/messaging';
import { publicEnv, pushConfigured } from '@/lib/env';

const APP_NAME = 'med-alert';

export type PushState = 'unsupported' | 'unconfigured' | 'denied' | 'idle' | 'ready';

function firebaseApp() {
  const existing = getApps().find((app) => app.name === APP_NAME);
  return existing ?? initializeApp(publicEnv.firebase, APP_NAME);
}

/**
 * Catches the easy mistake of pasting a masked value out of a dashboard, which
 * otherwise surfaces as an unrelated encoding error three steps later.
 */
function assertUsableConfig() {
  const entries = Object.entries({ ...publicEnv.firebase, vapidKey: publicEnv.vapidKey });

  for (const [name, value] of entries) {
    if (!value) throw new Error(`Firebase config is missing "${name}".`);
    if (/[^\x20-\x7e]/.test(value)) {
      const masked = /[•·‧●*]/.test(value);
      throw new Error(
        masked
          ? `Firebase config "${name}" contains masked characters — the hidden value was copied instead of the real one. Reveal it in the Firebase console and set it again.`
          : `Firebase config "${name}" contains characters that are not plain ASCII.`,
      );
    }
  }
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  assertUsableConfig();

  return navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

export async function pushState(): Promise<PushState> {
  if (!pushConfigured) return 'unconfigured';
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  if (!(await isSupported().catch(() => false))) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'granted') return 'ready';
  return 'idle';
}

/** Asks for permission, mints an FCM token and stores it against the signed-in profile. */
function reason(cause: unknown) {
  if (cause instanceof Error) {
    const code = (cause as { code?: string }).code;
    return code ? `${cause.message} (${code})` : cause.message;
  }
  return String(cause);
}

export async function enablePush(label?: string) {
  if (!pushConfigured) throw new Error('Push is not configured for this deployment.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error(`Notification permission is "${permission}", not "granted".`);

  let registration: ServiceWorkerRegistration | null;
  try {
    registration = await registerServiceWorker();
  } catch (cause) {
    throw new Error(`The service worker failed to register: ${reason(cause)}`);
  }
  if (!registration) throw new Error('Service workers are unavailable in this browser.');
  await navigator.serviceWorker.ready;

  const mint = () =>
    getToken(getMessaging(firebaseApp()), {
      vapidKey: publicEnv.vapidKey,
      serviceWorkerRegistration: registration,
    });

  let token: string;
  try {
    token = await mint();
  } catch (first) {
    // The push service rejects a new key while an old subscription is live, which
    // is what a previous registration leaves behind. Drop it and ask once more.
    const existing = await registration.pushManager.getSubscription().catch(() => null);
    if (!existing) throw new Error(`Firebase could not issue a push token: ${reason(first)}`);

    await existing.unsubscribe().catch(() => {});
    try {
      token = await mint();
    } catch (second) {
      throw new Error(
        `Firebase could not issue a push token, even after clearing the old subscription: ${reason(second)}`,
      );
    }
  }

  if (!token) throw new Error('Firebase returned an empty push token.');

  const response = await fetch('/api/devices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, label, userAgent: navigator.userAgent }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(`Saving the device failed (HTTP ${response.status}): ${body.error ?? 'no detail'}`);
  }

  return token;
}

export async function onForegroundMessage(handler: (payload: MessagePayload) => void) {
  if (!pushConfigured || !(await isSupported().catch(() => false))) return () => {};
  return onMessage(getMessaging(firebaseApp()), handler);
}
