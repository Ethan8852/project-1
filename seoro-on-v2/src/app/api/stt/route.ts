import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase/server'
import { whisperSTT } from '@/lib/openai'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const sb = getServerSupabase()
  let recordingId: string
  let arrayBuffer: ArrayBuffer
  let mimeType = 'audio/webm'

  const contentType = req.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    // 신규 녹음: 클라이언트에서 blob 직접 전송
    const form = await req.formData()
    recordingId = form.get('recordingId') as string
    const audioFile = form.get('audio') as File | null
    if (!recordingId || !audioFile) {
      return NextResponse.json({ error: '[STT-001] 필수 파라미터 누락' }, { status: 400 })
    }
    arrayBuffer = await audioFile.arrayBuffer()
    mimeType = audioFile.type
  } else {
    // 재생성: Storage에서 다운로드
    const body = await req.json()
    recordingId = body.recordingId
    if (!recordingId) {
      return NextResponse.json({ error: '[STT-001] recordingId 누락' }, { status: 400 })
    }
    const { data: rec } = await sb
      .from('recordings')
      .select('audio_path')
      .eq('id', recordingId)
      .single()
    if (!rec) return NextResponse.json({ error: '[STT-001] 녹음 없음' }, { status: 400 })

    const { data: fileData, error: dlErr } = await sb.storage
      .from('audio')
      .download(rec.audio_path as string)
    if (dlErr || !fileData) {
      return NextResponse.json({ error: `[STT-003] 오디오 다운로드 실패: ${dlErr?.message}` }, { status: 500 })
    }
    arrayBuffer = await fileData.arrayBuffer()
  }

  await sb.from('recordings').update({ status: 'stt_processing' }).eq('id', recordingId)

  try {
    console.log(`[stt] type=${mimeType} size=${arrayBuffer.byteLength}bytes id=${recordingId}`)
    const fileName = mimeType.includes('mp4') ? 'audio.mp4' : 'audio.webm'
    const { text: sttText, words: sttWords } = await whisperSTT(arrayBuffer, fileName)
    console.log(`[stt] OK: segments=${sttWords.length} "${sttText.slice(0, 80)}"`)

    await sb
      .from('recordings')
      .update({ stt_text: sttText, stt_words: sttWords, status: 'stt_done' })
      .eq('id', recordingId)

    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[stt] FAIL id=${recordingId} error=${msg}`)
    await sb
      .from('recordings')
      .update({ stt_text: `[STT오류] ${msg}`, status: 'stt_done' })
      .eq('id', recordingId)
    return NextResponse.json({ success: true, warning: `[STT-002] ${msg}` })
  }
}
