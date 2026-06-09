// Gemini API로 Whisper 원문을 한국어 문맥 교정
// GEMINI_API_KEY 환경변수가 없으면 원문 그대로 반환 (선택 기능)

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const PROMPT_PREFIX =
  '다음은 어르신의 음성을 AI가 텍스트로 변환한 결과입니다. ' +
  '맞춤법과 띄어쓰기를 바로잡고 자연스러운 한국어로 다듬어 주세요. ' +
  '내용·단어·뉘앙스는 절대 바꾸지 말고, 교정된 텍스트만 출력하세요.\n\n원문: ';

export async function correctWithGemini(rawText: string): Promise<string> {
  if (!GEMINI_API_KEY || !rawText.trim()) return rawText;

  try {
    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT_PREFIX + rawText }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
      }),
    });

    if (!res.ok) {
      console.error('[gemini] 응답 오류:', res.status);
      return rawText;
    }

    const data = await res.json();
    const corrected: string =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    console.log(`[gemini] 교정 완료: "${corrected.slice(0, 80)}"`);
    return corrected.trim() || rawText;
  } catch (err) {
    console.error('[gemini] 오류:', err);
    return rawText;
  }
}
