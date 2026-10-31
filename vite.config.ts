import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

dotenv.config();

interface AppletFirebaseJson {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId?: string;
  storageBucket: string;
  messagingSenderId: string;
  measurementId?: string;
}

async function canQueryPublicCollection(
  projectId: string,
  dbId: string,
  apiKey: string,
  collectionId: string
): Promise<{ok: boolean; notFoundDb: boolean}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      projectId
    )}/databases/${encodeURIComponent(dbId)}/documents:runQuery?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        structuredQuery: {
          from: [{collectionId}],
          where: {
            fieldFilter: {
              field: {fieldPath: 'isActive'},
              op: 'EQUAL',
              value: {booleanValue: true},
            },
          },
          limit: 1,
        },
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.status === 200) {
      return {ok: true, notFoundDb: false};
    }
    if (res.status === 404) {
      const text = await res.text();
      if (text.includes('does not exist for project')) {
        return {ok: false, notFoundDb: true};
      }
    }
    return {ok: false, notFoundDb: false};
  } catch {
    clearTimeout(timer);
    return {ok: false, notFoundDb: false};
  }
}

async function doesNamedDatabaseExist(
  projectId: string,
  dbId: string,
  apiKey: string
): Promise<boolean> {
  if (!dbId || dbId === '(default)') return true;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      projectId
    )}/databases/${encodeURIComponent(dbId)}/documents/__probe__/ping?key=${encodeURIComponent(
      apiKey
    )}`;
    const res = await fetch(url, {signal: controller.signal});
    clearTimeout(timer);
    if (res.status === 404) {
      const text = await res.text();
      if (text.includes('does not exist for project')) {
        return false;
      }
    }
    return true;
  } catch {
    clearTimeout(timer);
    return true;
  }
}

async function reconcileFirebaseEnvWithProvisionedApplet(): Promise<void> {
  const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
  const appletCfg: AppletFirebaseJson | null = fs.existsSync(configPath)
    ? (JSON.parse(fs.readFileSync(configPath, 'utf-8')) as AppletFirebaseJson)
    : null;

  const envProjectId = (process.env.VITE_FIREBASE_PROJECT_ID || '').trim();
  const envApiKey = (process.env.VITE_FIREBASE_API_KEY || '').trim();
  const rawEnvDbId = (process.env.VITE_FIREBASE_DATABASE_ID || '').trim();

  const targetProjectId = envProjectId || appletCfg?.projectId || '';
  const targetApiKey = envApiKey || appletCfg?.apiKey || '';
  const candidateDbId = rawEnvDbId || appletCfg?.firestoreDatabaseId || '(default)';

  if (!targetProjectId || !targetApiKey) return;

  // Always verify custom database IDs (e.g. "adminpanel") even when envProjectId === appletCfg.projectId,
  // because connecting Firestore SDK to a non-existent named database forces the client offline.
  let verifiedDbId = candidateDbId;
  if (verifiedDbId !== '(default)') {
    const exists = await doesNamedDatabaseExist(targetProjectId, verifiedDbId, targetApiKey);
    if (!exists) {
      verifiedDbId =
        appletCfg &&
        appletCfg.projectId === targetProjectId &&
        appletCfg.firestoreDatabaseId &&
        appletCfg.firestoreDatabaseId !== candidateDbId
          ? appletCfg.firestoreDatabaseId
          : '(default)';
    }
  }

  process.env.VITE_FIREBASE_DATABASE_ID = verifiedDbId;

  // Only consider falling back to appletCfg if envProjectId differs AND appletCfg itself has open storefront rules
  if (appletCfg && envProjectId && envProjectId !== appletCfg.projectId) {
    const envProducts = await canQueryPublicCollection(
      envProjectId,
      verifiedDbId,
      targetApiKey,
      'products'
    );
    if (!envProducts.ok) {
      const appletDbId = appletCfg.firestoreDatabaseId || '(default)';
      const appletProducts = await canQueryPublicCollection(
        appletCfg.projectId,
        appletDbId,
        appletCfg.apiKey,
        'products'
      );
      if (appletProducts.ok) {
        process.env.VITE_FALLBACK_FROM_LOCKED_PROJECT = envProjectId;
        process.env.VITE_FIREBASE_API_KEY = appletCfg.apiKey;
        process.env.VITE_FIREBASE_AUTH_DOMAIN = appletCfg.authDomain;
        process.env.VITE_FIREBASE_PROJECT_ID = appletCfg.projectId;
        process.env.VITE_FIREBASE_STORAGE_BUCKET = appletCfg.storageBucket;
        process.env.VITE_FIREBASE_MESSAGING_SENDER_ID = appletCfg.messagingSenderId;
        process.env.VITE_FIREBASE_APP_ID = appletCfg.appId;
        process.env.VITE_FIREBASE_DATABASE_ID = appletDbId;
        if (appletCfg.measurementId) {
          process.env.VITE_FIREBASE_MEASUREMENT_ID = appletCfg.measurementId;
        }
        return;
      }
    }
  }

  process.env.VITE_FALLBACK_FROM_LOCKED_PROJECT = '';
}

export default defineConfig(async () => {
  await reconcileFirebaseEnvWithProvisionedApplet();
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
