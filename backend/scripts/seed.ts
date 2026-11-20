/**
 * Seeds Firestore with the SVR catalogue, NCERT chapters and website content.
 * Safe to re-run (uses deterministic ids + merge).
 *
 * Emulator:   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=svr-maths-academy npm run seed
 * Production: GOOGLE_APPLICATION_CREDENTIALS=./service-account.json npm run seed
 */
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { BRAND, CATALOG, COL, slugify } from '@svr/shared';

initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT });
const db = getFirestore();

async function main() {
  const batch = db.batch();

  batch.set(
    db.collection(COL.settings).doc('public'),
    {
      academyName: BRAND.name,
      tagline: BRAND.tagline,
      academicYear: BRAND.academicYear,
      phone: '+91 90000 00000',
      whatsapp: '919000000000',
      email: 'admissions@svrmathsacademy.in',
      address: 'SVR Maths Academy, Hyderabad, Telangana',
      admissionsOpen: true,
    },
    { merge: true },
  );

  for (const c of CATALOG) {
    const { chapters, ...course } = c;
    const ref = db.collection(COL.courses).doc(c.slug);
    batch.set(ref, { ...course, teacherIds: [], createdAt: FieldValue.serverTimestamp() }, { merge: true });
    chapters.forEach((title, i) => {
      batch.set(ref.collection(COL.chapters).doc(`ch${String(i + 1).padStart(2, '0')}-${slugify(title).slice(0, 40)}`), {
        title,
        number: i + 1,
        published: true,
      }, { merge: true });
    });
  }

  const faculty = [
    { name: 'S. V. Ramana', title: 'Founder & Head of Mathematics', bio: 'Two decades of teaching board and JEE mathematics with a focus on concept mastery.', experienceYears: 20, order: 1 },
    { name: 'Dr. K. Lakshmi', title: 'Senior Faculty — Calculus & Algebra', bio: 'PhD in Mathematics; specialises in calculus and problem-solving for JEE.', experienceYears: 14, order: 2 },
    { name: 'R. Arjun', title: 'Olympiad Mentor', bio: 'Former INMO awardee guiding students through RMO and INMO preparation.', experienceYears: 8, order: 3 },
  ];
  faculty.forEach((f, i) => batch.set(db.collection(COL.faculty).doc(`faculty-${i + 1}`), f, { merge: true }));

  const testimonials = [
    { name: 'Ananya R.', detail: 'Class 10 CBSE — 98/100', quote: 'The chapter tests and analysis showed me exactly what to revise. Maths became my strongest subject.', rating: 5, published: true },
    { name: 'Parent of Rahul K.', detail: 'Class 12 CBSE', quote: 'The monthly reports and attendance updates kept us informed throughout the year.', rating: 5, published: true },
    { name: 'Sai Teja', detail: 'JEE Main — 99.2 percentile (Maths)', quote: 'NTA-pattern mocks with rank lists made the real exam feel familiar.', rating: 5, published: true },
  ];
  testimonials.forEach((t, i) => batch.set(db.collection(COL.testimonials).doc(`testimonial-${i + 1}`), t, { merge: true }));

  const toppers = [
    { name: 'Ananya R.', exam: 'CBSE Class 10', score: '98/100', year: '2025', order: 1 },
    { name: 'Vikram P.', exam: 'CBSE Class 12', score: '97/100', year: '2025', order: 2 },
    { name: 'Sai Teja', exam: 'JEE Main Maths', score: '99.2 %ile', year: '2025', order: 3 },
  ];
  toppers.forEach((t, i) => batch.set(db.collection(COL.toppers).doc(`topper-${i + 1}`), t, { merge: true }));

  await batch.commit();
  console.log(`Seeded ${CATALOG.length} courses, settings, faculty, testimonials and toppers.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
