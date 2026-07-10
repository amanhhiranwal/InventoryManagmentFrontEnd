"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

import LoginForm from "@/features/auth/components/LoginForm";

const icons = [
  "/gridicon/1.svg",
  "/gridicon/2.svg",
  "/gridicon/3.svg",
  "/gridicon/4.svg",
];

const GRID = 70;

export default function LoginPage() {
  const [isDesktop, setIsDesktop] = useState(false);

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

    setMouse({
      x,

      y,
    });

    setHoverCell({
      col: Math.floor(x / GRID),

      row: Math.floor(y / GRID),
    });
  };

  const spotlight = `

radial-gradient(
  380px at ${mouse.x}px ${mouse.y}px,
  rgba(246,246,246,0.18) 0%,
  rgba(246,246,246,0.10) 30%,
  rgba(246,246,246,0.05) 50%,
  transparent 75%
)

`;

  const mask = `

  radial-gradient(
    260px at ${mouse.x}px ${mouse.y}px,
    black 0%,
    rgba(0,0,0,0.5) 45%,
    transparent 75%
  )

  `;

  return (
    <main
      className="
      relative
      flex
      min-h-screen
      items-center
      justify-center
      overflow-hidden
      bg-black
      px-4
      "

      onMouseMove={handleMouseMove}
    >
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
              rgba(0,0,0,0.08) 1px,
              transparent 1px
            ),

            linear-gradient(
              to bottom,
              rgba(0,0,0,0.08) 1px,
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
                  "

                style={{
                  left: cell.col * GRID + GRID / 2,

                  top: cell.row * GRID + GRID / 2,

                  transform: "translate(-50%,-50%)",

                  opacity: sequenceIndex === activeIcon ? 0.65 : 0,
                }}
              />
            );
          })}
        </div>
      )}

      {/* LOGIN FORM */}

      <div
        className="
        relative
        z-10
        w-full
        max-w-md
        "
      >
        <LoginForm />
      </div>
    </main>
  );
}
