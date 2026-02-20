"use client";

import { useEffect, useRef, useState } from "react";

export function useClock(eventToken: string) {
  const [payload, setPayload] = useState<any>(null);
  const [estimatedNow, setEstimatedNow] = useState<number>(Date.now());

  const offsetRef = useRef(0);

  // Smooth local ticker (keeps countdown moving even when server polling is infrequent)
  useEffect(() => {
    const t = setInterval(() => {
      const localNow = Date.now();
      setEstimatedNow(localNow + offsetRef.current);
    }, 250);
    return () => clearInterval(t);
  }, []);

  // Server drift correction (demo-friendly: poll every 60 seconds)
  useEffect(() => {
    let alive = true;

    async function poll() {
      try {
        const res = await fetch(`/api/demo/clock/${eventToken}`, { cache: "no-store" });
        const data = await res.json();

        if (!alive) return;

        const localNow = Date.now();
        const newOffset = data.serverNow - localNow;
        const oldOffset = offsetRef.current;

        // Smooth small drift, snap big drift
        const drift = Math.abs(newOffset - oldOffset);
        offsetRef.current = drift > 2000 ? newOffset : oldOffset * 0.8 + newOffset * 0.2;

        setPayload(data);
      } catch {
        // ignore (kiosk should keep running)
      }
    }

    poll();
    const i = setInterval(poll, 60000); // ✅ 60s poll

    return () => {
      alive = false;
      clearInterval(i);
    };
  }, [eventToken]);

  return { payload, estimatedNow };
}

