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
 * Inventory keeps one record per serial; the server hands back one row
 * per model, across every company, since a salesperson quotes whatever
 * the business holds. The model number is the line's SKU: it is what the
 * production desk matches serials against and what the server prices by.
 */

import { useEffect, useMemo, useState } from "react";

import type { CatalogProduct } from "@/features/catalog/productCatalog";
import {
  getPickerCatalogueApi,
  type PickerProduct,
} from "@/features/inventory/api/inventory.api";
import { useWarrantyTerms } from "@/features/pricing/warrantyTerms";

/** The tab the priced warranty terms are listed under. */
export const WARRANTY_CATEGORY = "Warranty Terms";

/** A warranty line's SKU: "WARRANTY:4 Years". The server prices it from
    the Warranty Terms master (sales_order_service.rate_for_sku). */
export const WARRANTY_SKU_PREFIX = "WARRANTY:";

/** A line that is itself a warranty term carries no warranty of its own. */
export const isWarrantyLine = (sku?: string | null) =>
  String(sku || "").toUpperCase().startsWith(WARRANTY_SKU_PREFIX);

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

const toProduct = (item: PickerProduct): CatalogProduct => {
  const model = String(item.model_number || "").trim();
  const name = String(item.name || "").trim();

  return {
    id: model || name,
    name: displayName(name, model),
    category:
      CATEGORY_FOR_TYPE[String(item.product_type_code || "").toUpperCase()] ||
      item.category ||
      "Other",
    price: number(item.rate),
    dtp: number(item.dtp_rate),
    available: number(item.instock),
    hsn: String(item.hsn_code || "").trim(),
  };
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

    getPickerCatalogueApi()
      .then((items) => {
        if (live) setProducts(items.map(toProduct));
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

  /* The extended warranty terms from Masters, offered after the products
     as items of their own. The standard term is included in the price, so
     it is not one. A term with no price yet is listed as "Price not set"
     and cannot be picked, like any unpriced product. */
  const { terms } = useWarrantyTerms();

  const warranties = useMemo<CatalogProduct[]>(
    () =>
      terms
        .filter((term) => !term.is_default)
        .map((term) => ({
          id: `${WARRANTY_SKU_PREFIX}${term.name}`,
          name: `${term.name} Warranty`,
          category: WARRANTY_CATEGORY,
          price: term.price || 0,
          dtp: term.price || 0,
          available: 0,
          hsn: "",
          service: true,
        })),
    [terms],
  );

  const offered = useMemo(
    () => (warranties.length ? [...products, ...warranties] : products),
    [products, warranties],
  );

  const categories = useMemo(
    () => [
      "All",
      ...Array.from(new Set(offered.map((product) => product.category))),
    ],
    [offered],
  );

  return { products: offered, categories, loading, error };
}

/** What the picker says while the list loads or fails to. An empty list
    is the picker's own empty state. */
export const catalogNotice = (catalog: {
  loading: boolean;
  error: string | null;
}): string | null =>
  catalog.error
    ? catalog.error
    : catalog.loading
      ? "Loading products from inventory..."
      : null;
