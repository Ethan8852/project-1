export type RecordingStatus =
  | 'recorded'
  | 'stt_processing'
  | 'stt_done'
  | 'story_done'
  | 'card_done'

export interface SttWord {
  word: string
  start_ms: number
  end_ms: number
}

export interface Recording {
  id: string
  user_id: string
  question_id: string
  question_text: string
  audio_path: string
  duration_sec: number | null
  stt_text: string | null
  stt_words: SttWord[] | null
  story_text: string | null
  card_image_path: string | null
  card_image_scene: string | null
  share_token: string
  status: RecordingStatus
  created_at: string
  updated_at: string
}
