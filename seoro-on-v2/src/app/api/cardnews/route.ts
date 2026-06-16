import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase/server'
import { extractScene, generateImage } from '@/lib/openai'
import { buildImagePrompt } from '@/lib/prompts'
import { uploadCardImageFromBase64 } from '@/lib/storage'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const { recordingId, forceRegen } = await req.json()
    const sb = getServerSupabase()

    // 0. 캐싱 검사
    const { data: rec, error } = await sb
      .from('recordings')
      .select('story_text, card_image_path')
      .eq('id', recordingId)
      .single()

    if (error || !rec) {
      return NextResponse.json({ error: '[CARD-001] 녹음 조회 실패' }, { status: 400 })
    }

    // forceRegen이 true가 아니고, 이미 card_image_path가 채워져 있다면 생성 건너뜀
    if (rec.card_image_path && !forceRegen) {
      console.log(`[card] CACHE HIT recordingId=${recordingId}`)
      return NextResponse.json({ success: true, cached: true })
    }

    const storyText = (rec.story_text as string) ?? ''
    console.log(`[card] START recordingId=${recordingId} story="${storyText.slice(0, 50)}"`)

    // 1. 장면 추출
    console.log('[card] extractScene 시작')
    const scene = await extractScene(storyText)
    console.log(`[card] scene="${scene}"`)

    // 2. 이미지 프롬프트 빌드 → DALL-E 3 (gpt-image-2)
    const prompt = buildImagePrompt(scene)
    console.log('[card] GPT-Image-2 요청')
    
    let base64Data = ''
    try {
      base64Data = await generateImage(prompt)
    } catch (dalleErr) {
      console.warn(`[card] 1차 시도 실패, 재시도 수행: ${dalleErr}`)
      // 에러 재시도: DALL-E API 실패 시 1회 자동 재시도
      base64Data = await generateImage(prompt)
    }
    console.log(`[card] GPT-Image-2 OK (base64 length=${base64Data.length})`)

    // 3. Storage 업로드
    console.log('[card] Storage 업로드')
    const imagePath = await uploadCardImageFromBase64(recordingId, base64Data)
    console.log(`[card] Storage OK path=${imagePath}`)

    await sb
      .from('recordings')
      .update({ card_image_path: imagePath, card_image_scene: scene, status: 'card_done' })
      .eq('id', recordingId)

    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[card] FAIL error=${msg}`)
    return NextResponse.json({ error: `[CARD-002] ${msg}` }, { status: 500 })
  }
}
