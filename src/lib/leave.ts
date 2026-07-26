import type {
  Entitlement,
  LeaveRequest,
  Profile,
  TeamAbsence,
} from "./types";

/**
 * Berechnung von Urlaubstagen und Jahressalden.
 *
 * Als Arbeitstage gelten Montag bis Freitag ohne die Feiertage des Landes,
 * das dem Mitarbeiter zugewiesen ist. Der erste und der letzte Tag eines
 * Antrags können halbe Tage sein.
 */

/** Wandelt "2026-03-31" in ein UTC-Datum (keine Zeitzonen-Sprünge). */
export function parseDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const date = parseDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toISODate(date);
}

export function isWeekend(iso: string): boolean {
  const weekday = parseDate(iso).getUTCDay();
  return weekday === 0 || weekday === 6;
}

/** Alle Kalendertage von `from` bis `to` einschliesslich. */
export function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
}

export type DateWindow = { from?: string; to?: string };

/**
 * Urlaubstage eines Antrags, wahlweise nur innerhalb eines Zeitfensters.
 * Das Fenster wird für die Jahresabgrenzung (Anträge über den Jahreswechsel)
 * und für den Verfallsstichtag des Übertrags gebraucht.
 */
export function requestDays(
  request: Pick<
    LeaveRequest,
    "start_date" | "end_date" | "start_half_day" | "end_half_day"
  >,
  isHoliday: (day: string) => boolean,
  window: DateWindow = {},
): number {
  const singleDay = request.start_date === request.end_date;
  let total = 0;

  for (const day of eachDay(request.start_date, request.end_date)) {
    if (window.from && day < window.from) continue;
    if (window.to && day > window.to) continue;
    if (isWeekend(day) || isHoliday(day)) continue;

    if (singleDay) {
      total += request.start_half_day || request.end_half_day ? 0.5 : 1;
      continue;
    }

    let value = 1;
    if (day === request.start_date && request.start_half_day) value = 0.5;
    if (day === request.end_date && request.end_half_day) value = 0.5;
    total += value;
  }

  return total;
}

/** Nachschlagefunktion aus einer Feiertagsliste. */
export function holidayLookup(days: Iterable<string>): (day: string) => boolean {
  const set = new Set(days);
  return (day) => set.has(day);
}

export type YearBalance = {
  year: number;
  /** Jahresanspruch laut Kontingent; 0, wenn für das Jahr nichts hinterlegt ist. */
  annualDays: number;
  /** Übertrag aus dem Vorjahr — kann negativ sein. */
  carryIn: number;
  /** Stichtag, an dem der Übertrag verfällt (null: kein Verfall). */
  carryExpiresOn: string | null;
  /** Anteil des Übertrags, der bis zum Stichtag nicht verbraucht wurde. */
  carryForfeited: number;
  /** Übertrag nach Verfall plus Jahresanspruch. */
  available: number;
  usedVacation: number;
  pendingVacation: number;
  usedSpecial: number;
  /** Verfügbar minus genehmigter Urlaub. Negativ, wenn zu viel genehmigt wurde. */
  closing: number;
  /** Saldo abzüglich noch offener Anträge — was realistisch übrig bleibt. */
  remaining: number;
  /** Was ins Folgejahr wandert (durch carryover_max gedeckelt, negativ voll). */
  carryOut: number;
  /** Positiver Rest, der zum Jahresende über die Obergrenze hinaus verfällt. */
  lostAtYearEnd: number;
  /** Der Vortrag wurde von Hand gesetzt statt aus dem Vorjahr errechnet. */
  carryIsManual: boolean;
  /** Jahr, aus dem das Kontingent übernommen wurde (null: eigener Eintrag). */
  inheritedFrom: number | null;
  /** Für dieses und alle früheren Jahre ist gar kein Kontingent hinterlegt. */
  missingEntitlement: boolean;
};

export type ResolvedEntitlement = {
  annualDays: number;
  carryoverMax: number;
  carryExpiresOn: string | null;
  /** Nur bei einem eigenen Eintrag für dieses Jahr gesetzt. */
  openingCarryover: number | null;
  openingCarryoverExpiresOn: string | null;
  /** Jahr des zugrunde liegenden Eintrags. */
  sourceYear: number;
};

/** Verschiebt ein Datum um ganze Jahre — für fortgeschriebene Verfallstage. */
function shiftYear(iso: string | null, years: number): string | null {
  if (!iso) return null;
  return `${Number(iso.slice(0, 4)) + years}${iso.slice(4)}`;
}

/**
 * Kontingent eines Jahres. Fehlt der Eintrag, gelten die Werte des zuletzt
 * hinterlegten früheren Jahres weiter — so muss der Administrator nur etwas
 * eintragen, wenn sich tatsächlich etwas ändert.
 */
export function resolveEntitlement(
  entitlements: Entitlement[],
  year: number,
): ResolvedEntitlement | null {
  const exact = entitlements.find((e) => e.year === year);
  const source =
    exact ??
    entitlements
      .filter((e) => e.year < year)
      .sort((a, b) => b.year - a.year)[0];

  if (!source) return null;

  const shift = year - source.year;
  return {
    annualDays: Number(source.annual_days),
    carryoverMax: Number(source.carryover_max),
    carryExpiresOn: shiftYear(source.carryover_expires_on, shift),
    // Ein Startsaldo gilt genau für sein Jahr und wird nicht fortgeschrieben.
    openingCarryover:
      exact && source.opening_carryover !== null
        ? Number(source.opening_carryover)
        : null,
    openingCarryoverExpiresOn: exact
      ? source.opening_carryover_expires_on
      : null,
    sourceYear: source.year,
  };
}

