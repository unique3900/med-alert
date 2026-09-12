function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

const clean = (value: string | undefined) => (value ?? '').trim();

export const publicEnv = {
  supabaseUrl: clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  firebase: {
    apiKey: clean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
    authDomain: clean(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
    projectId: clean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
    storageBucket: clean(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
    messagingSenderId: clean(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
    appId: clean(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
  },
  vapidKey: clean(process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY),
};

export const pushConfigured = Boolean(
  publicEnv.firebase.apiKey && publicEnv.firebase.messagingSenderId && publicEnv.vapidKey,
);

export function serverEnv() {
  return {
    supabaseUrl: required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
    serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY),
    cronSecret: required('CRON_SECRET', process.env.CRON_SECRET),
  };
}

export function firebaseAdminEnv() {
  return {
    projectId: required('FIREBASE_PROJECT_ID', process.env.FIREBASE_PROJECT_ID),
    clientEmail: required('FIREBASE_CLIENT_EMAIL', process.env.FIREBASE_CLIENT_EMAIL),
    privateKey: required('FIREBASE_PRIVATE_KEY', process.env.FIREBASE_PRIVATE_KEY).replace(/\n/g, '\n'),
  };
}
