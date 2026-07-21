"use client";

import React, { useState, useRef, useEffect } from "react";
import { FiChevronDown, FiSearch, FiX } from "react-icons/fi";

interface Option {
  id: string;
  name: string;
}

interface SearchableMultiSelectProps {
  options: Option[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  label?: string;
}

export default function SearchableMultiSelect({
  options,
  selectedIds,
  onChange,
  placeholder = "Select options...",
  label,
}: SearchableMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter((opt) =>
    (opt.name || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleToggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const selectedNames = options
    .filter((opt) => selectedIds.includes(opt.id))
    .map((opt) => opt.name);

  return (
    <div ref={containerRef} className="relative w-full space-y-1.5">
      {label && (
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3.5 py-2.5 text-left text-sm text-slate-900 dark:text-white outline-none transition-all focus:border-primary focus:bg-white dark:focus:border-primary-hover dark:focus:bg-[#071929] cursor-pointer"
        >
          <span className="truncate pr-4 text-xs">
            {selectedNames.length > 0
              ? selectedNames.join(", ")
              : placeholder}
          </span>
          <FiChevronDown className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {isOpen && (
          <div className="absolute left-0 right-0 z-50 mt-1.5 max-h-60 overflow-hidden rounded-xl border border-slate-200 dark:border-[#0d2336] bg-white dark:bg-[#051422] p-3 shadow-xl flex flex-col gap-2">
            <div className="relative flex items-center">
              <span className="absolute left-3 text-slate-400">
                <FiSearch className="text-xs" />
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full rounded-lg border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-all focus:border-primary focus:bg-white dark:focus:border-primary-hover"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer"
                >
                  <FiX className="text-xs" />
                </button>
              )}
            </div>

            <div className="overflow-y-auto flex-1 space-y-1 max-h-36 pr-1">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => {
                  const isChecked = selectedIds.includes(opt.id);
                  return (
                    <label
                      key={opt.id}
                      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                        isChecked
                          ? "bg-primary/5 text-primary dark:bg-primary/10"
                          : "text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-[#071929]/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggle(opt.id)}
                        className="rounded text-primary border-slate-200 dark:border-[#0d2336] focus:ring-primary"
                      />
                      <span className="truncate">{opt.name}</span>
                    </label>
                  );
                })
              ) : (
                <div className="py-3 text-center text-xs text-slate-400 italic">
                  No options found.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
