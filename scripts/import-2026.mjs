/**
 * Einmalige Übernahme bereits genehmigter Urlaube.
 * Wiederholbar: Zeiträume, die schon erfasst sind, werden übersprungen.
 */
import { createClient } from "@supabase/supabase-js";
import { generateHolidays } from "../src/lib/holidays.mjs";

const PEOPLE = {
  "silvia@oylio.com": [
    ["2026-01-02", "2026-01-02"],
    ["2026-02-06", "2026-02-06"],
    ["2026-02-20", "2026-02-20"],
    ["2026-03-30", "2026-04-03"],
    ["2026-04-13", "2026-04-13"],
    ["2026-04-24", "2026-04-24"],
    ["2026-07-10", "2026-07-10"],
  ],
  "steffen@oylio.com": [
    ["2026-01-01", "2026-01-03"],
    ["2026-03-02", "2026-03-02"],
    ["2026-04-06", "2026-04-11"],
    ["2026-04-30", "2026-04-30"],
    ["2026-05-27", "2026-05-30"],
    ["2026-07-31", "2026-08-05"],
    ["2026-08-24", "2026-08-29"],
  ],
};

const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const WEEKDAY = new Intl.DateTimeFormat("de-AT", {
  weekday: "short",
  timeZone: "UTC",
});

function eachDay(from, to) {
  const days = [];
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (d <= end) {
    days.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
}

function analyse(from, to, holidays) {
  let count = 0;
  const skipped = [];
  for (const day of eachDay(from, to)) {
    const wd = new Date(`${day}T00:00:00Z`).getUTCDay();
    if (wd === 0 || wd === 6) {
      skipped.push(`${day} Wochenende`);
      continue;
    }
    if (holidays.has(day)) {
      skipped.push(`${day} ${holidays.get(day)}`);
      continue;
    }
    count++;
  }
  return { count, skipped };
}

const { data: adminRow } = await s
  .from("profiles")
  .select("id")
  .eq("role", "admin")
  .limit(1)
  .single();

const toInsert = [];

for (const [email, ranges] of Object.entries(PEOPLE)) {
  const { data: person, error } = await s
    .from("profiles")
    .select("id, full_name, country")
    .eq("email", email)
    .single();
  if (error) throw new Error(`${email}: ${error.message}`);

  const holidays = new Map(
    [2026, 2027].flatMap((y) =>
      generateHolidays(person.country, y).map((h) => [h.day, h.name]),
    ),
  );

  const { data: existing } = await s
    .from("leave_requests")
    .select("start_date, end_date")
    .eq("profile_id", person.id);
  const known = new Set(
    (existing ?? []).map((r) => `${r.start_date}|${r.end_date}`),
  );

  console.log(`\n${person.full_name} — Feiertage ${person.country}\n`);
  let total = 0;

  for (const [from, to] of [...ranges].sort()) {
    const { count, skipped } = analyse(from, to, holidays);
    total += count;
    const dup = known.has(`${from}|${to}`);
    const wd = WEEKDAY.format(new Date(`${from}T00:00:00Z`));

    console.log(
      `  ${wd} ${from} – ${to}  ${String(count).padStart(2)} Tag(e)` +
        (skipped.length ? `\n        ohne: ${skipped.join(", ")}` : "") +
        (dup ? "   [schon vorhanden]" : ""),
    );

    if (!dup) {
      toInsert.push({
        profile_id: person.id,
        kind: "vacation",
        start_date: from,
        end_date: to,
        start_half_day: false,
        end_half_day: false,
        reason: "Übernahme aus der bisherigen Aufzeichnung",
        status: "approved",
        decided_by: adminRow?.id ?? null,
        decided_at: new Date().toISOString(),
        decision_note: "Bereits geprüft und genehmigt.",
      });
    }
  }

  console.log(`\n  Summe: ${total} Tage`);
}

console.log("");

if (toInsert.length === 0) {
  console.log("Nichts einzutragen — alle Zeiträume sind schon erfasst.");
} else {
  const { error } = await s.from("leave_requests").insert(toInsert);
  if (error) throw error;
  console.log(`${toInsert.length} Anträge eingetragen.`);
}
