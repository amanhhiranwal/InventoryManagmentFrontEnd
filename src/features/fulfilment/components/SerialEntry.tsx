"use client";

/**
 * One box per unit going out, for production to type its serial number.
 *
 * Each serial is checked against the shelf as it is typed: on the shelf
 * and in stock, already issued to another order, or not in the catalogue
 * at all. A serial that belongs to a different product is allowed but
 * flagged, because the catalogue's names and the order's were typed by
 * different people. Mark Ready stays disabled until every unit has a
 * serial that is in stock and none is entered twice; the server checks
 * all of it again.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { CgSpinner } from "react-icons/cg";
import { LuCheck, LuTriangleAlert, LuX } from "react-icons/lu";

import {
  DeskOrder,
  SerialCheck,
  checkSerialApi,
} from "@/features/fulfilment/api/fulfilment.api";
import { FiHash } from "react-icons/fi";

import { DeskDetailContext } from "@/features/fulfilment/components/DeskBoard";
import { Panel } from "@/features/fulfilment/components/DeskPanels";

/** Wait this long after the last keystroke before asking the shelf. */
const CHECK_DELAY_MS = 400;

type Slot = { line: number; unit: number };

const slotKey = (slot: Slot) => `${slot.line}:${slot.unit}`;

export default function SerialEntry({
  order,
  context,
}: {
  order: DeskOrder;
  context: DeskDetailContext;
}) {
  const lines = useMemo(() => order.lines || [], [order.lines]);

  const slots = useMemo(
    () =>
      lines.flatMap((line) =>
        Array.from({ length: Math.max(0, line.quantity) }, (_, unit) => ({
          line: line.index,
          unit,
        })),
      ),
    [lines],
  );

  const [typed, setTyped] = useState<Record<string, string>>({});
  const [checks, setChecks] = useState<
    Record<string, SerialCheck | "checking">
  >({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  /* What each box says now, for a check that comes back late. */
  const latest = useRef<Record<string, string>>({});

  /* A serial typed twice is caught here, before the shelf is asked. */
  const duplicates = useMemo(() => {
    const counts: Record<string, number> = {};

    Object.values(typed).forEach((value) => {
      const serial = value.trim().toUpperCase();
      if (serial) counts[serial] = (counts[serial] || 0) + 1;
    });

    return new Set(Object.keys(counts).filter((serial) => counts[serial] > 1));
  }, [typed]);

  const type = (slot: Slot, value: string) => {
    const key = slotKey(slot);

    latest.current = { ...latest.current, [key]: value };
    setTyped(latest.current);
    clearTimeout(timers.current[key]);

    const serial = value.trim();

    if (!serial) {
      setChecks((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      return;
    }

    setChecks((current) => ({ ...current, [key]: "checking" }));

    timers.current[key] = setTimeout(async () => {
      try {
        const result = await checkSerialApi(serial, order.id, slot.line);

        // Only keep the answer if the box still says what was asked.
        if ((latest.current[key] || "").trim() === serial) {
          setChecks((now) => ({ ...now, [key]: result }));
        }
      } catch {
        setChecks((current) => ({
          ...current,
          [key]: {
            serial,
            found: false,
            in_stock: false,
            message: "Could not check this serial. Try again.",
          },
        }));
      }
    }, CHECK_DELAY_MS);
  };

  useEffect(() => {
    const pending = timers.current;
    return () => Object.values(pending).forEach(clearTimeout);
  }, []);

  const { setAction } = context;

  useEffect(() => {
    const entered = slots.filter((slot) => (typed[slotKey(slot)] || "").trim());
    const good = slots.filter((slot) => {
      const check = checks[slotKey(slot)];
      return (
        check &&
        check !== "checking" &&
        check.found &&
        check.in_stock &&
        !duplicates.has((typed[slotKey(slot)] || "").trim().toUpperCase())
      );
    });

    const blocked =
      slots.length === 0
        ? "This order has no units to issue."
        : entered.length < slots.length
          ? `Enter a serial for every unit - ${entered.length} of ${slots.length} entered.`
          : duplicates.size
            ? "The same serial is entered more than once."
            : Object.values(checks).includes("checking")
              ? "Checking the serials against stock..."
              : good.length < slots.length
                ? "Every serial has to be in stock."
                : null;

    setAction({
      label: "Mark Ready For Dispatch",
      blocked,
      extra: {
        serials: slots.map((slot) => ({
          line: slot.line,
          serial: (typed[slotKey(slot)] || "").trim(),
        })),
      },
      note: "Marking ready issues each unit from stock and hands the order to logistics.",
    });
  }, [checks, duplicates, setAction, slots, typed]);

  return (
    <Panel title="Serial Numbers" icon={<FiHash size={14} />}>
      <p className="text-[11px] text-[#777777] dark:text-slate-400">
        One per unit. Each is checked against stock as you type.
      </p>

      <div className="space-y-4">
        {lines.map((line) => (
          <div key={line.index}>
            <p className="text-[11px] font-medium text-slate-800 dark:text-slate-100">
              {line.product}
              <span className="text-slate-400">
                {line.sku ? ` (${line.sku})` : ""} × {line.quantity}
              </span>
            </p>

            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {slots
                .filter((slot) => slot.line === line.index)
                .map((slot) => {
                  const key = slotKey(slot);
                  const value = typed[key] || "";
                  const check = checks[key];
                  const twice = duplicates.has(value.trim().toUpperCase());

                  return (
                    <div key={key}>
                      <label className="sr-only" htmlFor={`serial-${key}`}>
                        {`${line.product}, unit ${slot.unit + 1}`}
                      </label>
                      <input
                        id={`serial-${key}`}
                        value={value}
                        onChange={(event) => type(slot, event.target.value)}
                        placeholder={`Unit ${slot.unit + 1} serial`}
                        autoComplete="off"
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-[11px] text-slate-700 outline-none focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
                      />
                      <SerialStatus check={check} twice={twice} />
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function SerialStatus({
  check,
  twice,
}: {
  check?: SerialCheck | "checking";
  twice: boolean;
}) {
  if (twice) {
    return <Status tone="bad" text="Entered more than once." />;
  }

  if (!check) return null;

  if (check === "checking") {
    return (
      <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
        <CgSpinner className="animate-spin" size={10} /> Checking stock...
      </p>
    );
  }

  if (!check.found || !check.in_stock) {
    return <Status tone="bad" text={check.message || "Not in stock."} />;
  }

  if (check.matches_line === false) {
    return (
      <Status
        tone="warn"
        text={check.message || "In stock, but a different product."}
      />
    );
  }

  return (
    <Status tone="good" text={`In stock · ${check.product || check.serial}`} />
  );
}

function Status({
  tone,
  text,
}: {
  tone: "good" | "warn" | "bad";
  text: string;
}) {
  const style = {
    good: "text-emerald-600 dark:text-emerald-400",
    warn: "text-amber-600 dark:text-amber-400",
    bad: "text-rose-600 dark:text-rose-400",
  }[tone];

  const Icon =
    tone === "good" ? LuCheck : tone === "warn" ? LuTriangleAlert : LuX;

  return (
    <p className={`mt-1 flex items-center gap-1 text-[10px] ${style}`}>
      <Icon size={10} className="shrink-0" />
      <span>{text}</span>
    </p>
  );
}
