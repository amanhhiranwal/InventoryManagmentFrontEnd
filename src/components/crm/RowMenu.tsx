"use client";

import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * The row actions menu, drawn over the page rather than inside the table.
 *
 * Absolutely positioned inside a cell, the menu belonged to the table's
 * scroll box: the last rows' menus were clipped at the bottom edge and
 * you had to scroll the table to read them, which also moved the row the
 * menu belonged to. This renders the panel into the body and pins it to
 * the button's position on screen, so it sits above everything and opens
 * upwards when there is no room below.
 *
 * It follows the button while the page scrolls and closes on an outside
 * click, Escape, or a scroll of the container it was opened from.
 */
export function RowMenu({
  open,
  onClose,
  anchor,
  children,
  width = 208,
  align = "right",
}: {
  open: boolean;
  onClose: () => void;
  /** The control the menu hangs from. */
  anchor: HTMLElement | null;
  children: ReactNode;
  width?: number;
  /** Which edge of the menu lines up with the button. */
  align?: "left" | "right";
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState<{ top: number; left: number } | null>(null);

  /* Measured after paint, so the panel's real height decides whether it
     opens downwards or upwards rather than a guess at it. */
  useLayoutEffect(() => {
    if (!open || !anchor) {
      setBox(null);
      return;
    }

    function place() {
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const height = panelRef.current?.offsetHeight ?? 220;
      const margin = 8;

      const below = window.innerHeight - rect.bottom;
      const openUp = below < height + margin && rect.top > height + margin;

      const left =
        align === "right" ? rect.right - width : rect.left;

      setBox({
        top: openUp ? rect.top - height - 4 : rect.bottom + 4,
        // Keep the panel on screen on a narrow window.
        left: Math.min(
          Math.max(margin, left),
          window.innerWidth - width - margin,
        ),
      });
    }

    place();

    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);

    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, anchor, width, align]);

  useEffect(() => {
    if (!open) return;

    function handleDown(event: MouseEvent) {
      const target = event.target as Node;

      if (panelRef.current?.contains(target)) return;
      if (anchor?.contains(target)) return;

      onClose();
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("mousedown", handleDown);
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("mousedown", handleDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, anchor, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panelRef}
      role="menu"
      /* The pages that own these menus close them from a document
         mousedown handler that spares anything inside [data-row-menu].
         In the body the panel is no longer inside the cell that carries
         that marker, so it carries its own - otherwise the menu is
         unmounted on mousedown and the click never reaches the item. */
      data-row-menu
      style={{
        position: "fixed",
        top: box?.top ?? -9999,
        left: box?.left ?? -9999,
        width,
        // Hidden until it has been measured, so it never flashes in the
        // wrong corner on the first frame.
        visibility: box ? "visible" : "hidden",
      }}
      className="z-[200] rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-[#0d2336] dark:bg-[#051422]"
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
}
