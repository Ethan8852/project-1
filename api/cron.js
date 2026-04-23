import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const TG_API = `https://api.telegram.org/bot${process.env.TG_TOKEN}`;

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!chatId) return res.json({ ok: false, reason: 'no chat id configured' });

    const r = await fetch(`${TG_API}/getChat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId }),
    });
    const j = await r.json();
    if (!j.ok) return res.json({ ok: false, reason: 'telegram error' });

    const pin = j.result?.pinned_message;
    if (!pin?.text) return res.json({ ok: false, reason: 'no pinned message' });

    const nl = pin.text.indexOf('\n');
    if (nl < 0) return res.json({ ok: false, reason: 'bad pin format' });

    const b64 = pin.text.slice(nl + 1);
    const appState = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));

    const fcmToken = appState.fcmToken;
    if (!fcmToken) return res.json({ ok: false, reason: 'no fcm token in state' });

    const now = Date.now();
    const overdue = (appState.tasks ?? []).filter(
      t => !t.done && t.registeredAt && now > t.registeredAt
    );
    if (!overdue.length) return res.json({ ok: true, sent: false, reason: 'no overdue tasks' });

    const body = overdue.map((t, i) => `${i + 1}. ${t.starred ? '⭐ ' : ''}${t.text}`).join('\n');

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

    res.json({ ok: true, sent: true, count: overdue.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
