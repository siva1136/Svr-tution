/**
 * Standalone server (Cloud Run / local). In production the same app is also
 * deployed inside Cloud Functions as `api`.
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json npm start -w @svr/node-api
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { createApp } from './app';

if (getApps().length === 0) initializeApp();
const port = Number(process.env.PORT ?? 8787);
createApp({ db: getFirestore(), auth: getAuth() }).listen(port, () => {
  console.log(`SVR API listening on http://localhost:${port}`);
});
