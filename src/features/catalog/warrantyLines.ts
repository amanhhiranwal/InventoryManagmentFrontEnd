/**
 * A warranty line covers the products on its term, unit for unit.
 *
 * A "4 Years Warranty" line (SKU "WARRANTY:4 Years") goes with the product
 * lines whose Warranty is set to 4 Years, and its quantity is theirs added
 * up: six panels on 4 Years, six units of 4 Years Warranty. The screens
 * fill the quantity in from the products rather than letting it be typed;
 * the server refuses a document where the two differ
 * (sales_order_service.assert_warranty_lines).
 */

import { WARRANTY_SKU_PREFIX, isWarrantyLine } from "./useInventoryCatalog";

interface CoverLine {
  quantity: number;
  warrantyTerm?: string;
}

type SkuOf<T> = (line: T) => string | undefined;

/** "WARRANTY:4 Years" -> "4 Years"; "" for a product. */
export const warrantyTermOfSku = (sku?: string | null) =>
  isWarrantyLine(sku) ? String(sku).slice(WARRANTY_SKU_PREFIX.length).trim() : "";

const keyOf = (term: string) => term.trim().toLowerCase();

/** Units of product on each term, keyed by the lower-cased term name. */
export function unitsOnTerm<T extends CoverLine>(
  lines: T[],
  skuOf: SkuOf<T>,
): Record<string, number> {
  const units: Record<string, number> = {};

  for (const line of lines) {
    if (isWarrantyLine(skuOf(line)) || !line.warrantyTerm) continue;
    const key = keyOf(line.warrantyTerm);
    units[key] = (units[key] || 0) + (Number(line.quantity) || 0);
  }

  return units;
}

/** How many units the warranty item for this SKU would cover. */
export const coverFor = (units: Record<string, number>, sku?: string | null) =>
  units[keyOf(warrantyTermOfSku(sku))] || 0;

/**
 * The lines, with each warranty line's quantity set to the units of
 * product on its term. ``others`` are lines already on the document that
 * count towards the cover (the picker's choices are held apart from them).
 * A second warranty line for a term already present is dropped, so adding
 * the same term twice gives one line.
 */
export function alignWarrantyLines<T extends CoverLine>(
  lines: T[],
  skuOf: SkuOf<T>,
  others: T[] = [],
): T[] {
  const units = unitsOnTerm([...others, ...lines], skuOf);
  const present = new Set(
    others.filter((line) => isWarrantyLine(skuOf(line))).map((line) => keyOf(warrantyTermOfSku(skuOf(line)))),
  );

  const aligned: T[] = [];

  for (const line of lines) {
    const sku = skuOf(line);

    if (!isWarrantyLine(sku)) {
      aligned.push(line);
      continue;
    }

    const key = keyOf(warrantyTermOfSku(sku));
    if (present.has(key)) continue;
    present.add(key);

    const quantity = units[key] || 0;
    aligned.push(line.quantity === quantity ? line : { ...line, quantity });
  }

  return aligned;
}

/** Under a warranty item in the picker: what it will cover, or what it
    is waiting for. */
export function warrantyCaption(sku: string, units: Record<string, number>) {
  const cover = coverFor(units, sku);
  const term = warrantyTermOfSku(sku);

  return cover > 0
    ? `per unit, + GST · covers ${cover} unit(s) on ${term}`
    : `set a product's Warranty to ${term} first`;
}

/** Why the lines cannot be saved: a warranty line no product is on. */
export function warrantyLineProblems<T extends CoverLine>(lines: T[], skuOf: SkuOf<T>): string[] {
  const units = unitsOnTerm(lines, skuOf);

  return lines
    .filter((line) => isWarrantyLine(skuOf(line)) && !(units[keyOf(warrantyTermOfSku(skuOf(line)))] > 0))
    .map((line) => {
      const term = warrantyTermOfSku(skuOf(line));
      return `${term} Warranty is added, but no product has its Warranty set to ${term}. Set the product's Warranty to ${term}, or remove the ${term} Warranty line.`;
    });
}
