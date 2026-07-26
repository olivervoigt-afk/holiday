/**
 * Einmalige Einrichtung: legt die Startkonten an, hinterlegt ihre
 * Jahreskontingente und füllt die Feiertagslisten.
 *
 *   node --env-file=.env.local scripts/seed.mjs
 *
 * Das Skript ist wiederholbar. Bestehende Konten werden nicht überschrieben,
 * bestehende Feiertage bleiben unverändert. Die Startpasswörter werden nur
 * beim ersten Lauf erzeugt und ausgegeben.
 */

import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { generateHolidays } from "../src/lib/holidays.mjs";

const YEAR = new Date().getFullYear();

/**
 * Startbelegschaft. Die Kontingente stammen aus der Abstimmung vom
 * 26.07.2026; `openingCarryover` ist der Vortrag aus dem Vorjahr, der noch
 * aus der bisherigen Aufzeichnung stammt.
 */
const PEOPLE = [
  {
    email: "oliver@oylio.com",
    full_name: "Oliver Voigt",
    role: "admin",
    country: "AT",
    annualDays: 25,
    openingCarryover: null,
    note: "Platzhalter — bitte prüfen und anpassen.",
  },
  {
    email: "silvia@oylio.com",
    full_name: "Silvia Baburek",
    role: "user",
    country: "MT",
    annualDays: 30,
    openingCarryover: -2.5,
    note: `Vortrag aus ${YEAR - 1} manuell übernommen.`,
  },
  {
    email: "steffen@oylio.com",
    full_name: "Steffen Schumacher",
    role: "user",
    country: "MT",
    annualDays: 28,
    openingCarryover: 2,
    note: `Vortrag aus ${YEAR - 1} manuell übernommen.`,
  },
];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen gesetzt sein.\n" +
      "Aufruf: node --env-file=.env.local scripts/seed.mjs",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Gut lesbares Startpasswort, das trotzdem nicht zu erraten ist. */
function newPassword() {
  return randomBytes(9).toString("base64url");
}

async function findUserByEmail(email) {
  // Die Admin-API kennt keine Suche nach E-Mail, deshalb blättern.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function seedPeople() {
  const created = [];

  for (const person of PEOPLE) {
    const email = person.email.toLowerCase();
    let user = await findUserByEmail(email);
    let password = null;

    if (user) {
      console.log(`· ${person.full_name}: Konto besteht bereits`);
    } else {
      password = newPassword();
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: person.full_name,
          role: person.role,
          country: person.country,
        },
      });
      if (error) throw new Error(`${email}: ${error.message}`);
      user = data.user;
      created.push({ ...person, password });
      console.log(`· ${person.full_name}: angelegt`);
    }

    // Der Trigger legt das Profil an — Rolle und Land hier absichern.
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: person.full_name,
        role: person.role,
        country: person.country,
        active: true,
      })
      .eq("id", user.id);
    if (profileError) throw profileError;

    // Kontingent des laufenden Jahres. Nicht genutzte Tage wandern
    // vollständig ins Folgejahr und verfallen dort Ende März.
    const { error: entitlementError } = await supabase
      .from("leave_entitlements")
      .upsert(
        {
          profile_id: user.id,
          year: YEAR,
          annual_days: person.annualDays,
          carryover_max: person.annualDays,
          carryover_expires_on: `${YEAR + 1}-03-31`,
          opening_carryover: person.openingCarryover,
          opening_carryover_expires_on: null,
          note: person.note,
        },
        { onConflict: "profile_id,year" },
      );
    if (entitlementError) throw entitlementError;
  }

  return created;
}

async function seedHolidays() {
  const rows = [];
  for (const country of ["AT", "MT"]) {
    for (const year of [YEAR - 1, YEAR, YEAR + 1]) {
      for (const holiday of generateHolidays(country, year)) {
        rows.push({ country, ...holiday });
      }
    }
  }

  const { error } = await supabase
    .from("holidays")
    .upsert(rows, { onConflict: "country,day", ignoreDuplicates: true });
  if (error) throw error;

  console.log(
    `· Feiertage ${YEAR - 1}–${YEAR + 1} für Österreich und Malta ergänzt`,
  );
}

async function main() {
  console.log("Richte die Urlaubsverwaltung ein …\n");
  const created = await seedPeople();
  await seedHolidays();

  if (created.length > 0) {
    console.log("\nStartpasswörter — bitte persönlich weitergeben:\n");
    for (const person of created) {
      console.log(`  ${person.email.padEnd(24)} ${person.password}`);
    }
    console.log(
      "\nDiese Ausgabe erscheint nur einmal. Jeder sollte das Passwort\n" +
        "nach der ersten Anmeldung unter „Konto“ ändern.",
    );
  } else {
    console.log("\nAlle Konten waren bereits vorhanden.");
  }
}

main().catch((error) => {
  console.error("\nFehlgeschlagen:", error.message ?? error);
  process.exit(1);
});
