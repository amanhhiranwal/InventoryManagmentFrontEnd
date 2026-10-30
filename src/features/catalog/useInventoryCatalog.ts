"use client";

/**
 * The products the Add Product pickers offer, read from inventory.
 *
 * The pickers used to read a list written into the code, so a product
 * could be quoted and ordered that the warehouse had never heard of - and
 * production then found it "not in the catalogue". Reading the shelf
 * means only what inventory holds can be put on an opportunity, proposal,
 * sales order or proforma invoice, at the stock and rates it holds.
 *
 * Inventory keeps one record per serial, so units of the same model are
 * one product here. The model number is the line's SKU: it is what the
 * production desk matches serials against and what the server prices by.
 */

import { useEffect, useMemo, useState } from "react";

import type { CatalogProduct } from "@/features/catalog/productCatalog";
import {
  getInventoryItemsApi,
  type InventoryItem,
} from "@/features/inventory/api/inventory.api";

/** The picker's tabs for inventory's product types. */
const CATEGORY_FOR_TYPE: Record<string, string> = {
  IFP: "Interactive Flat Panel",
  DISPLAY: "Interactive Flat Panel",
  OPS: "OPS Module",
  STANDEE: "Standee",
};

const number = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** The name, with whatever the model number adds to it: '65" Interactive
    Flat Panel CPX' and '65" CPX-LangoV100' read '... CPX (LangoV100)'. */
const displayName = (name: string, model: string) => {
  const said = new Set(name.toLowerCase().split(/[\s-]+/));
  const extra = model
    .split(/[\s-]+/)
    .filter((word) => word && !said.has(word.toLowerCase()))
    .join(" ");

  if (!name) return model;

  return extra ? `${name} (${extra})` : name;
};

const toProduct = (item: InventoryItem): CatalogProduct => {
  const attributes = item.attributes || {};
  const model = String(attributes.model_number || "").trim();
  const name = String(item.name || "").trim();

  return {
    id: model || name || item.serial_number,
    name: displayName(name, model),
    category:
      CATEGORY_FOR_TYPE[String(item.product_type_code || "").toUpperCase()] ||
      item.category ||
      "Other",
    price: number(attributes.rate ?? attributes.rate_per_unit),
    dtp: number(attributes.dtp_rate),
    available: number(attributes.instock ?? attributes.stock),
    hsn: String(attributes.hsn_code || "").trim(),
  };
};

/** One row per model: the same model filed under two companies is one product. */
const toCatalog = (items: InventoryItem[]): CatalogProduct[] => {
  const byId = new Map<string, CatalogProduct>();

  items.forEach((item) => {
    const product = toProduct(item);
    const key = product.id.toUpperCase();
    const seen = byId.get(key);

    if (seen) {
      seen.available += product.available;
      seen.price = seen.price || product.price;
      seen.dtp = seen.dtp || product.dtp;
      seen.hsn = seen.hsn || product.hsn;
    } else {
      byId.set(key, product);
    }
  });

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * Read once, the first time ``open`` is true - the picker opening - so a
 * page that never adds a product never downloads the inventory.
 */
export function useInventoryCatalog(open: boolean) {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wanted, setWanted] = useState(false);

  if (open && !wanted) setWanted(true);

  useEffect(() => {
    if (!wanted) return;

    let live = true;

    getInventoryItemsApi()
      .then((page) => {
        if (live) setProducts(toCatalog(page.items));
      })
      .catch((failure) => {
        console.error(failure);
        if (live) {
          setError(
            failure?.response?.data?.detail ||
              "Could not load products from inventory.",
          );
        }
      })
      .finally(() => {
        if (live) setLoading(false);
      });

    return () => {
      live = false;
    };
  }, [wanted]);

  const categories = useMemo(
    () => [
      "All",
      ...Array.from(new Set(products.map((product) => product.category))),
    ],
    [products],
  );

  return { products, categories, loading, error };
}

/** What the picker says in place of the list while there is none to show. */
export const catalogNotice = (
  catalog: { loading: boolean; error: string | null },
  shown: number,
): string | null =>
  catalog.error
    ? catalog.error
    : catalog.loading
      ? "Loading products from inventory..."
      : shown === 0
        ? "No products in inventory match."
        : null;
