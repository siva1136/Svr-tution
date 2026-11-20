/**
 * Creates (or promotes) the first SVR Control administrator.
 *   npm run create-admin -w @svr/scripts -- admin@example.com 'StrongPassword!' "Admin Name"
 * Uses Application Default Credentials, or the Auth/Firestore emulators when
 * FIREBASE_AUTH_EMULATOR_HOST / FIRESTORE_EMULATOR_HOST are set.
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const [email, password, name = 'SVR Administrator'] = process.argv.slice(2);
if (!email) {
  console.error('Usage: create-admin <email> [password] [name]');
  process.exit(1);
}

initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT });
const auth = getAuth();

async function main() {
  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch {
    if (!password || password.length < 8) throw new Error('A password of at least 8 characters is required for a new account.');
    user = await auth.createUser({ email, password, displayName: name });
  }
  await auth.setCustomUserClaims(user.uid, { role: 'admin' });
  await getFirestore().collection('users').doc(user.uid).set(
    { role: 'admin', displayName: name, email, status: 'active', createdAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
  console.log(`✔ ${email} is now an SVR Control administrator (uid ${user.uid}). Sign out and back in to refresh the token.`);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
