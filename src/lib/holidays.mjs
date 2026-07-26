/**
 * Feiertagsberechnung für Österreich und Malta.
 *
 * Bewusst als reines JavaScript gehalten, damit sowohl die Anwendung als auch
 * das Einrichtungsskript (`npm run seed`) dieselbe Quelle nutzen. Die
 * getypte Hülle liegt in `holidays.ts`.
 *
 * Beide Länder haben feste Termine und einige, die vom Osterdatum abhängen.
 * Die erzeugte Liste ist ein Vorschlag: der Administrator kann einzelne
 * Einträge im Feiertagsbereich ergänzen, umbenennen oder löschen.
 */

/**
 * Ostersonntag nach dem Gauß-/Meeus-Algorithmus (gregorianischer Kalender).
 * @param {number} year
 * @returns {Date}
 */
export function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = März, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * ISO-Datum ohne Zeitzonen-Verschiebung.
 * @param {Date} date
 * @returns {string}
 */
export function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

/** @returns {string} */
function iso(year, month, day) {
  return toISODate(new Date(Date.UTC(year, month - 1, day)));
}

/** @returns {string} */
function easterPlus(year, days) {
  const date = easterSunday(year);
  date.setUTCDate(date.getUTCDate() + days);
  return toISODate(date);
}

/** @returns {{ day: string, name: string }[]} */
function austria(year) {
  return [
    { day: iso(year, 1, 1), name: "Neujahr" },
    { day: iso(year, 1, 6), name: "Heilige Drei Könige" },
    { day: easterPlus(year, 1), name: "Ostermontag" },
    { day: iso(year, 5, 1), name: "Staatsfeiertag" },
    { day: easterPlus(year, 39), name: "Christi Himmelfahrt" },
    { day: easterPlus(year, 50), name: "Pfingstmontag" },
    { day: easterPlus(year, 60), name: "Fronleichnam" },
    { day: iso(year, 8, 15), name: "Mariä Himmelfahrt" },
    { day: iso(year, 10, 26), name: "Nationalfeiertag" },
    { day: iso(year, 11, 1), name: "Allerheiligen" },
    { day: iso(year, 12, 8), name: "Mariä Empfängnis" },
    { day: iso(year, 12, 25), name: "Christtag" },
    { day: iso(year, 12, 26), name: "Stefanitag" },
  ];
}

/** @returns {{ day: string, name: string }[]} */
function malta(year) {
  return [
    { day: iso(year, 1, 1), name: "L-Ewwel tas-Sena (Neujahr)" },
    { day: iso(year, 2, 10), name: "Nawfraġju ta' San Pawl" },
    { day: iso(year, 3, 19), name: "San Ġużepp" },
    { day: iso(year, 3, 31), name: "Jum il-Ħelsien (Freedom Day)" },
    { day: easterPlus(year, -2), name: "Il-Ġimgħa l-Kbira (Karfreitag)" },
    { day: iso(year, 5, 1), name: "Jum il-Ħaddiem (Tag der Arbeit)" },
    { day: iso(year, 6, 7), name: "Sette Giugno" },
    { day: iso(year, 6, 29), name: "L-Imnarja (San Pietru u San Pawl)" },
    { day: iso(year, 8, 15), name: "Santa Marija (Mariä Himmelfahrt)" },
    { day: iso(year, 9, 8), name: "Jum il-Vitorja" },
    { day: iso(year, 9, 21), name: "Jum l-Indipendenza" },
    { day: iso(year, 12, 8), name: "Il-Kunċizzjoni" },
    { day: iso(year, 12, 13), name: "Jum ir-Repubblika" },
    // Der 24. und der 31.12. sind auf Malta keine gesetzlichen Feiertage,
    // werden im Betrieb aber freigegeben.
    { day: iso(year, 12, 24), name: "Heiliger Abend (betrieblich frei)" },
    { day: iso(year, 12, 25), name: "Il-Milied" },
    { day: iso(year, 12, 31), name: "Silvester (betrieblich frei)" },
  ];
}

/**
 * Gesetzliche Feiertage eines Landes für ein Kalenderjahr.
 * @param {"AT" | "MT"} country
 * @param {number} year
 * @returns {{ day: string, name: string }[]}
 */
export function generateHolidays(country, year) {
  const list = country === "AT" ? austria(year) : malta(year);
  return list.sort((a, b) => a.day.localeCompare(b.day));
}
