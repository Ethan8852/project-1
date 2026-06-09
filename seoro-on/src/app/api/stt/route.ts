import { NextRequest, NextResponse } from 'next/server';
import { correctWithGemini } from '@/utils/gemini';

const MODAL_STT_URL = process.env.STT_ENDPOINT ?? '';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  if (!MODAL_STT_URL) {
    return NextResponse.json({ text: '', words: [], error: 'STT_ENDPOINT 미설정' }, { status: 200 });
  }

  let body: ArrayBuffer;
  try {
    body = await req.arrayBuffer();
  } catch {
    return NextResponse.json({ text: '', words: [], error: '오디오 읽기 실패' }, { status: 200 });
  }

  if (!body.byteLength) {
    return NextResponse.json({ text: '', words: [], error: '빈 오디오' }, { status: 200 });
  }

  console.log(`[stt] ${body.byteLength} bytes → Modal`);

  let res: Response;
  try {
    res = await fetch(MODAL_STT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: Buffer.from(body),
    });
  } catch (err) {
    console.error('[stt] Modal 연결 실패:', err);
    return NextResponse.json({ text: '', words: [], error: 'Modal 연결 실패' }, { status: 200 });
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error(`[stt] Modal ${res.status}:`, detail);
    return NextResponse.json({ text: '', words: [], error: `Modal ${res.status}` }, { status: 200 });
  }

  const data = await res.json().catch(() => ({ text: '', words: [] }));
  const rawText: string = data.text ?? '';

  // Gemini 문맥 교정 (GEMINI_API_KEY 없으면 건너뜀)
  const correctedText = await correctWithGemini(rawText);

  console.log(`[stt] 최종: "${correctedText.slice(0, 80)}"`);
  return NextResponse.json({ text: correctedText, words: data.words ?? [] });
}
