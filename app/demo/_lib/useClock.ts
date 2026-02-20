"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type AnyObj = Record<string, any>;

type UseClockResult = {
  payload: AnyObj | null;
  estimatedNow: number; // local time estimate of "server now", smoothed
  refreshNow: () => Promise<void>;
};

/**
 * Demo clock hook
 * - Local JS time ticks smoothly
 * - Server polled for authoritative timestamps
 * - Default poll: 60s (demo-friendly; lets the clock run without constant polling)
 */
export function useClock(eventToken: string): UseClockResult {
  const [payload, setPayload] = useState<AnyObj | null>(null);

  // estimatedNow is what the UI should consider "server now"
  const [estimatedNow, setEstimatedNow] = useState<number>(() => Date.now());

  const lastPollLocalMsRef = useRef<number>(0);
  const lastServerNowRef = useRef<number>(0);

  const clockUrl = useMemo(() => `/api/demo/clock/${eventToken}`, [eventToken]);

  const FAST_POLL_MS = 2000; // until first successful payload
  const SLOW_POLL_MS = 60000; // after success
  const hasPayloadRef = useRef<boolean>(false);

  const pull = useCallback(async () => {
    const t0 = Date.now();
    const res = await fetch(clockUrl, { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as AnyObj;

    // Expect: { serverNow: number, ...payload }
    const serverNow = Number(data.serverNow ?? Date.now());

    lastPollLocalMsRef.current = t0;
    lastServerNowRef.current = serverNow;

    setPayload(data);
    setEstimatedNow(serverNow);
    hasPayloadRef.current = true;
  }, [clockUrl]);

  const refreshNow = useCallback(async () => {
    try {
      await pull();
    } catch {
      // ignore
    }
  }, [pull]);

  useEffect(() => {
    refreshNow();

    const poll = async () => {
      try {
        await pull();
      } catch {
        // ignore
      }
    };

    const id = setInterval(() => {
      poll();
    }, hasPayloadRef.current ? SLOW_POLL_MS : FAST_POLL_MS);

    return () => clearInterval(id);
  }, [refreshNow, pull, FAST_POLL_MS, SLOW_POLL_MS]);

  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now();
      const baseLocal = lastPollLocalMsRef.current;
      const baseServer = lastServerNowRef.current;

      if (!baseLocal || !baseServer) {
        setEstimatedNow(t);
        return;
      }

      const est = baseServer + (t - baseLocal);
      setEstimatedNow(est);
    }, 250);

    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      refreshNow();
    }, 60_000);

    return () => clearInterval(id);
  }, [refreshNow]);

  // ADAPTIVE_REFRESH: when we're within a few seconds of rollover, poll faster so the UI
  // snaps to the new level immediately (no "stuck at 0:00" while waiting on the 60s poll).
  useEffect(() => {
    if (!payload?.clock) return;

    const state = String(payload.clock.state ?? "").toUpperCase();
    if (state !== "RUNNING") return;

    const snapServerNow = Number(payload.serverNow ?? lastServerNowRef.current ?? Date.now());
    const snapRemaining = Number(payload.clock.msRemainingInLevel ?? 0);

    // Estimated remaining based on local smooth clock since the snapshot.
    const elapsedSinceSnap = Math.max(0, estimatedNow - snapServerNow);
    const remaining = Math.max(0, snapRemaining - elapsedSinceSnap);

    // If we're close to rollover, refresh aggressively.
    const aggressiveMs = remaining <= 5_000 ? 250 : remaining <= 15_000 ? 1_000 : null;
    if (!aggressiveMs) return;

    const id = window.setInterval(() => {
      refreshNow();
    }, aggressiveMs);

    return () => window.clearInterval(id);
  }, [payload, estimatedNow, refreshNow]);

  return { payload, estimatedNow, refreshNow };
}
