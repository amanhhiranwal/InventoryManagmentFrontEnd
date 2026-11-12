"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { errorDetail, getWorkspaceApi, type Workspace } from "@/features/procurement/api/procurement.api";
import QuotationForm from "@/features/procurement/components/QuotationForm";
import { ErrorState, Loading } from "@/features/procurement/components/shared";

export default function NewQuotationPage() {
  const { id } = useParams<{ id: string }>();
  const [pr, setPr] = useState<Workspace | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setPr(await getWorkspaceApi(id));
    } catch (failure) {
      setError(errorDetail(failure, "Could not load the requisition."));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <ErrorState text={error} onRetry={load} />;
  if (!pr) return <Loading text="Loading the requisition..." />;
  return <QuotationForm pr={pr} />;
}
