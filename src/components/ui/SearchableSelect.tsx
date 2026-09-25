"use client";

import React, { useEffect, useRef, useState } from "react";
import { FiChevronDown, FiSearch } from "react-icons/fi";

export interface SearchableOption {
  id: string;
  /** What the closed control shows once this option is picked. */
  name: string;
  /** A second line in the list - a company, a contact, a total. */
  hint?: string;
  /** Extra words the search should match but the label need not show. */
  keywords?: string;
}

/**
 * A single-select dropdown you can type into.
 *
 * Built for lists long enough that scrolling stops working - picking an
 * opportunity out of hundreds, say - where a plain <select> leaves you
 * hunting by eye. The panel filters as you type across the label, the hint
 * and any extra keywords.
 */
export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  emptyLabel = "Nothing matches that.",
  className = "",
  buttonClassName = "",
  disabled = false,
}: {
  options: SearchableOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  emptyLabel?: string;
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  /* The search box takes focus as the panel opens, so picking one is all
     keyboard: click, type, Enter. */
  useEffect(() => {
    if (open) {
      setSearch("");
      searchRef.current?.focus();
    }
  }, [open]);

  const needle = search.trim().toLowerCase();
  const matches = needle
    ? options.filter((option) =>
        `${option.name} ${option.hint || ""} ${option.keywords || ""}`
          .toLowerCase()
          .includes(needle),
      )
    : options;

  const selected = options.find((option) => option.id === value);

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((was) => !was)}
        className={`flex w-full items-center justify-between gap-2 text-left outline-none disabled:opacity-50 ${buttonClassName}`}
      >
        <span className={selected ? "" : "text-slate-400"}>
          {selected ? selected.name : placeholder}
        </span>
        <FiChevronDown size={12} className="shrink-0 text-slate-400" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-[80] mt-1 w-full min-w-[260px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-[#17304a] dark:bg-[#071929]">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 dark:border-[#17304a]">
            <FiSearch size={12} className="shrink-0 text-slate-400" />
            <input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  if (matches.length) pick(matches[0].id);
                }
                if (event.key === "Escape") setOpen(false);
              }}
              placeholder="Search..."
              className="w-full bg-transparent text-[11px] text-slate-700 outline-none placeholder:text-slate-400 dark:text-white"
            />
          </div>

          <div className="max-h-60 overflow-y-auto py-1">
            {matches.length === 0 ? (
              <p className="px-3 py-3 text-center text-[10px] italic text-slate-400">
                {emptyLabel}
              </p>
            ) : (
              matches.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => pick(option.id)}
                  className={`block w-full px-3 py-2 text-left transition hover:bg-slate-50 dark:hover:bg-[#0b2034] ${
                    option.id === value ? "bg-slate-50 dark:bg-[#0b2034]" : ""
                  }`}
                >
                  <span className="block truncate text-[11px] font-semibold text-slate-700 dark:text-white">
                    {option.name}
                  </span>
                  {option.hint && (
                    <span className="block truncate text-[10px] text-slate-400">
                      {option.hint}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
