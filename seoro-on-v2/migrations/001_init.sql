-- ============================================================
-- 서로ON v2 초기 스키마
-- Supabase 대시보드 > SQL Editor에서 실행
-- ============================================================

-- recordings 테이블
CREATE TABLE IF NOT EXISTS recordings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL,

  question_id       TEXT NOT NULL,
  question_text     TEXT NOT NULL,

  audio_path        TEXT NOT NULL,
  duration_sec      INTEGER,

  stt_text          TEXT,
  stt_words         JSONB,

  story_text        TEXT,

  card_image_path   TEXT,
  card_image_scene  TEXT,

  share_token       TEXT UNIQUE DEFAULT encode(gen_random_bytes(10), 'hex'),

  -- recorded | stt_processing | stt_done | story_done | card_done
  status            TEXT NOT NULL DEFAULT 'recorded',

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recordings_updated_at
  BEFORE UPDATE ON recordings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_recordings_user_id ON recordings(user_id);
CREATE INDEX IF NOT EXISTS idx_recordings_share   ON recordings(share_token);

-- RLS 비활성화 (테스트 계정 단일 운영)
ALTER TABLE recordings DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- Storage 버킷 (대시보드에서 수동 생성 또는 아래 SQL 실행)
-- ============================================================

-- audio 버킷: 녹음 파일 저장 (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio', 'audio', true)
ON CONFLICT (id) DO NOTHING;

-- card-images 버킷: 카드뉴스 이미지 저장 (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('card-images', 'card-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage 정책: anon 전체 허용 (테스트용)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'audio public all' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "audio public all" ON storage.objects
      FOR ALL USING (bucket_id = 'audio') WITH CHECK (bucket_id = 'audio');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'card-images public all' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "card-images public all" ON storage.objects
      FOR ALL USING (bucket_id = 'card-images') WITH CHECK (bucket_id = 'card-images');
  END IF;
END $$;

-- ============================================================
-- questions 테이블 (최신 와이어프레임 스키마 적용)
-- ============================================================
CREATE TABLE IF NOT EXISTS questions (
  id              BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  question_id     TEXT, -- 고유 식별 코딩용 키값
  part_name       TEXT,
  main_question   TEXT NOT NULL,
  sub_questions   TEXT[], -- 보조질문 배열
  created_at      TIMESTAMPTZ DEFAULT now()
);
