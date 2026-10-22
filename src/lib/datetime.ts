/**
 * Dates and times, always on an Indian clock.
 *
 * The server stores UTC and now sends it with the offset on it, so a
 * browser knows what moment it is looking at. What it does *not* know
 * is which clock to show it on: left to itself it uses whatever the
 * laptop is set to, so the same activity entry read 11:04 am in Noida
 * and 5:34 am from a machine still on UTC.
 *
 * The business is in India and the records are Indian, so every time on
 * the portal is shown in IST, whoever is reading it and wherever from.
 */

export const IST = "Asia/Kolkata";

function parse(value?: string | number | Date | null): Date | null {
  if (value === null || value === undefined || value === "") return null;

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

/** 21 Oct 2026 */
export function formatDate(
  value?: string | number | Date | null,
  fallback = "—",
): string {
  const date = parse(value);

  if (!date) return fallback;

  return date.toLocaleDateString("en-IN", {
    timeZone: IST,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** 21/10/2026 */
export function formatDateNumeric(
  value?: string | number | Date | null,
  fallback = "—",
): string {
  const date = parse(value);

  if (!date) return fallback;

  return date.toLocaleDateString("en-IN", {
    timeZone: IST,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** 11:04 am */
export function formatTime(
  value?: string | number | Date | null,
  fallback = "—",
): string {
  const date = parse(value);

  if (!date) return fallback;

  return date
    .toLocaleTimeString("en-IN", {
      timeZone: IST,
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
    .toLowerCase();
}

/** 21 Oct 2026 at 11:04 am */
export function formatDateTime(
  value?: string | number | Date | null,
  fallback = "—",
): string {
  const date = parse(value);

  if (!date) return fallback;

  return `${formatDate(date)} at ${formatTime(date)}`;
}

/** Today / Yesterday / 21 Oct 2026 - all decided on the Indian calendar. */
export function formatDay(
  value?: string | number | Date | null,
  fallback = "—",
): string {
  const date = parse(value);

  if (!date) return fallback;

  const dayOf = (moment: Date) =>
    moment.toLocaleDateString("en-CA", { timeZone: IST });

  const now = new Date();
  const yesterday = new Date(now.getTime() - 86400000);

  if (dayOf(date) === dayOf(now)) return "Today";
  if (dayOf(date) === dayOf(yesterday)) return "Yesterday";

  return formatDate(date);
}

/** The value for an <input type="date">, on the Indian calendar. */
export function toDateInput(value?: string | number | Date | null): string {
  const date = parse(value);

  if (!date) return "";

  // en-CA is YYYY-MM-DD, which is exactly what the input wants.
  return date.toLocaleDateString("en-CA", { timeZone: IST });
}
