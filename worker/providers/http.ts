import {
  ProviderCancelledError,
  type ProviderRuntimeDependencies,
} from "./contracts";

export type ProviderHttpFailureKind = "UNAUTHORIZED" | "RATE_LIMITED" | "UNAVAILABLE" | "MALFORMED_RESPONSE";

export class ProviderHttpError extends Error {
  constructor(
    readonly kind: ProviderHttpFailureKind,
    readonly status: number,
    readonly retryAfterMs: number | null = null,
  ) {
    super("Provider HTTP request failed");
    this.name = "ProviderHttpError";
  }
}

export class ProviderTimeoutError extends Error {
  constructor() {
    super("Provider operation exceeded its deadline");
    this.name = "ProviderTimeoutError";
  }
}

export class ProviderMalformedResponseError extends Error {
  constructor() {
    super("Provider returned an invalid response");
    this.name = "ProviderMalformedResponseError";
  }
}

function setTimer(dependencies: ProviderRuntimeDependencies, callback: () => void, delayMs: number): unknown {
  return dependencies.timer
    ? dependencies.timer.set(callback, delayMs)
    : setTimeout(callback, delayMs);
}

function clearTimer(dependencies: ProviderRuntimeDependencies, handle: unknown): void {
  if (dependencies.timer) dependencies.timer.clear(handle);
  else clearTimeout(handle as ReturnType<typeof setTimeout>);
}

function retryAfter(value: string | null, dependencies: ProviderRuntimeDependencies): number | null {
  if (!value) return null;
  const seconds = Number(value.trim());
  if (Number.isFinite(seconds) && seconds >= 0 && seconds <= Number.MAX_SAFE_INTEGER / 1_000) return Math.round(seconds * 1_000);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, timestamp - dependencies.now().getTime());
}

async function readBodyBounded(response: Response, maxBytes: number): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) throw new ProviderMalformedResponseError();
  if (!response.body) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) throw new ProviderMalformedResponseError();
    return text;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new ProviderMalformedResponseError();
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }

  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(combined);
  } catch {
    throw new ProviderMalformedResponseError();
  }
}

export async function requestJson(
  dependencies: ProviderRuntimeDependencies,
  url: string,
  init: RequestInit,
  parentSignal: AbortSignal,
): Promise<unknown> {
  try {
    return await withProviderDeadline(dependencies, parentSignal, async signal => {
      const response = await dependencies.http(url, { ...init, signal, redirect: "error" });
      const rateLimitRemaining = response.headers.get("x-ratelimit-remaining");
      if (response.status === 403 && (rateLimitRemaining === "0" || response.headers.has("retry-after"))) {
        throw new ProviderHttpError(
          "RATE_LIMITED",
          response.status,
          retryAfter(response.headers.get("retry-after"), dependencies),
        );
      }
      if (response.status === 401 || response.status === 403) {
        throw new ProviderHttpError("UNAUTHORIZED", response.status);
      }
      if (response.status === 429) {
        throw new ProviderHttpError("RATE_LIMITED", response.status, retryAfter(response.headers.get("retry-after"), dependencies));
      }
      if (response.status >= 500 || response.status === 408) {
        throw new ProviderHttpError("UNAVAILABLE", response.status);
      }
      if (!response.ok) throw new ProviderHttpError("MALFORMED_RESPONSE", response.status);
      const body = await readBodyBounded(response, dependencies.maxResponseBytes);
      try {
        return JSON.parse(body) as unknown;
      } catch {
        throw new ProviderMalformedResponseError();
      }
    });
  } catch (error) {
    if (error instanceof ProviderCancelledError || error instanceof ProviderTimeoutError
      || error instanceof ProviderHttpError || error instanceof ProviderMalformedResponseError) throw error;
    throw new ProviderHttpError("UNAVAILABLE", 0);
  }
}

export async function requestText(
  dependencies: ProviderRuntimeDependencies,
  url: string,
  init: RequestInit,
  parentSignal: AbortSignal,
): Promise<string> {
  try {
    return await withProviderDeadline(dependencies, parentSignal, async signal => {
      const response = await dependencies.http(url, { ...init, signal, redirect: "error" });
      const rateLimitRemaining = response.headers.get("x-ratelimit-remaining");
      if (response.status === 403 && (rateLimitRemaining === "0" || response.headers.has("retry-after"))) {
        throw new ProviderHttpError(
          "RATE_LIMITED", response.status,
          retryAfter(response.headers.get("retry-after"), dependencies),
        );
      }
      if (response.status === 401 || response.status === 403) throw new ProviderHttpError("UNAUTHORIZED", response.status);
      if (response.status === 429) {
        throw new ProviderHttpError(
          "RATE_LIMITED", response.status,
          retryAfter(response.headers.get("retry-after"), dependencies),
        );
      }
      if (response.status >= 500 || response.status === 408) throw new ProviderHttpError("UNAVAILABLE", response.status);
      if (!response.ok) throw new ProviderHttpError("MALFORMED_RESPONSE", response.status);
      return readBodyBounded(response, dependencies.maxResponseBytes);
    });
  } catch (error) {
    if (error instanceof ProviderCancelledError || error instanceof ProviderTimeoutError
      || error instanceof ProviderHttpError || error instanceof ProviderMalformedResponseError) throw error;
    throw new ProviderHttpError("UNAVAILABLE", 0);
  }
}

export async function withProviderDeadline<T>(
  dependencies: ProviderRuntimeDependencies,
  parentSignal: AbortSignal,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  if (parentSignal.aborted) throw new ProviderCancelledError();
  const controller = new AbortController();
  let timedOut = false;
  let rejectTimeout: (reason: unknown) => void = () => undefined;
  let rejectCancellation: (reason: unknown) => void = () => undefined;
  const timeoutPromise = new Promise<never>((_, reject) => { rejectTimeout = reject; });
  const cancellationPromise = new Promise<never>((_, reject) => { rejectCancellation = reject; });
  const onParentAbort = () => {
    controller.abort(parentSignal.reason);
    rejectCancellation(new ProviderCancelledError());
  };
  parentSignal.addEventListener("abort", onParentAbort, { once: true });
  const timeout = setTimer(dependencies, () => {
    timedOut = true;
    controller.abort(new ProviderTimeoutError());
    rejectTimeout(new ProviderTimeoutError());
  }, dependencies.timeoutMs);

  try {
    return await Promise.race([
      operation(controller.signal),
      timeoutPromise,
      cancellationPromise,
    ]);
  } catch (error) {
    if (error instanceof ProviderCancelledError) throw error;
    if (parentSignal.aborted) throw new ProviderCancelledError();
    if (timedOut || error instanceof ProviderTimeoutError) throw new ProviderTimeoutError();
    if (error instanceof ProviderHttpError || error instanceof ProviderMalformedResponseError) throw error;
    throw new ProviderHttpError("UNAVAILABLE", 0);
  } finally {
    clearTimer(dependencies, timeout);
    parentSignal.removeEventListener("abort", onParentAbort);
  }
}

export function isProviderHttpFailure(error: unknown): error is ProviderHttpError {
  return error instanceof ProviderHttpError;
}
