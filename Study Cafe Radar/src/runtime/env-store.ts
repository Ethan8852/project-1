// Cloudflare Workers: AsyncLocalStorage for per-request env isolation
// Browser/Vite dev: simple module-scope fallback (single-threaded, no concurrency)
let _store: { run: <T>(env: Env, fn: () => Promise<T>) => Promise<T>; get: () => Env | undefined } | null = null;

function getStore() {
  if (_store) return _store;
  try {
    // Works in Cloudflare Workers and Node.js
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { AsyncLocalStorage } = require("node:async_hooks") as typeof import("node:async_hooks");
    const als = new AsyncLocalStorage<Env>();
    _store = { run: (env, fn) => als.run(env, fn), get: () => als.getStore() };
  } catch {
    // Browser dev fallback
    let _env: Env | undefined;
    _store = {
      run: async (env, fn) => { _env = env; try { return await fn(); } finally { _env = undefined; } },
      get: () => _env,
    };
  }
  return _store;
}

export function runWithEnv<T>(env: Env, fn: () => Promise<T>): Promise<T> {
  return getStore().run(env, fn);
}

export function getEnv(): Env {
  const env = getStore().get();
  if (!env) throw new Error("Cloudflare env not available in this context.");
  return env;
}
