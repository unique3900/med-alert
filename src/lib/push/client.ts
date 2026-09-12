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

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  const config = btoa(JSON.stringify(publicEnv.firebase));
  return navigator.serviceWorker.register(`/sw.js?config=${encodeURIComponent(config)}`, { scope: '/' });
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
export async function enablePush(label?: string) {
  if (!pushConfigured) throw new Error('Push is not configured for this deployment.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission was not granted.');

  const registration = await registerServiceWorker();
  if (!registration) throw new Error('Service workers are unavailable in this browser.');
  await navigator.serviceWorker.ready;

  const token = await getToken(getMessaging(firebaseApp()), {
    vapidKey: publicEnv.vapidKey,
    serviceWorkerRegistration: registration,
  });

  if (!token) throw new Error('Could not obtain a push token.');

  const response = await fetch('/api/devices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, label, userAgent: navigator.userAgent }),
  });

  if (!response.ok) throw new Error('Could not save this device.');
  return token;
}

export async function onForegroundMessage(handler: (payload: MessagePayload) => void) {
  if (!pushConfigured || !(await isSupported().catch(() => false))) return () => {};
  return onMessage(getMessaging(firebaseApp()), handler);
}
