"use client";

import React from "react";

type Props = {
  id: string;
  title: string;
  count?: number;
  defaultOpen?: boolean;
  rightSlot?: React.ReactNode; // visible even when collapsed
  children: React.ReactNode;
};

export default function CollapsiblePanel({
  id,
  title,
  count,
  defaultOpen = true,
  rightSlot,
  children,
}: Props) {
  const storageKey = `eplt.panel.${id}`;
  const [open, setOpen] = React.useState<boolean>(defaultOpen);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw === null) return;
      setOpen(raw === "1");
    } catch {}
  }, [storageKey]);

  React.useEffect(() => {
    try {
      localStorage.setItem(storageKey, open ? "1" : "0");
    } catch {}
  }, [storageKey, open]);

  return (
    <div className="rounded-2xl border-[2px] border-emerald-900/80 shadow-[0_10px_0_rgba(0,0,0,0.35)] bg-emerald-950/75 backdrop-blur-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-emerald-200/10 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-3 min-w-0 text-left"
          aria-expanded={open}
        >
          <div className="text-emerald-50/90 select-none">{open ? "▾" : "▸"}</div>
          <div className="min-w-0">
            <div className="text-emerald-50 font-black tracking-tight truncate">{title}</div>
          </div>
          {typeof count === "number" ? (
            <div className="ml-2 text-emerald-100/85 tabular-nums text-sm font-black">{count}</div>
          ) : null}
        </button>

        <div className="flex items-center gap-2">{rightSlot}</div>
      </div>

      {open ? <div className="p-5">{children}</div> : null}
    </div>
  );
}
