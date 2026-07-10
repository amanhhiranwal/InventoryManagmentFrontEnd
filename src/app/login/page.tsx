"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import LoginForm from "@/features/auth/components/LoginForm";
import { useUIStore } from "@/lib/store/ui.store";

const icons = [
  "/gridicon/1.svg",
  "/gridicon/2.svg",
  "/gridicon/3.svg",
  "/gridicon/4.svg",
];

const GRID = 70;

export default function LoginPage() {
  const [isDesktop, setIsDesktop] = useState(false);
  const { theme } = useUIStore();
  const [mouse, setMouse] = useState({
    x: -500,
    y: -500,
  });

  const [gridCells, setGridCells] = useState<any[]>([]);
  const [hoverCell, setHoverCell] = useState({
    col: -1,
    row: -1,
  });

  const [activeIcon, setActiveIcon] = useState(0);

  // Detect desktop after mount (avoid hydration mismatch)
  useEffect(() => {
    setIsDesktop(window.matchMedia("(pointer:fine)").matches);
  }, []);

  // Generate grid cells
  useEffect(() => {
    if (!isDesktop) return;

    const cols = Math.ceil(window.innerWidth / GRID);
    const rows = Math.ceil(window.innerHeight / GRID);
    const cells: any[] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let iconIndex;
        if (r % 2 === 0) {
          iconIndex = c % 2 === 0 ? 0 : 1;
        } else {
          iconIndex = c % 2 === 0 ? 2 : 3;
        }

        cells.push({
          row: r,
          col: c,
          icon: icons[iconIndex],
        });
      }
    }

    setGridCells(cells);
  }, [isDesktop]);

  // Icon animation
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIcon((prev) => (prev + 1) % 4);
    }, 1800);

    return () => clearInterval(interval);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (!isDesktop) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setMouse({ x, y });
    setHoverCell({
      col: Math.floor(x / GRID),
      row: Math.floor(y / GRID),
    });
  };

  // Theme-aware radial spotlight
  const spotlightColor = theme === "dark" 
    ? "rgba(14, 72, 115, 0.15)" 
    : "rgba(9, 46, 73, 0.06)";

  const spotlight = `
    radial-gradient(
      450px at ${mouse.x}px ${mouse.y}px,
      ${spotlightColor} 0%,
      transparent 80%
    )
  `;

  const mask = `
    radial-gradient(
      280px at ${mouse.x}px ${mouse.y}px,
      black 0%,
      rgba(0,0,0,0.4) 50%,
      transparent 80%
    )
  `;

  // Grid line styling
  const gridLineColor = theme === "dark"
    ? "rgba(13, 35, 54, 0.4)"
    : "rgba(9, 46, 73, 0.05)";

  return (
    <main
      className="
        relative
        flex
        min-h-screen
        items-center
        justify-center
        overflow-hidden
        bg-slate-50
        dark:bg-[#030d16]
        px-4
        transition-colors
        duration-300
      "
      onMouseMove={handleMouseMove}
    >
      {/* Background Soft Ambient Glows */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[350px] sm:w-[500px] h-[350px] sm:h-[500px] bg-primary/5 dark:bg-primary/10 rounded-full blur-[80px] sm:blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[350px] sm:w-[500px] h-[350px] sm:h-[500px] bg-sky-400/5 dark:bg-[#0e4873]/10 rounded-full blur-[80px] sm:blur-[120px] pointer-events-none z-0" />

      {/* CURSOR LIGHT EFFECT */}
      {isDesktop && (
        <div
          className="
            pointer-events-none
            absolute
            inset-0
            z-0
          "
          style={{
            background: spotlight,
          }}
        />
      )}

      {/* GRID */}
      {isDesktop && (
        <div
          className="
            pointer-events-none
            absolute
            inset-0
            z-[1]
          "
          style={{
            backgroundImage: `
              linear-gradient(
                to right,
                ${gridLineColor} 1px,
                transparent 1px
              ),
              linear-gradient(
                to bottom,
                ${gridLineColor} 1px,
                transparent 1px
              )
            `,
            backgroundSize: `${GRID}px ${GRID}px`,
            WebkitMaskImage: mask,
            maskImage: mask,
          }}
        />
      )}

      {/* ICON ANIMATION */}
      {isDesktop && (
        <div
          className="
            pointer-events-none
            absolute
            inset-0
            z-[2]
          "
          style={{
            WebkitMaskImage: mask,
            maskImage: mask,
          }}
        >
          {gridCells.map((cell, index) => {
            const dx = cell.col - hoverCell.col;
            const dy = cell.row - hoverCell.row;

            let sequenceIndex = -1;
            if (dx === 0 && dy === 0) sequenceIndex = 0;
            if (dx === 1 && dy === 0) sequenceIndex = 1;
            if (dx === 0 && dy === 1) sequenceIndex = 2;
            if (dx === 1 && dy === 1) sequenceIndex = 3;

            return (
              <Image
                key={index}
                src={cell.icon}
                alt=""
                width={28}
                height={28}
                className="
                  absolute
                  transition-opacity
                  duration-[1200ms]
                  dark:invert-0
                  invert-[0.2]
                "
                style={{
                  left: cell.col * GRID + GRID / 2,
                  top: cell.row * GRID + GRID / 2,
                  transform: "translate(-50%,-50%)",
                  opacity: sequenceIndex === activeIcon ? 0.4 : 0,
                }}
              />
            );
          })}
        </div>
      )}

      {/* LOGIN FORM CONTAINER */}
      <div
        className="
          relative
          z-10
          w-full
          max-w-md
          rounded-2xl
          bg-white/80
          dark:bg-[#051422]/65
          backdrop-blur-xl
          border
          border-slate-200/60
          dark:border-[#0d2336]/60
          shadow-2xl
          shadow-slate-200/50
          dark:shadow-none
          p-2
          sm:p-4
          transition-all
          duration-300
        "
      >
        <LoginForm />
      </div>
    </main>
  );
}
