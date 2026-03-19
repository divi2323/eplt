'use client';

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const CHIP_SIZE = 44;

const NAV: Array<{ href: string; label: string; icon: ReactNode; chip?: boolean }> = [
  {
    href: "/admin",
    label: "Dashboard",
    chip: true,
    icon: (
      <img
        src="/assets/poker_chip_spade.png"
        width={CHIP_SIZE}
        height={CHIP_SIZE}
        alt="Spade"
        style={{ borderRadius: 999, filter: "drop-shadow(0 3px 10px rgba(0,0,0,0.65))" }}
      />
    ),
  },
  {
    href: "/admin/leagues",
    label: "Leagues",
    chip: true,
    icon: (
      <img
        src="/assets/poker_chip_diamond.png"
        width={CHIP_SIZE}
        height={CHIP_SIZE}
        alt="Diamond"
        style={{ borderRadius: 999, filter: "drop-shadow(0 3px 10px rgba(0,0,0,0.65))" }}
      />
    ),
  },
  {
    href: "/admin/events",
    label: "Events",
    chip: true,
    icon: (
      <img
        src="/assets/poker_chip_club.png"
        width={CHIP_SIZE}
        height={CHIP_SIZE}
        alt="Club"
        style={{ borderRadius: 999, filter: "drop-shadow(0 3px 10px rgba(0,0,0,0.65))" }}
      />
    ),
  },
  {
    href: "/admin/players",
    label: "Players",
    chip: true,
    icon: (
      <img
        src="/assets/poker_chip_heart.png"
        width={CHIP_SIZE}
        height={CHIP_SIZE}
        alt="Heart"
        style={{ borderRadius: 999, filter: "drop-shadow(0 3px 10px rgba(0,0,0,0.65))" }}
      />
    ),
  },
  {
    href: "/admin/run",
    label: "Run",
    chip: true,
    icon: (
      <img
        src="/assets/trumpets_with_banners_black_256.png"
        width={40}
        height={40}
        alt="Run"
        style={{ filter: "drop-shadow(0 3px 10px rgba(0,0,0,0.65))" }}
      />
    ),
  },
  {
    href: "/admin/register",
    label: "Register",
    chip: true,
    icon: (
      <img
        src="/assets/register_scroll_256.png"
        width={40}
        height={40}
        alt="Register"
        style={{ filter: "drop-shadow(0 3px 10px rgba(0,0,0,0.65))" }}
      />
    ),
  },
];

const BUILD = "3086";

export default function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div style={{ minHeight: "100vh" }}>
      <header style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
            <img src="/assets/crest_256.png" width={34} height={34} alt="EPLT" style={{ borderRadius: 10 }} />
            <div>
              <div style={{ fontWeight: 1000, display: "flex", alignItems: "baseline", gap: 8 }}>
  <span>Elite Poker League Tool</span>
  {pathname === "/" && (
    <span style={{ fontSize: 12, fontWeight: 800, color: "var(--muted)" }}>build {BUILD}</span>
  )}
</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>Layout locked</div>
            </div>
          </Link>
        </div>
      </header>

      <div className="container" style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16, paddingTop: 16 }}>
        <aside className="panel" style={{ padding: 12 }}>
          <nav style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {NAV.map(n => {
              const p = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;
              const href = n.href.endsWith("/") && n.href !== "/" ? n.href.slice(0, -1) : n.href;
              const isActive = href === "/admin" ? p === "/admin" : (p === href || p.startsWith(href + "/"));
              const iconBox = n.chip ? CHIP_SIZE : 26;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className="epltNavLink"
                  data-chip={n.chip ? "1" : "0"}
                  data-active={isActive ? "1" : "0"}
                  style={{
                    display: "flex",
                    gap: 12,
                    padding: n.chip ? "10px 10px" : "10px 12px",
                    borderRadius: 14,
                    alignItems: "center",
                    textDecoration: "none",
                    background: isActive ? "rgba(0,0,0,0.22)" : "transparent",
                    border: isActive ? "1px solid rgba(255,255,255,0.14)" : "1px solid transparent",
                    boxShadow: isActive ? "inset 0 0 0 1px rgba(255,215,120,0.10)" : "none",
                    color: isActive ? "rgba(255,255,255,0.98)" : "rgba(255,255,255,0.92)",
                  }}
                >
                  <span style={{ width: iconBox, height: iconBox, display: "grid", placeItems: "center", flex: "0 0 auto" }}>
                    <span
                      className="epltNavIcon"
                      style={{
                        display: "grid",
                        placeItems: "center",
                        transform: n.chip ? (isActive ? "scale(1.08)" : "scale(1.00)") : "none",
                        transition: "transform 140ms ease",
                      }}
                    >
                      {n.icon}
                    </span>
                  </span>
                  <span style={{ fontWeight: 900, letterSpacing: 0.2 }}>{n.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="panel" style={{ padding: 16 }}>
          {children}
        </main>
      </div>
    
      <style jsx global>{`

        .epltNavLink[data-chip="0"] .epltNavIcon {
          transition: transform 140ms ease, filter 140ms ease;
          transform-origin: center;
        }
        .epltNavLink[data-chip="0"]:hover .epltNavIcon {
          transform: scale(1.08) translateY(-1px);
          filter: drop-shadow(0 5px 14px rgba(0,0,0,0.70));
        }

        /* EPLT nav chip "pop" hover effect (v2.3-style) */
        .epltNavLink[data-chip="1"] .epltNavIcon {
          transition: transform 160ms ease, filter 160ms ease;
          transform-origin: center;
        }
        .epltNavLink[data-chip="1"][data-active="1"] .epltNavIcon {
          transform: scale(1.10) !important;
        }
        .epltNavLink[data-chip="1"]:hover .epltNavIcon {
          transform: scale(1.22) translateY(-2px) rotate(-2deg) !important;
          filter: drop-shadow(0 6px 16px rgba(0,0,0,0.75)) !important;
        }
      `}</style>
</div>
  );
}
