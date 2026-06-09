import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[서로ON] Supabase 환경변수가 없습니다.\n' +
      '.env.local에 NEXT_PUBLIC_SUPABASE_URL 과 NEXT_PUBLIC_SUPABASE_ANON_KEY 를 입력하세요.',
  );
}

// ⚠️ 팀 공통 단일 인스턴스 — 이 파일만 import 해서 사용할 것.
//    별도로 createClient() 호출 시 세션이 분리되어 로그인이 풀립니다.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,          // 브라우저 탭 닫아도 로그인 유지
    autoRefreshToken: true,        // 토큰 만료 전 자동 갱신
    detectSessionInUrl: true,      // 매직 링크 / 알림톡 딥링크 처리
  },
});

// ── 연결 테스트 헬퍼 (개발 시 사용) ──────────────────────────
export async function testConnection() {
  const { data, error } = await supabase.from('questions').select('id').limit(1);
  if (error) {
    console.error('[서로ON] Supabase 연결 실패:', error.message);
    return false;
  }
  console.log('[서로ON] Supabase 연결 성공 ✓', data);
  return true;
}
