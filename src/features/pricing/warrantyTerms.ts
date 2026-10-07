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
