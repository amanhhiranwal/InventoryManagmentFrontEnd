"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  errorDetail,
  getQuotationApi,
  getWorkspaceApi,
  type Quotation,
  type Workspace,
} from "@/features/procurement/api/procurement.api";
import QuotationForm from "@/features/procurement/components/QuotationForm";
import { ErrorState, Loading } from "@/features/procurement/components/shared";

export default function ReviseQuotationPage() {
  const { qid } = useParams<{ qid: string }>();
  const [base, setBase] = useState<Quotation | null>(null);
  const [pr, setPr] = useState<Workspace | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const quotation = await getQuotationApi(qid);
      setBase(quotation);
      setPr(await getWorkspaceApi(quotation.requisition_id));
    } catch (failure) {
      setError(errorDetail(failure, "Could not load the quotation."));
    }
  }, [qid]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <ErrorState text={error} onRetry={load} />;
  if (!pr || !base) return <Loading text="Loading the quotation..." />;
  if (!base.is_latest) return <ErrorState text="Only the latest version of a quotation can be revised." />;
  return <QuotationForm pr={pr} base={base} />;
}
