import { AsyncLocalStorage } from "node:async_hooks";

const store = new AsyncLocalStorage<Env>();

export function runWithEnv<T>(env: Env, fn: () => Promise<T>): Promise<T> {
  return store.run(env, fn);
}

export function getEnv(): Env {
  const env = store.getStore();
  if (!env) throw new Error("Cloudflare env not available in this context.");
  return env;
}
