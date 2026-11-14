"use client";

/**
 * PR Approval Matrix, under Masters.
 *
 * Who approves a purchase order, by its total, once procurement has a
 * vendor's price. (A requisition itself is confirmed by the requester's
 * reporting manager.) Each band has an upper amount and its approvers in
 * order: the four steps of the company's PR form, or any role by name.
 * Bands can be added and removed; the last one covers everything above.
 *
 * A change applies to purchase orders submitted afterwards - one already in
 * approval keeps the chain it was given. Saving needs
 * procurement_masters.manage, and the server checks every band again.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiArrowLeft, FiArrowRight, FiPlus, FiTrash2, FiX } from "react-icons/fi";

import { ListPage } from "@/components/crm/ListPageShell";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import { hasPermission } from "@/features/auth/utils/permissions";
import {
  errorDetail,
  getApprovalMatrixApi,
  saveApprovalMatrixApi,
  type ApprovalMatrix,
} from "@/features/procurement/api/procurement.api";
import { ErrorState, INPUT, LABEL, Loading, money } from "@/features/procurement/components/shared";
import { useUIStore } from "@/lib/store/ui.store";

/** A band as typed: the amount stays text until it is saved. */
type DraftBand = { upto: string; steps: string[] };

const MAX_BANDS = 8;

const toDraft = (m: ApprovalMatrix): DraftBand[] =>
  m.bands.map((band) => ({ upto: band.upto === null ? "" : String(band.upto), steps: [...band.steps] }));

/** "Up to ₹50,000", "₹50,001 to ₹5,00,000", "Above ₹5,00,000". */
function rangeLabels(ceilings: (number | null)[]): string[] {
  let previous = 0;
  return ceilings.map((upto, i) => {
    const last = i === ceilings.length - 1;
    let text: string;
    if (last) text = ceilings.length === 1 ? "Any amount" : `Above ${money(previous)}`;
    else if (i === 0) text = `Up to ${money(upto)}`;
    else text = `${money(previous + 1)} to ${money(upto)}`;
    if (!last && upto !== null) previous = upto;
    return text;
  });
}

/** What is wrong with the draft, in the order a person would fix it. */
function problemsOf(draft: DraftBand[]): string[] {
  const problems: string[] = [];
  let previous = 0;
  draft.forEach((band, i) => {
    const last = i === draft.length - 1;
    if (!last) {
      const amount = Number(band.upto);
      if (band.upto.trim() === "" || !Number.isFinite(amount)) {
        problems.push(`Band ${i + 1} needs an upper amount.`);
      } else if (amount <= previous) {
        problems.push(`Band ${i + 1}'s upper amount must be more than ${money(previous)}.`);
      } else {
        previous = amount;
      }
    }
    if (band.steps.length === 0) problems.push(`Band ${i + 1} needs at least one approver.`);
  });
  return problems;
}

