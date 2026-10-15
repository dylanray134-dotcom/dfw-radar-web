"use client";

import { useEffect } from "react";

function screenWakeLock(): WakeLock | null {
  if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return null;
  const api = navigator.wakeLock;
  if (!api || typeof api.request !== "function") return null;
  return api;
}

async function releaseSentinel(sentinel: WakeLockSentinel | null): Promise<void> {
  if (!sentinel || sentinel.released) return;
  try {
    await sentinel.release();
  } catch {
    // The browser may already have dropped the lock.
  }
}

/**
 * Holds a screen wake lock while `enabled` and the tab is visible.
 * Re-requests on visibilitychange. Unsupported browsers are a no-op.
 */
export function useScreenWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let sentinel: WakeLockSentinel | null = null;

    const release = () => {
      const current = sentinel;
      sentinel = null;
      void releaseSentinel(current);
    };

    const request = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      const api = screenWakeLock();
      if (!api) return;
      try {
        const next = await api.request("screen");
        if (stopped || document.visibilityState !== "visible") {
          await releaseSentinel(next);
          return;
        }
        const previous = sentinel;
        sentinel = next;
        if (previous && previous !== next) void releaseSentinel(previous);
      } catch {
        // Denied, insecure context, or no Screen Wake Lock support.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void request();
      else release();
    };

    void request();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisibility);
      release();
    };
  }, [enabled]);
}
