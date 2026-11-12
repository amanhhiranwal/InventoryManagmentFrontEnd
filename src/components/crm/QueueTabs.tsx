"use client";

/**
 * The slices of a list, as tabs across the top of its table.
 *
 * These started life as buttons wedged in beside the search box, which
 * read as a row of unrelated actions and pushed the search into a corner.
 * They are not actions - they are which part of the list you are looking
 * at - so they belong on the table, where every other product puts them.
 *
 * A tab with nothing in it is still shown but muted and not clickable:
 * "nothing is waiting on stock" is worth knowing, and a strip that
 * reshuffles itself as work arrives is hard to aim at.
 *
 * Used by both fulfilment desks for their queue stages and by the
 * Inventory catalogue for its product categories.
 */

import { useId, useLayoutEffect, useRef, useState } from "react";

export interface QueueTab {
  /** Value handed back on select; null is the "everything" tab. */
  value: string | null;
  label: string;
  count: number;
}

export default function QueueTabs({
  tabs,
  active,
  onChange,
  fit = false,
}: {
  tabs: QueueTab[];
  active: string | null;
  onChange: (value: string | null) => void;
  /** Never scroll sideways or wrap: tighter tabs on one line while the
      table is wide enough for all of them, and a Status dropdown below
      that width. Off by default, so existing lists keep their strip. */
  fit?: boolean;
}) {
  if (fit) {
    return <FittedTabs tabs={tabs} active={active} onChange={onChange} />;
  }

  return (
    <div className="flex items-end gap-1 overflow-x-auto border-b border-slate-200 px-2 dark:border-[#17304a]">
      {tabs.map((tab) => {
        const selected = active === tab.value;
        const empty = tab.count === 0 && tab.value !== null;

        return (
          <button
            key={tab.value ?? "all"}
            type="button"
            disabled={empty}
            onClick={() => onChange(tab.value)}
            className={`relative flex shrink-0 items-center gap-2 px-3.5 py-3 text-[13px] transition ${
              selected
                ? "font-semibold text-[#233353] dark:text-white"
                : empty
                  ? "cursor-default text-slate-300 dark:text-slate-600"
                  : "text-[#777777] hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            {tab.label}

            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                selected
                  ? "bg-[#233353] text-white dark:bg-sky-500"
                  : empty
                    ? "bg-slate-50 text-slate-300 dark:bg-[#0b2034] dark:text-slate-600"
                    : "bg-slate-100 text-slate-500 dark:bg-[#0b2034] dark:text-slate-300"
              }`}
            >
              {tab.count}
            </span>

            {selected && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[#233353] dark:bg-sky-400" />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** The fit mode: one line of tabs while they fit the table's width, a
 *  Status dropdown when they do not. Measured rather than guessed, because
 *  what fits depends on the labels as well as how many there are. */
function FittedTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: QueueTab[];
  active: string | null;
  onChange: (value: string | null) => void;
}) {
  const box = useRef<HTMLDivElement | null>(null);
  const strip = useRef<HTMLDivElement | null>(null);
  const [fits, setFits] = useState(true);
  const selectId = useId();
  const signature = tabs.map((t) => `${t.label}:${t.count}`).join("|");

  useLayoutEffect(() => {
    const outer = box.current;
    const inner = strip.current;
    if (!outer || !inner) return;

    const check = () => setFits(inner.scrollWidth <= outer.clientWidth);
    check();

    const observer = new ResizeObserver(check);
    observer.observe(outer);
    return () => observer.disconnect();
  }, [signature]);

  return (
    <div
      ref={box}
      className="relative overflow-hidden border-b border-slate-200 dark:border-[#17304a]"
    >
      {/* Always rendered so it can be measured; hidden when it does not fit. */}
      <div
        ref={strip}
        aria-hidden={!fits}
        className={`flex w-max items-end gap-0.5 px-1.5 ${fits ? "" : "pointer-events-none invisible absolute left-0 top-0"}`}
      >
        {tabs.map((tab) => {
          const selected = active === tab.value;
          const empty = tab.count === 0 && tab.value !== null;
          return (
            <button
              key={tab.value ?? "all"}
              type="button"
              disabled={empty || !fits}
              tabIndex={fits ? undefined : -1}
              aria-pressed={selected}
              onClick={() => onChange(tab.value)}
              className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2 py-3 text-[12.5px] transition ${
                selected
                  ? "font-semibold text-[#233353] dark:text-white"
                  : empty
                    ? "cursor-default text-slate-300 dark:text-slate-600"
                    : "text-[#777777] hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {tab.label}
              <span
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                  selected
                    ? "bg-[#233353] text-white dark:bg-sky-500"
                    : empty
                      ? "bg-slate-50 text-slate-300 dark:bg-[#0b2034] dark:text-slate-600"
                      : "bg-slate-100 text-slate-500 dark:bg-[#0b2034] dark:text-slate-300"
                }`}
              >
                {tab.count}
              </span>
              {selected && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[#233353] dark:bg-sky-400" />
              )}
            </button>
          );
        })}
      </div>

      {!fits && (
        <div className="flex items-center gap-2 px-4 py-2.5">
          <label
            htmlFor={selectId}
            className="text-[12px] text-[#777777] dark:text-slate-400"
          >
            Status
          </label>
          <select
            id={selectId}
            value={active ?? ""}
            onChange={(event) =>
              onChange(event.target.value === "" ? null : event.target.value)
            }
            className="h-9 flex-1 rounded-lg border border-[#d1d1d1] bg-white px-2.5 text-[13px] text-[#141414] outline-none focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
          >
            {tabs.map((tab) => (
              <option key={tab.value ?? "all"} value={tab.value ?? ""}>
                {tab.label} ({tab.count})
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
