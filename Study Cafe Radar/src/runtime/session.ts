import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";

export const SESSION_COOKIE = "session";

export function getSessionToken(): string | undefined {
  return getCookie(SESSION_COOKIE);
}

export function setSessionCookie(token: string): void {
  setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearSessionCookie(): void {
  deleteCookie(SESSION_COOKIE, { path: "/" });
}
