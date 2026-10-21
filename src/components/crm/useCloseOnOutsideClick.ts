"use client";

import { useEffect, useRef } from "react";

/**
 * Close a popover when the click lands outside it.
 *
 * Put the returned ref on the element that holds both the popover and
 * the control that opens it - otherwise clicking the control closes the
 * popover and opens it again in the same gesture, and it never shuts.
 *
 * Listens on mousedown so the popover is gone before the click settles,
 * and only while it is open, so a closed list page carries no listener.
 */
export function useCloseOnOutsideClick<T extends HTMLElement = HTMLDivElement>(
  open: boolean,
  onClose: () => void,
) {
  const ref = useRef<T | null>(null);

  /* Held in a ref so a handler rebuilt on every render does not detach
     and reattach the listener on every render with it. */
  const close = useRef(onClose);

  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    function handle(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) close.current();
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") close.current();
    }

    document.addEventListener("mousedown", handle);
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("mousedown", handle);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return ref;
}
