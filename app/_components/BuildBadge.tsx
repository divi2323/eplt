"use client";

import { useEffect, useState } from "react";

export default function BuildBadge() {
  const [build, setBuild] = useState("");

  useEffect(() => {
    fetch("/build.txt", { cache: "no-store" })
      .then((r) => (r.ok ? r.text() : ""))
      .then((t) => setBuild(t.trim()))
      .catch(() => {});
  }, []);

  if (!build) return null;

  return (
    <div className="px-3 py-2 text-xs opacity-70 select-text">
      {build}
    </div>
  );
}

