import {
  easterSunday,
  generateHolidays as generate,
  toISODate,
} from "./holidays.mjs";
import type { CountryCode } from "./types";

/**
 * Getypte Hülle um `holidays.mjs`. Die Berechnung liegt dort, damit das
 * Einrichtungsskript (`npm run seed`) dieselben Daten erzeugt wie die
 * Anwendung.
 */

export { easterSunday, toISODate };

export type GeneratedHoliday = { day: string; name: string };

/** Gesetzliche Feiertage eines Landes für ein Kalenderjahr. */
export function generateHolidays(
  country: CountryCode,
  year: number,
): GeneratedHoliday[] {
  return generate(country, year);
}
