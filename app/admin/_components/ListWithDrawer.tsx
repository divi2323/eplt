"use client";

import type { ReactNode } from "react";
import { useDeferredValue, useLayoutEffect, useMemo, useState } from "react";

export default function ListWithDrawer({
  title,
  iconSrc,
  helpText,
  filters,
  columns,
  items,
  newLabel = "New",
}: {
  title: string;
  iconSrc?: string;
  helpText?: string;
  filters?: ReactNode;
  columns: { key: string; label: string; mono?: boolean }[];
  items: any[];
  newLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [row, setRow] = useState<any>(null);

  // Fast client-side search (future-proof: keeps UI snappy without server trips)
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const filteredItems = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return items;
    return (items || []).filter((r) => {
      // Match any primitive field on the row (fast, in-memory)
      const parts: string[] = [];
      for (const v of Object.values(r ?? {})) {
        if (v == null) continue;
        const t = typeof v;
        if (t === "string" || t === "number" || t === "boolean") parts.push(String(v));
      }
      // Also include column-derived values in case rows are computed
      for (const c of columns) parts.push(String((r as any)?.[c.key] ?? ""));
      return parts.join(" ").toLowerCase().includes(q);
    });
  }, [items, columns, deferredQuery]);

  const CLOSE_MS = 520;
  const closeDrawer = () => {
    // Allow close animation to play before unmounting.
    setClosing(true);
    window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, CLOSE_MS);
  };

  // Prevent the browser from flashing scrollbars when the drawer animates in/out.
  // Some transforms can temporarily overflow the viewport and trigger a scrollbar
  // for a single frame. We lock scrolling while the drawer is open.
  useLayoutEffect(() => {
    if (!open) return;

    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.classList.add("epltDrawerOpen");

    return () => {
      body.classList.remove("epltDrawerOpen");
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, [open]);

  return (
    <>
      {/* Header layout (consistent across CRUD pages) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "78px max-content minmax(0, 1fr) max-content",
          width: "100%",
          minWidth: 0,
          gridTemplateRows: "auto auto",
          columnGap: 12,
          rowGap: 10,
          alignItems: "stretch",
        }}
      >
        {/* Chip spans 2 rows */}
        {iconSrc ? (
          <img
            src={iconSrc}
            width={78}
            height={78}
            alt={title}
            style={{
            gridColumn: "1",
            gridRow: "1 / span 2",
              borderRadius: 999,
              filter: "drop-shadow(0 3px 10px rgba(0,0,0,0.65))",
              alignSelf: "center",
            }}
          />
        ) : null}

        {/* Title + muted (spans 2 rows) */}
        <div style={{ gridColumn: "2", gridRow: "1 / span 2", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <h1 style={{ margin: 0, fontSize: 44, lineHeight: 1.05 }}>{title}</h1>
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>{helpText ?? `Manage ${title}`}</div>
        </div>

        {/* Row 1: search (with clear icon) */}
        <div style={{ gridColumn: "3", gridRow: "1", position: "relative", alignSelf: "center", minWidth: 0 }}>
          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            style={{ width: "100%", paddingRight: 38 }}
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="btnGhost"
              style={{
                position: "absolute",
                right: 6,
                top: "50%",
                transform: "translateY(-50%)",
                padding: "6px 10px",
                lineHeight: 1,
              }}
            >
              ×
            </button>
          ) : null}
        </div>

        {/* Add button spans two rows (right-justified) */}
        <button
          className="btn"
          onClick={() => {
            setRow({});
            setClosing(false);
            setOpen(true);
          }}
          style={{
            gridColumn: "4",
            gridRow: "1 / span 2",
            justifySelf: "end",
            height: "100%",
            minHeight: 78,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            paddingInline: 18,
          }}
        >
          <span style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.05 }}>
            <span style={{ fontSize: 20, fontWeight: 900 }}>+</span>
            <span>{newLabel}</span>
          </span>
        </button>

        {/* Row 2: optional filter buttons */}
        <div style={{ gridColumn: "3", gridRow: "2", display: "flex", gap: 8, alignItems: "center", alignSelf: "center" }}>{filters ?? null}</div>
      </div>

      <div className="panel" style={{ padding: 0, marginTop: 12 }}>
        <table className="table">
          <thead>
            <tr>{columns.map(c => <th key={c.key}>{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {filteredItems.map((r, i) => (
              <tr key={i} className="rowHover" onClick={() => { setRow(r); setClosing(false); setOpen(true); }}>
                {columns.map(c => (
                  <td key={c.key} className={c.mono ? "mono" : ""}>{r[c.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className={`drawerWrap ${closing ? "drawerClosing" : "drawerOpening"}`}>
          <div className="drawerBackdrop" onClick={closeDrawer} />
          <div className="drawer">
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <h2>{row?.id ? "Edit" : "New"} {title.slice(0, -1)}</h2>
              <button className="btnGhost" onClick={closeDrawer}>Close</button>
            </div>
            <div className="hr" />
            <div>
              <div className="fieldLabel">Name</div>
              <input className="input" defaultValue={row?.name || ""} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
