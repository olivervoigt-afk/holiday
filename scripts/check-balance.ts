import { computeBalances, holidayLookup, requestDays } from "../src/lib/leave";
import { generateHolidays } from "../src/lib/holidays";
import type { Entitlement, LeaveRequest } from "../src/lib/types";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}: ${JSON.stringify(actual)}${ok ? "" : ` (erwartet ${JSON.stringify(expected)})`}`);
}

const mt = holidayLookup(
  [2025, 2026, 2027].flatMap((y) => generateHolidays("MT", y).map((h) => h.day)),
);
const at = holidayLookup(
  [2025, 2026, 2027].flatMap((y) => generateHolidays("AT", y).map((h) => h.day)),
);

function ent(p: Partial<Entitlement> & { year: number }): Entitlement {
  return {
    id: `e${p.year}`,
    profile_id: "p",
    annual_days: 25,
    carryover_max: 0,
    carryover_expires_on: null,
    opening_carryover: null,
    opening_carryover_expires_on: null,
    note: "",
    created_at: "",
    ...p,
  } as Entitlement;
}

function req(p: Partial<LeaveRequest> & { start_date: string; end_date: string }): LeaveRequest {
  return {
    id: `r${p.start_date}`,
    profile_id: "p",
    kind: "vacation",
    start_half_day: false,
    end_half_day: false,
    reason: "",
    status: "approved",
    decided_by: null,
    decided_at: null,
    decision_note: "",
    created_at: "",
    updated_at: "",
    ...p,
  } as LeaveRequest;
}

console.log("\n— Arbeitstage —");
// Mo 2026-08-03 bis Fr 2026-08-07 = 5 Arbeitstage
check("Mo–Fr", requestDays(req({ start_date: "2026-08-03", end_date: "2026-08-07" }), mt), 5);
// über ein Wochenende: Fr bis Mo = 2
check("Fr–Mo", requestDays(req({ start_date: "2026-08-07", end_date: "2026-08-10" }), mt), 2);
// halber erster Tag
check("halber Beginn", requestDays(req({ start_date: "2026-08-03", end_date: "2026-08-07", start_half_day: true }), mt), 4.5);
// einzelner halber Tag
check("halber Einzeltag", requestDays(req({ start_date: "2026-08-03", end_date: "2026-08-03", start_half_day: true }), mt), 0.5);
// Malta: 15.08.2026 ist ein Samstag, 8.9.2026 ein Dienstag (Feiertag)
check("MT Feiertag 08.09.2026", requestDays(req({ start_date: "2026-09-07", end_date: "2026-09-09" }), mt), 2);
// Malta: 24. und 31.12. sind geschenkt, dazu 25.12. und 01.01. — bleiben
// 21.–23. und 28.–30.12.
check("MT 21.12.–01.01.", requestDays(req({ start_date: "2026-12-21", end_date: "2027-01-01" }), mt), 6);
// Österreich kennt den 24./31.12. nicht — zwei Arbeitstage mehr.
check("AT 21.12.–01.01.", requestDays(req({ start_date: "2026-12-21", end_date: "2027-01-01" }), at), 8);

console.log("\n— Steffen: 28 Tage, Startsaldo +2 —");
const steffen = computeBalances(
  [ent({ year: 2026, annual_days: 28, carryover_max: 28, carryover_expires_on: "2027-03-31", opening_carryover: 2 })],
  [req({ start_date: "2026-08-03", end_date: "2026-08-14" })], // 10 Tage
  mt,
  2027,
);
const s26 = steffen.get(2026)!;
check("Vortrag 2026", s26.carryIn, 2);
check("manuell gesetzt", s26.carryIsManual, true);
check("verfügbar 2026", s26.available, 30);
check("verbraucht 2026", s26.usedVacation, 10);
check("Saldo 2026", s26.closing, 20);
check("Übertrag nach 2027", s26.carryOut, 20);

const s27 = steffen.get(2027)!;
check("2027 erbt Kontingent aus", s27.inheritedFrom, 2026);
check("Vortrag 2027", s27.carryIn, 20);
check("Verfall des Übertrags 2026→2027", s27.carryExpiresOn, "2027-03-31");
check("Anspruch 2027 fortgeschrieben", s27.annualDays, 28);

console.log("\n— Silvia: 30 Tage, Startsaldo −2,5 —");
const silvia = computeBalances(
  [ent({ year: 2026, annual_days: 30, carryover_max: 30, carryover_expires_on: "2027-03-31", opening_carryover: -2.5 })],
  [],
  mt,
  2026,
);
const v26 = silvia.get(2026)!;
check("Vortrag", v26.carryIn, -2.5);
check("verfügbar", v26.available, 27.5);
check("Saldo", v26.closing, 27.5);

console.log("\n— Verfall des Übertrags —");
// 10 Tage Übertrag, Verfall 31.03., nur 3 Tage bis dahin verbraucht
const verfall = computeBalances(
  [
    ent({ year: 2025, annual_days: 10, carryover_max: 10, carryover_expires_on: "2026-03-31" }),
    ent({ year: 2026, annual_days: 25, carryover_max: 0 }),
  ],
  [req({ start_date: "2026-02-02", end_date: "2026-02-04" })], // 3 Tage im Februar
  at,
  2026,
);
const f26 = verfall.get(2026)!;
check("Vortrag", f26.carryIn, 10);
check("davon verfallen", f26.carryForfeited, 7);
check("verfügbar", f26.available, 28);
check("Saldo", f26.closing, 25);

console.log("\n— Negativer Vortrag durch Übergenehmigung —");
const minus = computeBalances(
  [ent({ year: 2026, annual_days: 5, carryover_max: 5 })],
  [req({ start_date: "2026-08-03", end_date: "2026-08-14" })], // 10 Tage
  at,
  2027,
);
check("Saldo 2026", minus.get(2026)!.closing, -5);
check("Vortrag 2027 negativ", minus.get(2027)!.carryIn, -5);
check("verfügbar 2027", minus.get(2027)!.available, 0);

console.log("\n— Antrag über den Jahreswechsel —");
const wechsel = computeBalances(
  [ent({ year: 2026, annual_days: 25, carryover_max: 25 }), ent({ year: 2027, annual_days: 25 })],
  [req({ start_date: "2026-12-28", end_date: "2027-01-08" })],
  at,
  2027,
);
// AT: 28.–31.12.2026 sind Mo–Do (4 Tage, 25.+26.12. liegen davor)
check("Tage in 2026", wechsel.get(2026)!.usedVacation, 4);
// 01.01. und 06.01.2027 sind Feiertage — bleiben 04., 05., 07., 08.01.
check("Tage in 2027", wechsel.get(2027)!.usedVacation, 4);

console.log(failures === 0 ? "\nAlle Prüfungen bestanden." : `\n${failures} Prüfung(en) fehlgeschlagen.`);
process.exit(failures === 0 ? 0 : 1);
