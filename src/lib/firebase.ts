import { getApps, initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
  inMemoryPersistence,
  type Auth,
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

export const resolvedDatabaseUrl: string =
  cleanEnvValue(import.meta.env.VITE_FIREBASE_DATABASE_URL) ||
  appletCfgRecord.databaseURL ||
  '';

function resolveSafeDatabaseId(rawDbId: unknown, projectId: string, fallbackDbId: string): string {
  const cleaned = cleanEnvValue(rawDbId);
  if (!cleaned) return fallbackDbId || '(default)';
  const lower = cleaned.toLowerCase();
  if (lower === '(default)' || lower === 'default') {
    return '(default)';
  }
  if (
    projectId === 'admin-panel-5ecd8' &&
    (lower === 'adminpanel' || lower === 'admin-panel' || lower === 'admin-panel-5ecd8')
  ) {
    return '(default)';
  }
  return cleaned;
}

// Prefer explicit VITE_FIREBASE_* environment variables when connecting to a verified external shared Admin project,
// with automatic sanitization and seamless fallback to firebase-applet-config.json.
const resolvedFirebaseConfig = {
  apiKey: envApiKey || appletFirebaseConfig.apiKey,
  authDomain: resolveSafeAuthDomain(
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    resolvedProjectId,
    appletFirebaseConfig.authDomain
  ),
  databaseURL: resolvedDatabaseUrl || undefined,
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

export const activeFirestoreDatabaseId: string = resolveSafeDatabaseId(
  import.meta.env.VITE_FIREBASE_DATABASE_ID,
  resolvedProjectId,
  appletFirebaseConfig.firestoreDatabaseId || '(default)'
);

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

const app =
  getApps().find((existing) => existing.name === '[DEFAULT]') ||
  initializeApp(resolvedFirebaseConfig);

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
    });
  } catch {
    return getAuth(app);
  }
}

export const auth: Auth = createResilientAuth();
export const storage = getStorage(app);

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
