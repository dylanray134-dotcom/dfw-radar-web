/** Abort an upstream fetch that has not finished within this window. */
export const UPSTREAM_TIMEOUT_MS = 10_000;

export function upstreamTimeout(): AbortSignal {
  return AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);
}
