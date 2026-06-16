import { supabase } from './supabase/client'

const AUDIO_BUCKET = 'audio'
const CARD_BUCKET = 'card-images'

export function getAudioUrl(path: string): string {
  const { data } = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export function getCardImageUrl(path: string): string {
  const { data } = supabase.storage.from(CARD_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function uploadAudio(
  path: string,
  blob: Blob,
): Promise<{ error: Error | null }> {
  const { error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .upload(path, blob, { contentType: blob.type, upsert: true })
  return { error: error as Error | null }
}

// 서버에서 이미지 blob → Storage 업로드
export async function uploadCardImageFromUrl(
  recordingId: string,
  imageUrl: string,
): Promise<string> {
  const res = await fetch(imageUrl)
  if (!res.ok) throw new Error(`이미지 다운로드 실패: ${res.status}`)
  const blob = await res.blob()
  const path = `${recordingId}.png`

  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const { error } = await sb.storage
    .from(CARD_BUCKET)
    .upload(path, blob, { contentType: 'image/png', upsert: true })
  if (error) throw new Error(`Storage 업로드 실패: ${error.message}`)

  return path
}

// 서버에서 Base64 이미지 → Storage 업로드
export async function uploadCardImageFromBase64(
  recordingId: string,
  base64Data: string,
): Promise<string> {
  const buffer = Buffer.from(base64Data, 'base64')
  const path = `${recordingId}.png`

  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const { error } = await sb.storage
    .from(CARD_BUCKET)
    .upload(path, buffer, { contentType: 'image/png', upsert: true })
  if (error) throw new Error(`Storage 업로드 실패: ${error.message}`)

  return path
}
