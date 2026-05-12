import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export async function requireUserId(): Promise<string> {
  const { getEnv } = await import("../runtime/context");
  const { verifyJWT } = await import("../runtime/crypto");
  const { getSessionToken } = await import("../runtime/session");
  const token = getSessionToken();
  if (!token) throw new Error("로그인이 필요합니다.");
  const payload = await verifyJWT(token, getEnv().JWT_SECRET);
  if (!payload) throw new Error("세션이 만료되었습니다. 다시 로그인해 주세요.");
  return payload.sub as string;
}

// ── 회원가입 ─────────────────────────────────────────────────────────────

export const register = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string().email("올바른 이메일을 입력해 주세요."),
      password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다."),
      storeName: z.string().min(1, "매장명을 입력해 주세요."),
    }),
  )
  .handler(async ({ data }) => {
    const { getDB, getEnv } = await import("../runtime/context");
    const { hashPassword, signJWT } = await import("../runtime/crypto");
    const { setSessionCookie } = await import("../runtime/session");
    const db = getDB();
    const env = getEnv();

    const existing = await db.prepare("SELECT id FROM users WHERE email = ?").bind(data.email).first();
    if (existing) throw new Error("이미 사용 중인 이메일입니다.");

    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(data.password);

    await db
      .prepare("INSERT INTO users (id, email, password_hash, store_name) VALUES (?, ?, ?, ?)")
      .bind(id, data.email, passwordHash, data.storeName)
      .run();

    const token = await signJWT({ sub: id, email: data.email }, env.JWT_SECRET);
    setSessionCookie(token);

    return { id, email: data.email, storeName: data.storeName };
  });

// ── 로그인 ──────────────────────────────────────────────────────────────

export const login = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    const { getDB, getEnv } = await import("../runtime/context");
    const { verifyPassword, signJWT } = await import("../runtime/crypto");
    const { setSessionCookie } = await import("../runtime/session");
    const db = getDB();
    const env = getEnv();

    type UserRow = { id: string; email: string; password_hash: string; store_name: string };
    const user = await db
      .prepare("SELECT id, email, password_hash, store_name FROM users WHERE email = ?")
      .bind(data.email)
      .first<UserRow>();
    if (!user) throw new Error("이메일 또는 비밀번호가 올바르지 않습니다.");

    const valid = await verifyPassword(data.password, user.password_hash);
    if (!valid) throw new Error("이메일 또는 비밀번호가 올바르지 않습니다.");

    const token = await signJWT({ sub: user.id, email: user.email }, env.JWT_SECRET);
    setSessionCookie(token);

    return { id: user.id, email: user.email, storeName: user.store_name };
  });

// ── 로그아웃 ─────────────────────────────────────────────────────────────

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const { clearSessionCookie } = await import("../runtime/session");
  clearSessionCookie();
  return { ok: true };
});

// ── 현재 로그인 사용자 정보 ───────────────────────────────────────────────

export const getMe = createServerFn({ method: "GET" }).handler(async () => {
  const { getDB, getEnv } = await import("../runtime/context");
  const { verifyJWT } = await import("../runtime/crypto");
  const { getSessionToken } = await import("../runtime/session");
  const token = getSessionToken();
  if (!token) return null;

  const payload = await verifyJWT(token, getEnv().JWT_SECRET);
  if (!payload) return null;

  type UserRow = { id: string; email: string; store_name: string; naver_place_id: string | null; naver_address: string | null };
  const user = await getDB()
    .prepare("SELECT id, email, store_name, naver_place_id, naver_address FROM users WHERE id = ?")
    .bind(payload.sub)
    .first<UserRow>();
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    storeName: user.store_name,
    naverPlaceId: user.naver_place_id,
    naverAddress: user.naver_address,
  };
});
