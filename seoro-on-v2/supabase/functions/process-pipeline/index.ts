import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.8";
import OpenAI from "npm:openai@4.28.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { recordingId, action = 'all', forceRegen = false } = await req.json();

    if (!recordingId) {
      return new Response(JSON.stringify({ error: 'recordingId가 필요합니다.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const openAiApiKey = Deno.env.get('OPENAI_API_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase URL 또는 Service Role Key 환경변수가 누락되었습니다.');
    }
    if (!openAiApiKey) {
      throw new Error('OPENAI_API_KEY 환경변수가 누락되었습니다.');
    }

    // Service Role 클라이언트로 RLS 우회 처리
    const sb = createClient(supabaseUrl, supabaseServiceKey);
    const openai = new OpenAI({ apiKey: openAiApiKey });

    console.log(`[pipeline] 시작: recordingId=${recordingId}, action=${action}`);

    // recordings 테이블에서 현재 정보 조회
    const { data: rec, error: fetchErr } = await sb
      .from('recordings')
      .select('*')
      .eq('id', recordingId)
      .single();

    if (fetchErr || !rec) {
      throw new Error(`녹음 데이터를 찾을 수 없습니다: ${fetchErr?.message}`);
    }

    // ------------------------------------------------------------
    // 1단계: STT 변환
    // ------------------------------------------------------------
    let sttText = rec.stt_text || '';
    let sttWords = rec.stt_words || [];

    if (action === 'stt' || action === 'all') {
      if (!rec.stt_text || action === 'stt' || forceRegen) {
        console.log(`[pipeline] 1. STT 변환 시작`);
        await sb.from('recordings').update({ status: 'stt_processing' }).eq('id', recordingId);

        // 스토리지에서 오디오 다운로드
        const { data: audioBlob, error: dlErr } = await sb.storage
          .from('audio')
          .download(rec.audio_path);

        if (dlErr || !audioBlob) {
          throw new Error(`오디오 파일 다운로드 실패: ${dlErr?.message}`);
        }

        const ext = rec.audio_path.endsWith('mp4') ? 'mp4' : 'webm';
        const audioFile = new File([audioBlob], `audio.${ext}`, { type: audioBlob.type });

        try {
          const sttRes = await openai.audio.transcriptions.create({
            file: audioFile,
            model: 'whisper-1',
            response_format: 'verbose_json',
            timestamp_granularities: ['word'],
          });

          sttText = sttRes.text ?? '';
          sttWords = (sttRes.words ?? []).map((w: any) => ({
            word: w.word,
            start_ms: Math.round(w.start * 1000),
            end_ms: Math.round(w.end * 1000),
          }));

          await sb.from('recordings').update({
            stt_text: sttText,
            stt_words: sttWords,
            status: 'stt_done'
          }).eq('id', recordingId);

          console.log(`[pipeline] 1. STT 변환 성공 (길이: ${sttText.length})`);
        } catch (sttErr: any) {
          const msg = sttErr.message || String(sttErr);
          await sb.from('recordings').update({
            stt_text: `[STT오류] ${msg}`,
            status: 'stt_done'
          }).eq('id', recordingId);
          console.error(`[pipeline] 1. STT 변환 실패: ${msg}`);
        }
      }
    }

    // ------------------------------------------------------------
    // 2단계: 스토리 생성
    // ------------------------------------------------------------
    let storyText = rec.story_text || '';

    if (action === 'story' || action === 'all') {
      const textToUse = sttText || rec.stt_text || '';
      if (textToUse && (!rec.story_text || action === 'story' || forceRegen)) {
        console.log(`[pipeline] 2. 스토리 생성 시작`);
        
        const storyRes = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: '어르신의 구술 내용을 바탕으로 따뜻하고 문학적인 단편 이야기로 만들어 주세요. 원문 내용을 충실히 반영하고, 3~5문단, 경어체로 작성합니다. 제목은 넣지 마세요.',
            },
            {
              role: 'user',
              content: `질문: ${rec.question_text}\n\n구술 내용:\n${textToUse}`,
            },
          ],
          temperature: 0.7,
          max_tokens: 800,
        });

        storyText = storyRes.choices[0].message.content ?? '';

        await sb.from('recordings').update({
          story_text: storyText,
          status: 'story_done'
        }).eq('id', recordingId);

        console.log(`[pipeline] 2. 스토리 생성 성공 (길이: ${storyText.length})`);
      }
    }

    // ------------------------------------------------------------
    // 3단계: 일러스트 카드 생성 (장면 추출 + DALL-E 3)
    // ------------------------------------------------------------
    if (action === 'cardnews' || action === 'all') {
      const storyToUse = storyText || rec.story_text || '';
      if (storyToUse && (!rec.card_image_path || action === 'cardnews' || forceRegen)) {
        console.log(`[pipeline] 3. 일러스트 카드 생성 시작`);

        // A. 장면 추출
        const sceneRes = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are a visual scene extractor for a Korean family memoir illustration service. Extract one vivid, paintable scene from the given Korean story text. Output exactly ONE English sentence describing: who (1-2 people), where (Korean setting with era hint if possible), what they are doing, and the lighting/season. Do NOT include any text, letters, numbers, or words to be shown in the illustration. Do NOT include any explanation — output the scene sentence only.',
            },
            { role: 'user', content: storyToUse },
          ],
          temperature: 0.5,
          max_tokens: 120,
        });

        const scene = sceneRes.choices[0].message.content?.trim() ?? '';
        console.log(`[pipeline] 3-A. 장면 추출 성공: ${scene}`);

        // B. 이미지 생성 프롬프트 빌드
        const STYLE_BLOCK = `Soft hand-painted storybook illustration, gentle watercolor and gouache textures with a light paper grain. Warm, nostalgic atmosphere bathed in soft golden natural light with tender, low-contrast shading. Cozy muted palette of warm amber, cream, soft sky blue and gentle sage green. Rounded, soft outlines; simple uncluttered composition with comfortable negative space and one clear focal point. Kind, warm Korean characters shown gently from a slight distance or three-quarter view; peaceful, heartwarming mood. Painterly, hand-drawn animation-still feel — calm, wholesome, easy and comfortable for all ages including the elderly.
Avoid: any text, letters, numbers, logos or watermark; photorealism; harsh shadows; neon or oversaturated colors; cluttered or busy backgrounds; distorted faces or hands.`;
        
        const imagePrompt = `${STYLE_BLOCK}\nScene: ${scene}\nAspect ratio 4:3, centered storybook framing.`;

        // C. DALL-E 이미지 생성 (실패 시 1회 재시도 포함)
        let base64Data = '';
        try {
          const imgRes = await openai.images.generate({
            model: 'gpt-image-2',
            prompt: imagePrompt,
            size: '1792x1024',
            response_format: 'b64_json',
            n: 1,
          });
          base64Data = imgRes.data[0].b64_json ?? '';
        } catch (imgErr) {
          console.warn(`[pipeline] 이미지 생성 1차 시도 실패, 재시도 수행:`, imgErr);
          const imgRes = await openai.images.generate({
            model: 'gpt-image-2',
            prompt: imagePrompt,
            size: '1792x1024',
            response_format: 'b64_json',
            n: 1,
          });
          base64Data = imgRes.data[0].b64_json ?? '';
        }

        if (!base64Data) {
          throw new Error('DALL-E에서 반환된 Base64 이미지 데이터가 비어 있습니다.');
        }

        // D. Base64 데이터를 Blob으로 디코딩하여 Supabase Storage에 업로드
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const imageBlob = new Blob([byteArray], { type: 'image/png' });
        
        const imagePath = `${recordingId}.png`;

        const { error: uploadErr } = await sb.storage
          .from('card-images')
          .upload(imagePath, imageBlob, { contentType: 'image/png', upsert: true });

        if (uploadErr) {
          throw new Error(`카드 이미지 스토리지 업로드 실패: ${uploadErr.message}`);
        }

        console.log(`[pipeline] 3-D. 스토리지 업로드 성공: ${imagePath}`);

        // DB 최종 반영
        await sb.from('recordings').update({
          card_image_path: imagePath,
          card_image_scene: scene,
          status: 'card_done'
        }).eq('id', recordingId);

        console.log(`[pipeline] 3. 일러스트 카드 생성 성공`);
      }
    }

    return new Response(JSON.stringify({ success: true, recordingId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    const errorMsg = err.message || String(err);
    console.error(`[pipeline] 에러 발생:`, errorMsg);
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
