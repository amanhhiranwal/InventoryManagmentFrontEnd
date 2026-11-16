"use client";

/**
 * The AI add-on, sold beside Interactive Flat Panels.
 *
 * A panel line carries an AI choice (Yes / No). With any panel on Yes the
 * document gets one "AI" line (SKU "ADDON:AI"), priced from the single AI
 * rate on the Warranty Terms master, whose quantity is those panels added
 * up - six panels on AI, six units of AI. Its selling price can be changed
 * like any line, and the discount follows. Only Interactive Flat Panels
 * take AI; OPS modules, standees and the rest never show the choice.
 *
 * The server holds the same rule (sales_order_service.assert_ai_lines) and
 * prices the AI line itself, so nothing here decides what it costs.
 */

import { useEffect, useState } from "react";

import api from "@/lib/axios";

/** The AI line's SKU. The server prices it from Masters. */
export const AI_SKU = "ADDON:AI";

/** The only product category whose lines can take AI. */
export const AI_CATEGORY = "Interactive Flat Panel";

export const isAiLine = (sku?: string | null) =>
  String(sku || "").trim().toUpperCase() === AI_SKU;

/** Whether a product line offers the AI choice at all. */
export const takesAi = (category?: string | null) => category === AI_CATEGORY;

interface AiCandidate {
  quantity: number;
  category?: string;
  ai?: boolean;
}

type SkuOf<T> = (line: T) => string | undefined;

/** Panels on AI, added up. The flag is only ever set on a panel (the
    choice is shown for no other line, and the server refuses it on one),
    so it is counted as it stands - a saved document reloads its lines
    before the catalogue that names their category. */
export function aiUnits<T extends AiCandidate>(lines: T[], skuOf: SkuOf<T>): number {
  return lines.reduce(
    (sum, line) =>
      !isAiLine(skuOf(line)) && line.ai ? sum + (Number(line.quantity) || 0) : sum,
    0,
  );
}

/**
 * The lines as shown and saved: the AI line's quantity follows the panels
 * on AI, and the line is left out while none are. A second AI line is
 * dropped, so the choice can never add it twice. ``others`` are lines
 * already on the document that count too (a picker holds its choices
 * apart from them); when they already carry the AI line, the picker's is
 * dropped.
 */
export function alignAiLine<T extends AiCandidate>(
  lines: T[],
  skuOf: SkuOf<T>,
  others: T[] = [],
): T[] {
  const units = aiUnits([...others, ...lines], skuOf);
  let seen = others.some((line) => isAiLine(skuOf(line)));

  return lines.flatMap((line) => {
    if (!isAiLine(skuOf(line))) return [line];
    if (seen || units <= 0) return [];
    seen = true;
    return [line.quantity === units ? line : { ...line, quantity: units }];
  });
}

/**
 * Turn AI on or off for one line, adding the AI line the first time a
 * panel goes on AI. ``makeAiLine`` builds it in the page's own line shape,
 * at the Masters rate.
 */
export function setLineAi<T extends AiCandidate>(
  lines: T[],
  skuOf: SkuOf<T>,
  sku: string,
  ai: boolean,
  makeAiLine: () => T,
  others: T[] = [],
): T[] {
  const next = lines.map((line) => (skuOf(line) === sku ? { ...line, ai } : line));

  if (ai && ![...others, ...next].some((line) => isAiLine(skuOf(line)))) {
    return [...next, makeAiLine()];
  }

  return next;
}

/** Removing the AI line takes every panel off AI with it. */
export function removeAiLine<T extends AiCandidate>(lines: T[], skuOf: SkuOf<T>): T[] {
  return lines
    .filter((line) => !isAiLine(skuOf(line)))
    .map((line) => (line.ai ? { ...line, ai: false } : line));
}

/** The AI price per panel from Masters, before GST. 0 until one is set. */
export function useAiRate() {
  const [rate, setRate] = useState(0);

  useEffect(() => {
    let live = true;

    api
      .get("/api/v1/warranty-terms/ai")
      .then(({ data }) => {
        if (live) setRate(Number(data?.data?.price) || 0);
      })
      .catch((error) => {
        /* The line is still priced on the server when the document is
           saved; only the figure on screen waits for it. */
        console.warn("AI price unavailable.", error);
      });

    return () => {
      live = false;
    };
  }, []);

  return rate;
}
