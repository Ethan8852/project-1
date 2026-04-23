// FCM 토큰 수신 확인 (실제 저장은 Telegram 핀 메시지가 담당)
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  res.json({ ok: true });
}
