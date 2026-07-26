/**
 * Welche Kalenderjahre die Anwendung führt.
 *
 * Vor 2026 gibt es keine Daten — die Aufzeichnung beginnt mit dem Umstieg.
 * Nach vorn wird zwei Jahre geplant, damit im Herbst schon das übernächste
 * Jahr beantragt werden kann.
 */

export const FIRST_YEAR = 2026;
export const YEARS_AHEAD = 2;

export const currentYear = () => new Date().getFullYear();

/** Letztes Jahr, für das ein Saldo gerechnet wird. */
export function lastYear(reference = currentYear()): number {
  return reference + YEARS_AHEAD;
}

/**
 * Die Jahre, die zur Auswahl stehen: ab 2026, eines zurück und zwei voraus.
 * So bleibt die Leiste auch in einigen Jahren kurz.
 */
export function selectableYears(reference = currentYear()): number[] {
  const from = Math.max(FIRST_YEAR, reference - 1);
  const to = lastYear(reference);
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

/** Liest ?jahr= aus der Adresse und begrenzt den Wert auf die Auswahl. */
export function resolveYear(raw: string | string[] | undefined): number {
  const years = selectableYears();
  const value = Number(Array.isArray(raw) ? raw[0] : raw);
  return years.includes(value) ? value : currentYear();
}