function sumDays(
  requests: LeaveRequest[],
  isHoliday: (day: string) => boolean,
  window: DateWindow,
): number {
  return requests.reduce((sum, r) => sum + requestDays(r, isHoliday, window), 0);
}

/**
 * Salden für eine Spanne von Kalenderjahren. Die Jahre bauen aufeinander auf,
 * deshalb wird immer ab dem frühesten bekannten Jahr gerechnet.
 */
export function computeBalances(
  entitlements: Entitlement[],
  requests: LeaveRequest[],
  isHoliday: (day: string) => boolean,
  throughYear: number,
): Map<number, YearBalance> {
  const years = [
    ...entitlements.map((e) => e.year),
    ...requests.map((r) => Number(r.start_date.slice(0, 4))),
  ];
  const firstYear = years.length ? Math.min(...years) : throughYear;

  const approvedVacation = requests.filter(
    (r) => r.status === "approved" && r.kind === "vacation",
  );
  const pendingVacation = requests.filter(
    (r) => r.status === "pending" && r.kind === "vacation",
  );
  const approvedSpecial = requests.filter(
    (r) => r.status === "approved" && r.kind === "special",
  );

  const balances = new Map<number, YearBalance>();
  let carryIn = 0;
  let carryExpiresOn: string | null = null;

  for (let year = firstYear; year <= throughYear; year++) {
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;
    const entitlement = resolveEntitlement(entitlements, year);
    const annualDays = entitlement?.annualDays ?? 0;

    // Ein hinterlegter Startsaldo ersetzt den errechneten Vortrag. Das
    // braucht das erste Jahr nach dem Umstieg aus einem früheren System.
    const carryIsManual = entitlement?.openingCarryover != null;
    if (entitlement && entitlement.openingCarryover != null) {
      carryIn = entitlement.openingCarryover;
      carryExpiresOn = entitlement.openingCarryoverExpiresOn;
    }

    const usedVacation = sumDays(approvedVacation, isHoliday, { from, to });
    const pending = sumDays(pendingVacation, isHoliday, { from, to });
    const usedSpecial = sumDays(approvedSpecial, isHoliday, { from, to });

    // Der Übertrag wird zuerst verbraucht. Was bis zum Stichtag übrig ist,
    // verfällt. Ohne Stichtag verfällt nichts.
    let carryForfeited = 0;
    if (carryIn > 0 && carryExpiresOn) {
      const usedByDeadline = sumDays(approvedVacation, isHoliday, {
        from,
        to: carryExpiresOn < to ? carryExpiresOn : to,
      });
      carryForfeited = Math.max(0, carryIn - usedByDeadline);
    }

    const available = carryIn - carryForfeited + annualDays;
    const closing = available - usedVacation;

    const maxCarry = entitlement?.carryoverMax ?? 0;
    const carryOut = closing > 0 ? Math.min(closing, maxCarry) : closing;
    const lostAtYearEnd = closing > 0 ? closing - carryOut : 0;

    balances.set(year, {
      year,
      annualDays,
      carryIn,
      carryExpiresOn,
      carryForfeited,
      available,
      usedVacation,
      pendingVacation: pending,
      usedSpecial,
      closing,
      remaining: closing - pending,
      carryOut,
      lostAtYearEnd,
      carryIsManual,
      inheritedFrom:
        entitlement && entitlement.sourceYear !== year
          ? entitlement.sourceYear
          : null,
      missingEntitlement: !entitlement,
    });

    carryIn = carryOut;
    carryExpiresOn = entitlement?.carryExpiresOn ?? null;
  }

  return balances;
}

/** Leerer Saldo für Jahre ganz ohne Daten. */
export function emptyBalance(year: number): YearBalance {
  return {
    year,
    annualDays: 0,
    carryIn: 0,
    carryExpiresOn: null,
    carryForfeited: 0,
    available: 0,
    usedVacation: 0,
    pendingVacation: 0,
    usedSpecial: 0,
    closing: 0,
    remaining: 0,
    carryOut: 0,
    lostAtYearEnd: 0,
    carryIsManual: false,
    inheritedFrom: null,
    missingEntitlement: true,
  };
}

/** Prüft, ob sich zwei Anträge überschneiden. */
export function overlaps(
  a: Pick<LeaveRequest, "start_date" | "end_date">,
  b: Pick<LeaveRequest, "start_date" | "end_date">,
): boolean {
  return a.start_date <= b.end_date && b.start_date <= a.end_date;
}

/**
 * Urlaube anderer Mitarbeiter, die sich mit einem Antrag überschneiden.
 * Zurückgezogene und abgelehnte Anträge bleiben aussen vor.
 */
export function clashesFor(
  target: LeaveRequest,
  all: LeaveRequest[],
  people: Map<string, Profile>,
): TeamAbsence[] {
  return all
    .filter(
      (other) =>
        other.id !== target.id &&
        other.profile_id !== target.profile_id &&
        (other.status === "approved" || other.status === "pending") &&
        overlaps(other, target),
    )
    .map((other) => {
      const person = people.get(other.profile_id);
      return {
        profile_id: other.profile_id,
        full_name: person?.full_name || person?.email || "Unbekannt",
        country: person?.country ?? "AT",
        start_date: other.start_date,
        end_date: other.end_date,
        start_half_day: other.start_half_day,
        end_half_day: other.end_half_day,
        kind: other.kind,
        status: other.status,
      } satisfies TeamAbsence;
    })
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
}
