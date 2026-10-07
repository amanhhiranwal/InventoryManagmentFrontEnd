"use client";

import { useCallback, useEffect, useState } from "react";

import api from "@/lib/axios";

/**
 * The warranty terms a line may be quoted on.
 *
 * The lengths are company-wide; what each costs is held against each
 * product, because five years on a panel and five years on a camera are
 * different undertakings.
 *
 * Only the choice travels with a document. The price is settled on the
 * server from the product, so a salesperson can pick the cover but cannot
 * price it, and a rate changed on a product reaches the next proposal
 * without anything on the client needing to know.
 */

export interface WarrantyTermOption {
  id: string;
  name: string;
  years: number;
  is_default: boolean;
}

/** What a product charges for one term. */
export interface ProductWarrantyRate {
  mode: "PERCENT" | "AMOUNT";
  rate: number;
}

/** A product's rates, keyed by term name. */
export type ProductWarrantyRates = Record<string, ProductWarrantyRate>;

/** "5% of the line", "₹2,500 a unit", or "Included" when none is set. */
export function describeRate(entry?: ProductWarrantyRate | null): string {
  if (!entry || !entry.rate) return "Included";

  return entry.mode === "AMOUNT"
    ? `₹${Math.round(entry.rate).toLocaleString("en-IN")} a unit`
    : `${entry.rate}% of the line`;
}

export function useWarrantyTerms() {
  const [terms, setTerms] = useState<WarrantyTermOption[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/api/v1/warranty-terms");
      setTerms(data?.data || []);
    } catch (error) {
      /* A proposal can still be written without the list; every line then
         carries no term and the server charges nothing for cover. */
      console.warn("Warranty terms unavailable.", error);
      setTerms([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const standard = terms.find((term) => term.is_default)?.name || "";

  return { terms, standard, loading };
}

/** Per-product rates, keyed by SKU then term name. */
export type WarrantyRatesBySku = Record<string, ProductWarrantyRates>;

/**
 * What the chosen term adds to one line.
 *
 * Mirrors warranty_uplift_for_sku on the server. The server is what
 * actually charges it; this exists so the running total on screen moves
 * as the term is picked, instead of the figure only appearing once the
 * document has been saved and reloaded.
 */
export function upliftFor(
  rates: WarrantyRatesBySku,
  sku: string | undefined,
  termName: string | undefined,
  unitPrice: number,
  quantity: number,
): number {
  const entry = rates[String(sku || "").toUpperCase()]?.[
    String(termName || "").trim()
  ];

  if (!entry || !entry.rate) return 0;

  return entry.mode === "AMOUNT"
    ? entry.rate * (quantity || 0)
    : ((unitPrice || 0) * (quantity || 0) * entry.rate) / 100;
}

/** The rate map, fetched once per screen. */
export function useWarrantyRates() {
  const [rates, setRates] = useState<WarrantyRatesBySku>({});

  useEffect(() => {
    api
      .get("/api/v1/warranty-terms/rates")
      .then(({ data }) => setRates(data?.data || {}))
      .catch((error) => {
        /* The screen still works: the server prices the document either
           way, the running total simply will not show cover until it is
           saved. */
        console.warn("Warranty rates unavailable.", error);
      });
  }, []);

  return rates;
}
