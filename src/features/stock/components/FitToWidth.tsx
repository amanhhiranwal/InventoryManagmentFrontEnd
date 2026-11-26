"use client";

/**
 * Shows a fixed-width sheet (GRN, gate pass) scaled down to fit its box,
 * the way Excel prints a sheet "fit to page width". Never scales up.
 */

import { ReactNode, useEffect, useRef, useState } from "react";

export default function FitToWidth({ width, children }: { width: number; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const node = box.current;
    if (!node) return;
    const fit = () => setScale(Math.min(1, node.clientWidth / width));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(node);
    return () => observer.disconnect();
  }, [width]);

  return (
    <div ref={box} className="w-full overflow-hidden">
      <div style={{ width, zoom: scale }}>{children}</div>
    </div>
  );
}
