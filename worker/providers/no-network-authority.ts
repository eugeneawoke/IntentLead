declare const noNetworkAuthorityBrand: unique symbol;
export type NoNetworkExecutionAuthority = { readonly [noNetworkAuthorityBrand]: true };

export type NoNetworkExecutionGuard = (() => void) & { authority: NoNetworkExecutionAuthority | null };

const authorityState = new WeakMap<object, { active: boolean }>();

export function isNoNetworkExecutionAuthority(value: unknown): value is NoNetworkExecutionAuthority {
  return typeof value === "object" && value !== null && authorityState.get(value)?.active === true;
}

export function installNoNetworkExecutionGuard(input: {
  enabled: boolean;
  allowedOrigin: string;
  fetchImplementation?: typeof fetch;
}): NoNetworkExecutionGuard {
  if (!input.enabled) {
    const disabled = (() => undefined) as NoNetworkExecutionGuard;
    disabled.authority = null;
    return disabled;
  }
  const original = input.fetchImplementation ?? globalThis.fetch;
  if (typeof original !== "function") throw new Error("Global fetch is unavailable for the no-network guard");
  const guarded: typeof fetch = async (request, init) => {
    const url = new URL(typeof request === "string" || request instanceof URL ? request : request.url);
    if (url.origin !== input.allowedOrigin) throw new Error(`No-network mode blocked network origin: ${url.origin}`);
    return original(request, { ...init, redirect: "error" });
  };
  const authority = Object.freeze({}) as NoNetworkExecutionAuthority;
  authorityState.set(authority, { active: true });
  globalThis.fetch = guarded;
  const restore = (() => {
    const state = authorityState.get(authority);
    if (state) state.active = false;
    globalThis.fetch = original;
  }) as NoNetworkExecutionGuard;
  restore.authority = authority;
  return restore;
}
