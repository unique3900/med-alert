import 'server-only';

import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, type MulticastMessage } from 'firebase-admin/messaging';
import { firebaseAdminEnv } from '@/lib/env';

const APP_NAME = 'med-alert';

function messaging() {
  const existing = getApps().find((app) => app.name === APP_NAME);
  if (!existing) initializeApp({ credential: cert(firebaseAdminEnv()) }, APP_NAME);
  return getMessaging(getApp(APP_NAME));
}

export type AlertPayload = {
  doseId: string;
  medication: string;
  detail: string;
  person: string;
  dueAt: string;
  attempt: number;
};

export type SendResult = {
  delivered: number;
  staleTokens: string[];
};

export async function sendAlert(tokens: string[], payload: AlertPayload): Promise<SendResult> {
  if (tokens.length === 0) return { delivered: 0, staleTokens: [] };

  const message: MulticastMessage = {
    tokens,
    data: {
      kind: 'dose-alert',
      doseId: payload.doseId,
      medication: payload.medication,
      detail: payload.detail,
      person: payload.person,
      dueAt: payload.dueAt,
      attempt: String(payload.attempt),
    },
    webpush: {
      headers: { Urgency: 'high', TTL: '900' },
      fcmOptions: { link: `/today?dose=${payload.doseId}` },
    },
    android: { priority: 'high' },
    apns: {
      headers: { 'apns-priority': '10', 'apns-push-type': 'alert' },
      payload: {
        aps: {
          alert: { title: `${payload.medication} for ${payload.person}`, body: payload.detail },
          sound: 'default',
          badge: 1,
        },
      },
    },
  };

  const response = await messaging().sendEachForMulticast(message);
  const staleTokens: string[] = [];

  response.responses.forEach((result, index) => {
    if (result.success) return;
    const code = result.error?.code ?? '';
    if (
      code === 'messaging/registration-token-not-registered' ||
      code === 'messaging/invalid-registration-token' ||
      code === 'messaging/invalid-argument'
    ) {
      staleTokens.push(tokens[index]!);
    }
  });

  return { delivered: response.successCount, staleTokens };
}
