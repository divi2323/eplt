'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

function prettyTitle(pathname: string): string {
  const p = pathname || '/';
  // Known demo routes
  if (p.startsWith('/demo/run')) return 'Run Event';
  if (p.startsWith('/demo/players')) return 'Players';
  if (p.startsWith('/demo/kiosk/clock')) return 'Kiosk Clock';
  if (p === '/' || p === '/demo') return 'Home';
  // Fallback: last segment
  const seg = p.split('/').filter(Boolean).pop() || 'Home';
  const nice = seg.replace(/[-_]/g, ' ');
  return nice.replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function RouteTitleClient() {
  const pathname = usePathname();

  useEffect(() => {
    const name = prettyTitle(pathname);
    document.title = `EPLT - ${name}`;
  }, [pathname]);

  return null;
}