export default function ApprovalMatrixPage() {
  const { addToast } = useUIStore();
  const canManage = hasPermission("procurement_masters.manage");
  const [matrix, setMatrix] = useState<ApprovalMatrix | null>(null);
  const [draft, setDraft] = useState<DraftBand[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const show = (m: ApprovalMatrix) => {
    setMatrix(m);
    setDraft(toDraft(m));
  };

  const load = useCallback(async () => {
    setError(null);
    try {
      show(await getApprovalMatrixApi());
    } catch (failure) {
      setError(errorDetail(failure, "Could not load the approval matrix."));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const labelOf = useMemo(() => {
    const names = new Map((matrix?.options || []).map((o) => [o.value, o.label]));
    return (step: string) => names.get(step) || step.replace(/^ROLE:/, "");
  }, [matrix]);

  const problems = problemsOf(draft);
  const changed = matrix ? JSON.stringify(draft) !== JSON.stringify(toDraft(matrix)) : false;

  const editBand = (index: number, change: (band: DraftBand) => DraftBand) =>
    setDraft((current) => current.map((band, i) => (i === index ? change(band) : band)));

  const moveStep = (index: number, from: number, to: number) =>
    editBand(index, (band) => {
      const steps = [...band.steps];
      const [step] = steps.splice(from, 1);
      steps.splice(to, 0, step);
      return { ...band, steps };
    });

  /* A new band goes in before the last one, which always covers the rest. */
  const addBand = () =>
    setDraft((current) => [
      ...current.slice(0, -1),
      { upto: "", steps: ["REPORTING_MANAGER"] },
      ...current.slice(-1),
    ]);

  const removeBand = (index: number) =>
    setDraft((current) => {
      const next = current.filter((_, i) => i !== index);
      // Whichever band is now last loses its ceiling: it covers the rest.
      return next.map((band, i) => (i === next.length - 1 ? { ...band, upto: "" } : band));
    });

  const save = async () => {
    setSaving(true);
    try {
      show(
        await saveApprovalMatrixApi(
          draft.map((band, i) => ({
            upto: i === draft.length - 1 ? null : Number(band.upto),
            steps: band.steps,
          })),
        ),
      );
      addToast("Approval matrix saved. Purchase orders submitted from now on follow it.", "success");
    } catch {
      /* The API client shows the server's reason; the draft is kept. */
    } finally {
      setSaving(false);
    }
  };

  if (error) return <ErrorState text={error} onRetry={load} />;
  if (!matrix) return <Loading text="Loading the approval matrix..." />;

  const savedRanges = rangeLabels(matrix.bands.map((band) => band.upto));
  const draftRanges = rangeLabels(
    draft.map((band, i) => (i === draft.length - 1 ? null : Number(band.upto) || 0)),
  );

  return (
    <ListPage>
      <PageHeader
        title="PR Approval Matrix"
        description="Who approves a purchase order, by its total. The requisition itself is confirmed by the requester's reporting manager. Orders already in approval keep the chain they were given."
      />

      <div className="overflow-hidden rounded-xl bg-white dark:border dark:border-[#17304a] dark:bg-[#071929]">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[#e2e2e2] dark:border-[#17304a]">
              <th className="px-5 py-3 text-[12px] font-normal text-[#777777]">Order Total</th>
              <th className="px-5 py-3 text-[12px] font-normal text-[#777777]">Approved By, in Order</th>
            </tr>
          </thead>
          <tbody>
            {matrix.bands.map((band, i) => (
              <tr key={i} className="align-top">
                <td className="whitespace-nowrap px-5 py-4 text-[13px] font-medium text-[#141414] dark:text-white">{savedRanges[i]}</td>
                <td className="px-5 py-4">
                  <ol className="flex flex-wrap items-center gap-2 text-[13px] text-slate-700 dark:text-slate-200">
                    {band.labels.map((label, j) => (
                      <li key={`${label}-${j}`} className="flex items-center gap-2">
                        {j > 0 && <span className="text-[#999999]">→</span>}
                        <span className="rounded-md bg-slate-100 px-2 py-1 dark:bg-[#0b2034]">{label}</span>
                      </li>
                    ))}
                  </ol>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-[#f3f3f3] px-5 py-3 text-[11px] text-[#999999] dark:border-[#17304a]">
          Finance, Director and any role you pick go to the people holding that role. Where no approver is set up, a super admin approves.
          Nobody approves an order they raised.
        </p>
      </div>

      {canManage && (
        <div className="rounded-xl bg-white p-5 dark:border dark:border-[#17304a] dark:bg-[#071929]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-medium text-[#474747] dark:text-white">Edit the matrix</h2>
              <p className="mt-0.5 text-[12px] text-[#777777]">
                Set each band&apos;s upper amount and its approvers, in the order they sign. The last band covers everything above.
              </p>
            </div>
            <Button variant="outline" onClick={addBand} disabled={draft.length >= MAX_BANDS}>
              <FiPlus size={14} className="mr-1 inline" />
              Add Band
            </Button>
          </div>

          <div className="space-y-3">
            {draft.map((band, index) => {
              const last = index === draft.length - 1;
              const unused = matrix.options.filter((option) => !band.steps.includes(option.value));
              return (
                <section
                  key={index}
                  aria-label={`Band ${index + 1}`}
                  className="rounded-lg border border-[#e2e2e2] p-4 dark:border-[#17304a]"
                >
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="w-full sm:w-56">
                      {last ? (
                        <>
                          <span className={LABEL}>Band {index + 1}</span>
                          <p className="py-2 text-[13px] font-medium text-[#141414] dark:text-white">{draftRanges[index]}</p>
                        </>
                      ) : (
                        <>
                          <label className={LABEL} htmlFor={`band-${index}`}>
                            Band {index + 1}: up to (₹)
                          </label>
                          <input
                            id={`band-${index}`}
                            type="number"
                            min="1"
                            inputMode="numeric"
                            className={INPUT}
                            value={band.upto}
                            onChange={(e) => editBand(index, (b) => ({ ...b, upto: e.target.value }))}
                          />
                        </>
                      )}
                    </div>
                    {draft.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeBand(index)}
                        className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[12px] text-rose-600 hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-500 dark:hover:bg-rose-950/30"
                      >
                        <FiTrash2 size={13} /> Remove band
                      </button>
                    )}
                  </div>

                  <p className={`${LABEL} mt-3`}>Approved by, in order</p>
                  <ol className="flex flex-wrap items-center gap-2">
                    {band.steps.map((step, j) => (
                      <li key={step} className="flex items-center gap-1">
                        {j > 0 && <span className="px-1 text-[#999999]" aria-hidden>→</span>}
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 py-1 pl-2 pr-1 text-[13px] text-slate-700 dark:bg-[#0b2034] dark:text-slate-200">
                          {labelOf(step)}
                          <button
                            type="button"
                            aria-label={`Move ${labelOf(step)} earlier`}
                            disabled={j === 0}
                            onClick={() => moveStep(index, j, j - 1)}
                            className="rounded p-1 hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-[#17304a]"
                          >
                            <FiArrowLeft size={12} />
                          </button>
                          <button
                            type="button"
                            aria-label={`Move ${labelOf(step)} later`}
                            disabled={j === band.steps.length - 1}
                            onClick={() => moveStep(index, j, j + 1)}
                            className="rounded p-1 hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-[#17304a]"
                          >
                            <FiArrowRight size={12} />
                          </button>
                          <button
                            type="button"
                            aria-label={`Remove ${labelOf(step)}`}
                            onClick={() => editBand(index, (b) => ({ ...b, steps: b.steps.filter((s) => s !== step) }))}
                            className="rounded p-1 text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950/40"
                          >
                            <FiX size={12} />
                          </button>
                        </span>
                      </li>
                    ))}
                    {unused.length > 0 && (
                      <li>
                        <select
                          aria-label={`Add an approver to band ${index + 1}`}
                          className={`${INPUT} w-auto py-1.5`}
                          value=""
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value) editBand(index, (b) => ({ ...b, steps: [...b.steps, value] }));
                          }}
                        >
                          <option value="">+ Add approver</option>
                          {unused.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </li>
                    )}
                  </ol>
                </section>
              );
            })}
          </div>

          {changed && problems.length > 0 && (
            <ul className="mt-3 space-y-0.5 text-[12px] text-rose-600" role="alert">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button onClick={save} loading={saving} disabled={!changed || problems.length > 0}>
              Save Matrix
            </Button>
            <Button variant="outline" disabled={!changed} onClick={() => show(matrix)}>
              Reset
            </Button>
            {!changed && <span className="text-[12px] text-[#999999]">Make a change to save it.</span>}
          </div>
        </div>
      )}
    </ListPage>
  );
}
