export async function onRequest(context) {
  const config = {
    apiKey: context.env.FIREBASE_API_KEY,
    authDomain: context.env.FIREBASE_AUTH_DOMAIN,
    projectId: context.env.FIREBASE_PROJECT_ID,
    storageBucket: context.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: context.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: context.env.FIREBASE_APP_ID,
  };
  return new Response(JSON.stringify(config), {
    headers: { 'Content-Type': 'application/json' },
  });
}
