import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const db = getFirestore();
    const stateSnaps = await db.collectionGroup('state').get();

    const now = Date.now();
    const results = [];

    for (const doc of stateSnaps.docs) {
      if (doc.id !== 'data') continue;
      const appState = doc.data();
      const fcmToken = appState.fcmToken;
      if (!fcmToken) continue;

      const overdue = (appState.tasks ?? []).filter(
        t => !t.done && t.registeredAt && now > t.registeredAt
      );
      if (!overdue.length) continue;

      const body = overdue.map((t, i) => `${i + 1}. ${t.starred ? '⭐ ' : ''}${t.text}`).join('\n');

      try {
        await getMessaging().send({
          token: fcmToken,
          notification: { title: `🔔 1시간 재알림 (${overdue.length}개)`, body },
          webpush: {
            notification: {
              icon: '/icons/icon-192.png',
              badge: '/icons/icon-192.png',
              vibrate: [200, 100, 200],
              requireInteraction: false,
            },
            fcmOptions: { link: '/' },
          },
        });
        results.push({ uid: doc.ref.parent.parent.id, count: overdue.length, sent: true });
      } catch (sendErr) {
        results.push({ uid: doc.ref.parent.parent.id, error: sendErr.message, sent: false });
      }
    }

    res.json({ ok: true, results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
