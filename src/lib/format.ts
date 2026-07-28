import { parseDate } from "./leave";

const dateFormat = new Intl.DateTimeFormat("de-AT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateShortFormat = new Intl.DateTimeFormat("de-AT", {
  day: "2-digit",
  month: "2-digit",
});

const dateTimeFormat = new Intl.DateTimeFormat("de-AT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const weekdayFormat = new Intl.DateTimeFormat("de-AT", { weekday: "short" });

export function formatDate(iso: string): string {
  return dateFormat.format(parseDate(iso));
}

export function formatDateShort(iso: string): string {
  return dateShortFormat.format(parseDate(iso));
}

export function formatWeekday(iso: string): string {
  return weekdayFormat.format(parseDate(iso));
}

export function formatDateTime(value: string): string {
  return dateTimeFormat.format(new Date(value));
}

/** Tage mit halben Schritten: 12 → "12", 12.5 → "12,5". */
export function formatDays(value: number): string {
  const rounded = Math.round(value * 2) / 2;
  return rounded.toLocaleString("de-AT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}

/** Wie formatDays, aber mit ausdrücklichem Vorzeichen für Salden. */
export function formatSigned(value: number): string {
  const rounded = Math.round(value * 2) / 2;
  if (rounded === 0) return "0";
  return `${rounded > 0 ? "+" : "−"}${formatDays(Math.abs(rounded))}`;
}

/** "3 Tage", "1 Tag", "0,5 Tage". */
export function formatDayCount(value: number): string {
  return `${formatDays(value)} ${value === 1 ? "Tag" : "Tage"}`;
}

/** "12.03.2026" bzw. "12.–16.03.2026" für einen Zeitraum. */
export function formatRange(from: string, to: string): string {
  if (from === to) return formatDate(from);
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  const sameMonth = sameYear && from.slice(5, 7) === to.slice(5, 7);
  if (sameMonth) return `${from.slice(8, 10)}.–${formatDate(to)}`;
  if (sameYear) return `${formatDateShort(from)}–${formatDate(to)}`;
  return `${formatDate(from)} – ${formatDate(to)}`;
}

/**
 * Wie formatRange, aber über den Jahreswechsel mit zweistelligen Jahren:
 * "25.12.26–04.01.27". Spart in schmalen Spalten acht Zeichen.
 */
export function formatRangeShort(from: string, to: string): string {
  if (from.slice(0, 4) === to.slice(0, 4)) return formatRange(from, to);
  const drop = (iso: string) => `${formatDate(iso).slice(0, 6)}${iso.slice(2, 4)}`;
  return `${drop(from)}–${drop(to)}`;
}
