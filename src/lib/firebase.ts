import { getApps, initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  browserSessionPersistence,
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth,
  inMemoryPersistence,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type Auth,
  type UserCredential,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import appletFirebaseConfig from '../../firebase-applet-config.json';

function cleanEnvValue(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim().replace(/^["']+|["']+$/g, '').trim();
  if (
    !trimmed ||
    trimmed.startsWith('YOUR_') ||
    trimmed.startsWith('MY_') ||
    trimmed === 'undefined' ||
    trimmed === 'null'
  ) {
    return '';
  }
  return trimmed;
}

function resolveSafeAuthDomain(
  rawAuthDomain: unknown,
  projectId: string,
  fallbackAuthDomain: string
): string {
  const cleaned = cleanEnvValue(rawAuthDomain)
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .trim();

  if (!cleaned) {
    return fallbackAuthDomain;
  }

  // Prevent accidental Vercel URL placement in VITE_FIREBASE_AUTH_DOMAIN when using the shared Firebase project,
  // since Google OAuth 2.0 Web Client redirect_uri is registered against <projectId>.firebaseapp.com.
  if (
    projectId === appletFirebaseConfig.projectId &&
    (cleaned.endsWith('.vercel.app') || !cleaned.includes('.'))
  ) {
    return fallbackAuthDomain;
  }

  return cleaned;
}

const envProjectId = cleanEnvValue(import.meta.env.VITE_FIREBASE_PROJECT_ID);
const envApiKey = cleanEnvValue(import.meta.env.VITE_FIREBASE_API_KEY);

const usingEnvOverride = Boolean(
  envProjectId && envApiKey && envProjectId !== appletFirebaseConfig.projectId
);

const appletCfgRecord = appletFirebaseConfig as Record<string, string | undefined>;
const resolvedProjectId = envProjectId || appletFirebaseConfig.projectId;

// Prefer explicit VITE_FIREBASE_* environment variables when connecting to a verified external shared Admin project,
// with automatic sanitization and seamless fallback to firebase-applet-config.json.
const resolvedFirebaseConfig = {
  apiKey: envApiKey || appletFirebaseConfig.apiKey,
  authDomain: resolveSafeAuthDomain(
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    resolvedProjectId,
    appletFirebaseConfig.authDomain
  ),
  databaseURL: appletCfgRecord.databaseURL || undefined,
  projectId: resolvedProjectId,
  storageBucket:
    cleanEnvValue(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET) ||
    appletFirebaseConfig.storageBucket,
  messagingSenderId:
    cleanEnvValue(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID) ||
    appletFirebaseConfig.messagingSenderId,
  appId: cleanEnvValue(import.meta.env.VITE_FIREBASE_APP_ID) || appletFirebaseConfig.appId,
  measurementId:
    cleanEnvValue(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) ||
    appletFirebaseConfig.measurementId ||
    undefined,
};

export const activeFirestoreDatabaseId: string =
  cleanEnvValue(import.meta.env.VITE_FIREBASE_DATABASE_ID) ||
  appletFirebaseConfig.firestoreDatabaseId ||
  '(default)';

export const firebaseConnectionSummary = {
  projectId: resolvedFirebaseConfig.projectId,
  authDomain: resolvedFirebaseConfig.authDomain,
  storageBucket: resolvedFirebaseConfig.storageBucket,
  firestoreDatabaseId: activeFirestoreDatabaseId,
  usingEnvOverride,
  fallbackFromLockedProject: cleanEnvValue(import.meta.env.VITE_FALLBACK_FROM_LOCKED_PROJECT),
  sharedEnvSnippet: [
    `VITE_FIREBASE_API_KEY="${resolvedFirebaseConfig.apiKey}"`,
    `VITE_FIREBASE_AUTH_DOMAIN="${resolvedFirebaseConfig.authDomain}"`,
    `VITE_FIREBASE_PROJECT_ID="${resolvedFirebaseConfig.projectId}"`,
    `VITE_FIREBASE_STORAGE_BUCKET="${resolvedFirebaseConfig.storageBucket}"`,
    `VITE_FIREBASE_MESSAGING_SENDER_ID="${resolvedFirebaseConfig.messagingSenderId}"`,
    `VITE_FIREBASE_APP_ID="${resolvedFirebaseConfig.appId}"`,
    `VITE_FIREBASE_DATABASE_ID="${activeFirestoreDatabaseId}"`,
  ].join('\n'),
};

const app = getApps().find((existing) => existing.name === '[DEFAULT]') || initializeApp(resolvedFirebaseConfig);

export const db =
  activeFirestoreDatabaseId === '(default)'
    ? getFirestore(app)
    : getFirestore(app, activeFirestoreDatabaseId);

function createResilientAuth(): Auth {
  if (typeof window === 'undefined') {
    return getAuth(app);
  }
  try {
    return initializeAuth(app, {
      persistence: [
        indexedDBLocalPersistence,
        browserLocalPersistence,
        browserSessionPersistence,
        inMemoryPersistence,
      ],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    return getAuth(app);
  }
}

export const auth: Auth = createResilientAuth();
export const storage = getStorage(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');
googleProvider.setCustomParameters({ prompt: 'select_account' });

const hasDistinctAppletBridge = Boolean(
  usingEnvOverride &&
    appletFirebaseConfig.apiKey &&
    appletFirebaseConfig.projectId &&
    appletFirebaseConfig.projectId !== resolvedFirebaseConfig.projectId
);

const oauthBridgeAuth = hasDistinctAppletBridge
  ? getAuth(
      getApps().find((existing) => existing.name === 'aistudio-oauth-bridge') ||
        initializeApp(appletFirebaseConfig, 'aistudio-oauth-bridge')
    )
  : null;

function isInsideIframe(): boolean {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true;
  }
}

function isSameOriginAuthDomain(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname.toLowerCase() === resolvedFirebaseConfig.authDomain.toLowerCase();
}

// Pre-warm Firebase's BrowserPopupRedirectResolver (loads gapi.iframes + __/auth/iframe ahead of user click).
// Without proactive pre-warming on desktop Chrome/Edge/Windows, signInWithPopup performs 3 sequential network
// round-trips before calling window.open(), expiring transient user activation and triggering auth/popup-blocked!
let popupResolverWarmPromise: Promise<unknown> | null = null;

export function warmUpGooglePopupResolver(): Promise<unknown> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (popupResolverWarmPromise) return popupResolverWarmPromise;

  try {
    const internalAuth = auth as unknown as {
      _popupRedirectResolver?: {
        _initialize?: (authInstance: unknown) => Promise<unknown>;
      };
    };
    const maybePromise = internalAuth._popupRedirectResolver?._initialize?.(auth);
    if (maybePromise) {
      popupResolverWarmPromise = maybePromise.catch((err) => {
        popupResolverWarmPromise = null;
        return err;
      });
      return popupResolverWarmPromise;
    }
  } catch {
    popupResolverWarmPromise = null;
  }
  return Promise.resolve();
}

if (typeof window !== 'undefined') {
  // Proactively warm popup resolver shortly after boot so Google Sign-In opens instantaneously on first click
  window.setTimeout(() => {
    void warmUpGooglePopupResolver();
  }, 50);
}

let lastRedirectError: unknown = null;

export function consumeLastRedirectError(): unknown {
  const err = lastRedirectError;
  lastRedirectError = null;
  return err;
}

export async function resolvePendingGoogleRedirect(): Promise<UserCredential | null> {
  try {
    return await getRedirectResult(auth, browserPopupRedirectResolver);
  } catch (err) {
    lastRedirectError = err;
    return null;
  }
}

export async function signInWithGoogleSmart(): Promise<UserCredential | null> {
  try {
    return await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    // If running in an environment with a distinct pre-authorized bridge and primary domain isn't authorized yet
    if (msg.includes('auth/unauthorized-domain') && oauthBridgeAuth) {
      const bridgeResult = await signInWithPopup(
        oauthBridgeAuth,
        googleProvider,
        browserPopupRedirectResolver
      );
      const oauthCred = GoogleAuthProvider.credentialFromResult(bridgeResult);
      void signOut(oauthBridgeAuth).catch(() => {});

      if (!oauthCred?.accessToken && !oauthCred?.idToken) {
        throw new Error('Google একাউন্ট থেকে অনুমোদিত টোকেন পাওয়া যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।');
      }

      const targetCredential = oauthCred.accessToken
        ? GoogleAuthProvider.credential(null, oauthCred.accessToken)
        : GoogleAuthProvider.credential(oauthCred.idToken);

      return await signInWithCredential(auth, targetCredential);
    }

    // IMPORTANT: Only fall back to signInWithRedirect when popups are strictly unsupported in the environment
    // AND authDomain matches current origin (otherwise modern browser third-party storage partitioning silently
    // drops cross-domain redirect sessions on *.vercel.app <-> *.firebaseapp.com).
    if (
      msg.includes('auth/operation-not-supported-in-this-environment') &&
      !isInsideIframe() &&
      isSameOriginAuthDomain()
    ) {
      await signInWithRedirect(auth, googleProvider, browserPopupRedirectResolver);
      return null;
    }

    throw err;
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'siteSettings', 'main'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();
