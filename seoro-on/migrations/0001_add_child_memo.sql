-- Supabase SQL Editor에서 실행하세요
-- voice_answers 테이블에 자녀 메모 컬럼 추가

ALTER TABLE voice_answers
  ADD COLUMN IF NOT EXISTS child_memo TEXT;
