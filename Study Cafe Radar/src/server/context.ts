import { getEnv as getEnvFromStore } from "./env-store";

export function getEnv(): Env {
  return getEnvFromStore();
}

export function getDB(): D1Database {
  return getEnv().DB;
}
