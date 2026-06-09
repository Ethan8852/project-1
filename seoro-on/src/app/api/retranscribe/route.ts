import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { correctWithGemini } from '@/utils/gemini';

const MODAL_STT_URL = process.env.STT_ENDPOINT ?? '';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const maxDuration = 300;

type STTWord = { word: string; start: number; end: number };

export async function POST(req: NextRequest) {
  const { recId, audioPath } = await req.json().catch(() => ({}));

  if (!recId || !audioPath) {
    return NextResponse.json({ error: 'recId, audioPath 필요' }, { status: 400 });
  }
  if (!MODAL_STT_URL) {
    return NextResponse.json({ error: 'STT_ENDPOINT 미설정', text: '', words: [] }, { status: 200 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. signed URL 발급 (서버 사이드 → CORS 없음)
  const { data: urlData, error: urlErr } = await supabase.storage
    .from('voice-records')
    .createSignedUrl(audioPath, 300);

  if (urlErr || !urlData?.signedUrl) {
    return NextResponse.json({ error: 'signed URL 실패', text: '', words: [] }, { status: 200 });
  }

  // 2. 오디오 다운로드
  let audioBuffer: ArrayBuffer;
  try {
    const audioRes = await fetch(urlData.signedUrl);
    if (!audioRes.ok) throw new Error(`storage ${audioRes.status}`);
    audioBuffer = await audioRes.arrayBuffer();
    console.log(`[retranscribe] ${audioBuffer.byteLength} bytes`);
  } catch (err) {
    return NextResponse.json({ error: '오디오 다운로드 실패', text: '', words: [] }, { status: 200 });
  }

  // 3. Modal Whisper STT
  let text = '';
  let words: STTWord[] = [];
  try {
    const sttRes = await fetch(MODAL_STT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: Buffer.from(audioBuffer),
    });

    const rawBody = await sttRes.text();
    console.log(`[retranscribe] Modal ${sttRes.status}:`, rawBody.slice(0, 200));

    if (!sttRes.ok) {
      return NextResponse.json({ error: `Modal ${sttRes.status}: ${rawBody.slice(0, 200)}`, text: '', words: [] }, { status: 200 });
    }

    const sttData = JSON.parse(rawBody);
    if (sttData.error) {
      return NextResponse.json({ error: `Whisper 오류: ${sttData.error}`, text: '', words: [] }, { status: 200 });
    }

    words = sttData.words ?? [];
    const rawText: string = sttData.text ?? '';
    text = await correctWithGemini(rawText);
    console.log(`[retranscribe] 완료: "${text.slice(0, 80)}" / ${words.length}단어`);
  } catch (err) {
    return NextResponse.json({ error: `STT 실패: ${String(err)}`, text: '', words: [] }, { status: 200 });
  }

  // 4. DB 업데이트 (stt_text + stt_words 함께 저장)
  const { error: dbErr } = await supabase
    .from('voice_answers')
    .update({
      stt_text: text || null,
      stt_words: words.length > 0 ? words : null,
    })
    .eq('id', recId);

  if (dbErr) console.error('[retranscribe] DB 오류:', dbErr);

  return NextResponse.json({ text, words });
}
