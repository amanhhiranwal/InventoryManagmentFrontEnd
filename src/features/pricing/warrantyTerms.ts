"use client";

import { useCallback, useEffect, useState } from "react";

import api from "@/lib/axios";

/**
 * The warranty terms a line may be quoted on.
 *
 * Only the choice travels with a document. What the chosen term costs is
 * settled on the server against Masters, so a salesperson can pick the
 * cover but cannot price it - and a changed rate reaches the next
 * proposal without anything on the client needing to know.
 */

export interface WarrantyTermOption {
  id: string;
  name: string;
  years: number;
  rate_mode: "PERCENT" | "AMOUNT";
  rate: number;
  is_default: boolean;
}

/** "5% of the line", "₹2,500 a unit", "Included". */
export function describeRate(term: WarrantyTermOption): string {
  if (!term.rate) return "Included";

  return term.rate_mode === "AMOUNT"
    ? `₹${Math.round(term.rate).toLocaleString("en-IN")} a unit`
    : `${term.rate}% of the line`;
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
