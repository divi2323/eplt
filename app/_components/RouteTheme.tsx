'use client';

import { usePathname } from "next/navigation";
import { useEffect } from "react";

type ThemeVars = {
  bgImage: string;
};

const GREEN_THEME: ThemeVars = {
  bgImage: 'url("/assets/bg_green_1920.webp")',
};

export default function RouteTheme() {
  const pathname = usePathname();

  useEffect(() => {
    // v3.0 UI lock: green background on all pages.
    const root = document.documentElement;
    root.style.setProperty("--bg-image", GREEN_THEME.bgImage);
  }, [pathname]);

  return null;
}
