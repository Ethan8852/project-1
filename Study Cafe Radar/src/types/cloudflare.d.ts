interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  NAVER_CLIENT_ID: string;
  NAVER_CLIENT_SECRET: string;
}

declare module "cloudflare:test" {
  interface ProvidedEnv extends Env {}
}
