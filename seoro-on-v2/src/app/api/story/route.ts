import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase/server'
import { generateStory } from '@/lib/openai'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const { recordingId } = await req.json()
  const sb = getServerSupabase()

  const { data: rec, error } = await sb
    .from('recordings')
    .select('stt_text, question_text')
    .eq('id', recordingId)
    .single()

  if (error || !rec) {
    return NextResponse.json({ error: '[STORY-001] 녹음 조회 실패' }, { status: 400 })
  }

  try {
    console.log(`[story] START recordingId=${recordingId} stt="${String(rec.stt_text).slice(0, 50)}"`)
    const storyText = await generateStory(rec.question_text as string, (rec.stt_text as string) ?? '')
    console.log(`[story] OK length=${storyText.length}`)

    await sb
      .from('recordings')
      .update({ story_text: storyText, status: 'story_done' })
      .eq('id', recordingId)

    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[story] FAIL recordingId=${recordingId} error=${msg}`)
    return NextResponse.json({ error: `[STORY-002] ${msg}` }, { status: 500 })
  }
}
