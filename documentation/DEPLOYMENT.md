# Deployment guide

## 1. Firebase project

1. Create the project `svr-maths-academy` at <https://console.firebase.google.com> (or change the id in `.firebaserc`). Upgrade to the **Blaze** plan, which Cloud Functions requires.
2. Enable the services:
   - **Authentication** → Sign-in methods: *Email/Password* and *Phone*. Add your domains under *Authorized domains*.
   - **Firestore** (production mode, region `asia-south1`).
   - **Storage**.
   - **Cloud Messaging** (enabled by default).
3. Register a **Web app** and copy its config into `apps/website/.env.production` and `apps/admin/.env.production` (see each `.env.example`).
4. Create two Hosting sites, `svr-maths-academy` (website) and `svr-control` (admin), or rename them in `.firebaserc`:
   ```bash
   firebase hosting:sites:create svr-control
   ```

## 2. Razorpay

1. Create API keys in the Razorpay Dashboard (start with **Test mode**).
2. Store them as Functions secrets (never in source code):
   ```bash
   firebase functions:secrets:set RAZORPAY_KEY_ID
   firebase functions:secrets:set RAZORPAY_KEY_SECRET
   firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET
   ```
3. Add a webhook: URL `https://asia-south1-<project-id>.cloudfunctions.net/razorpayWebhook`, events `payment.captured` and `payment.failed`, using the same webhook secret.

## 3. Deploy

```bash
npm ci
firebase login
npm run build
firebase deploy --only firestore:rules,firestore:indexes,storage
firebase deploy --only functions
firebase deploy --only hosting
```

## 4. First admin and seed data

Download a service-account key (Project settings → Service accounts). Keep it out of git; `service-account*.json` is ignored.

```bash
export GOOGLE_APPLICATION_CREDENTIALS=$PWD/service-account.json GCLOUD_PROJECT=svr-maths-academy
npm run seed                                           # courses, NCERT chapters, website content
npm run create-admin -w @svr/scripts -- you@academy.in 'StrongPassword!' "Your Name"
```

Then sign in to SVR Control and update **Settings** (phone, WhatsApp, address), **Website Content** and course prices.

## 5. Domains

Firebase Hosting → *Add custom domain*:
- `svrmathsacademy.in` → site `svr-maths-academy`
- `control.svrmathsacademy.in` → site `svr-control`

Update `VITE_SITE_URL`, `public/robots.txt` and `public/sitemap.xml` if the domain differs.

## 6. Optional

- **Google Analytics 4**: set `VITE_GA_ID` in the website env.
- **App Check** (recommended before launch): enable reCAPTCHA Enterprise for web and Play Integrity / App Attest for SVR Learn, then enforce it on functions.
- **Backups**: enable Firestore point-in-time recovery and scheduled exports.
- **Budgets and alerts** in Google Cloud Billing.

## Local development

See the Quick start in the root `README.md`. Everything (Auth, Firestore, Functions, Storage) runs in the Emulator Suite, and `npm run e2e` runs the full end-to-end test.
