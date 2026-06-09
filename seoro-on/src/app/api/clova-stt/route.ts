import { NextRequest, NextResponse } from 'next/server';

// 네이버 클로바 Speech Short Recognition API
// 최대 60초 / 4MB 오디오 동기 변환 → 1~2초 내 응답
const CLOVA_STT_URL = 'https://clovaspeech-gw.ncloud.com/recog/v1/stt?lang=Kor';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const apiKey = process.env.CLOVA_STT_KEY;
  if (!apiKey) {
    console.error('[clova-stt] CLOVA_STT_KEY 환경변수 미설정');
    return NextResponse.json({ text: '', error: 'STT 키 미설정' }, { status: 200 });
  }

  let body: ArrayBuffer;
  try {
    body = await req.arrayBuffer();
  } catch {
    return NextResponse.json({ text: '', error: '오디오 읽기 실패' }, { status: 200 });
  }

  if (!body.byteLength) {
    return NextResponse.json({ text: '', error: '빈 오디오' }, { status: 200 });
  }

  console.log(`[clova-stt] ${body.byteLength} bytes → Clova`);

  let res: Response;
  try {
    res = await fetch(CLOVA_STT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-CLOVASPEECH-API-KEY': apiKey,
      },
      body: Buffer.from(body),
    });
  } catch (err) {
    console.error('[clova-stt] Clova 연결 실패:', err);
    return NextResponse.json({ text: '', error: 'Clova 연결 실패' }, { status: 200 });
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error(`[clova-stt] Clova ${res.status}:`, detail);
    return NextResponse.json({ text: '', error: `Clova ${res.status}` }, { status: 200 });
  }

  // 클로바 응답: { "result": "OK", "message": "인식된 텍스트" }
  const data = await res.json().catch(() => ({ result: 'ERROR', message: '' }));
  const text: string = data.message ?? '';

  console.log(`[clova-stt] 인식 완료: "${text.slice(0, 80)}"`);
  return NextResponse.json({ text });
}
