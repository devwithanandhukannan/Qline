'use client';
// "Continue with Google" through Firebase Auth. Firebase is only used to prove who the person is:
// we immediately exchange the Firebase ID token for our own httpOnly session cookie and sign out of Firebase.

export const googleEnabled = !!(process.env.NEXT_PUBLIC_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);

let loading = null;
export function preloadGoogle() {
  if (!googleEnabled) return null;
  loading ||= Promise.all([import('@firebase/app'), import('@firebase/auth')]).then(([appMod, authMod]) => {
    const app =
      appMod.getApps()[0] ||
      appMod.initializeApp({
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      });
    const auth = authMod.getAuth(app);
    return { auth, authMod };
  });
  return loading;
}

export async function getGoogleIdToken() {
  const { auth, authMod } = await preloadGoogle();
  const provider = new authMod.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await authMod.signInWithPopup(auth, provider);
  const token = await result.user.getIdToken();
  await authMod.signOut(auth).catch(() => {});
  return token;
}

