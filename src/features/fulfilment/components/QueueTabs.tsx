"use client";

/**
 * The slices of a queue, as tabs across the top of its table.
 *
 * These started life as buttons wedged in beside the search box, which
 * read as a row of unrelated actions and pushed the search into a corner.
 * They are not actions - they are which part of the list you are looking
 * at - so they belong on the table, where every other product puts them.
 *
 * A tab with nothing in it is still shown but muted and not clickable:
 * "nothing is waiting on stock" is worth knowing, and a strip that
 * reshuffles itself as work arrives is hard to aim at.
 */

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
}: {
  tabs: QueueTab[];
  active: string | null;
  onChange: (value: string | null) => void;
}) {
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
