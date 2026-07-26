"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  COUNTRIES,
  type CountryCode,
  type UserRole,
} from "@/lib/types";
import type { ActionState } from "./auth";

const ROLES: UserRole[] = ["admin", "user"];

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/** Nimmt "12,5" ebenso wie "12.5" entgegen. */
function days(formData: FormData, key: string, fallback = 0): number {
  const raw = text(formData, key).replace(",", ".");
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.round(value * 2) / 2 : fallback;
}

/** Wie days(), aber leer bleibt leer — für den optionalen Startsaldo. */
function optionalDays(formData: FormData, key: string): number | null {
  const raw = text(formData, key).replace(",", ".").replace("−", "-");
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.round(value * 2) / 2 : null;
}

/** Stellt sicher, dass mindestens ein aktiver Administrator übrig bleibt. */
async function otherAdminsExist(exceptId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin")
    .eq("active", true)
    .neq("id", exceptId);
  return (count ?? 0) > 0;
}

export async function createUser(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const email = text(formData, "email").toLowerCase();
  const full_name = text(formData, "full_name");
  const password = text(formData, "password");
  const role = text(formData, "role") as UserRole;
  const country = text(formData, "country") as CountryCode;

  if (!email || !full_name) {
    return { error: "Bitte Name und E-Mail angeben." };
  }
  if (password.length < 8) {
    return { error: "Das Startpasswort muss mindestens 8 Zeichen haben." };
  }
  if (!ROLES.includes(role)) return { error: "Unbekannte Rolle." };
  if (!COUNTRIES.includes(country)) return { error: "Unbekanntes Land." };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role, country },
  });

  if (error) {
    return {
      error: error.message.includes("already")
        ? "Für diese E-Mail gibt es bereits ein Konto."
        : error.message,
    };
  }

  // Der Trigger legt das Profil an; Name, Rolle und Land hier absichern.
  await admin
    .from("profiles")
    .update({ full_name, role, country })
    .eq("id", data.user.id);

  // Startkontingent für das laufende Jahr, damit sofort beantragt werden kann.
  const year = new Date().getFullYear();
  await admin.from("leave_entitlements").insert({
    profile_id: data.user.id,
    year,
    annual_days: days(formData, "annual_days", 25),
    carryover_max: days(formData, "carryover_max", 0),
    carryover_expires_on: text(formData, "carryover_expires_on") || null,
  });

  revalidatePath("/mitarbeiter");
  return { success: `${full_name} wurde angelegt.` };
}

export async function updateUser(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await requireAdmin();

  const id = text(formData, "id");
  const full_name = text(formData, "full_name");
  const role = text(formData, "role") as UserRole;
  const country = text(formData, "country") as CountryCode;
  const active = formData.get("active") === "on";

  if (!full_name) return { error: "Bitte einen Namen angeben." };
  if (!ROLES.includes(role)) return { error: "Unbekannte Rolle." };
  if (!COUNTRIES.includes(country)) return { error: "Unbekanntes Land." };

  if ((role !== "admin" || !active) && !(await otherAdminsExist(id))) {
    return {
      error:
        "Das ist der einzige aktive Administrator — bitte zuerst einen zweiten anlegen.",
    };
  }
  if (id === me.id && (role !== "admin" || !active)) {
    return { error: "Die eigenen Administratorrechte lassen sich nicht entziehen." };
  }

  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({ full_name, role, country, active })
    .eq("id", id);
  await admin.auth.admin.updateUserById(id, {
    user_metadata: { full_name, role, country },
    ban_duration: active ? "none" : "876000h", // gesperrt: 100 Jahre
  });

  revalidatePath("/mitarbeiter");
  revalidatePath(`/mitarbeiter/${id}`);
  return { success: "Änderungen gespeichert." };
}

export async function resetUserPassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = text(formData, "id");
  const password = text(formData, "password");

  if (password.length < 8) {
    return { error: "Das Passwort muss mindestens 8 Zeichen haben." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, { password });

  if (error) return { error: error.message };
  return { success: "Passwort neu gesetzt." };
}

export async function deleteUser(formData: FormData) {
  const me = await requireAdmin();

  const id = text(formData, "id");
  if (id === me.id) return; // Eigenes Konto nicht löschbar.
  if (!(await otherAdminsExist(id))) return;

  const admin = createAdminClient();
  await admin.auth.admin.deleteUser(id);

  revalidatePath("/mitarbeiter");
}

/* ---------------- Jahreskontingente ---------------- */

export async function saveEntitlement(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const profile_id = text(formData, "profile_id");
  const year = Number(text(formData, "year"));

  if (!profile_id || !Number.isInteger(year) || year < 2000 || year > 2100) {
    return { error: "Bitte ein gültiges Kalenderjahr angeben." };
  }

  const annual_days = days(formData, "annual_days", 0);
  const carryover_max = days(formData, "carryover_max", 0);
  const carryover_expires_on = text(formData, "carryover_expires_on") || null;
  const opening_carryover = optionalDays(formData, "opening_carryover");
  const opening_carryover_expires_on =
    text(formData, "opening_carryover_expires_on") || null;
  const note = text(formData, "note");

  if (annual_days < 0 || carryover_max < 0) {
    return { error: "Negative Werte sind hier nicht vorgesehen." };
  }
  if (opening_carryover_expires_on && opening_carryover === null) {
    return {
      error: "Ein Verfallstag für den Startsaldo braucht auch einen Startsaldo.",
    };
  }
  // Der Übertrag stammt aus diesem Jahr und verfällt im Folgejahr.
  if (carryover_expires_on && Number(carryover_expires_on.slice(0, 4)) <= year) {
    return {
      error: `Der Verfallstag gehört ins Jahr ${year + 1} oder später — der Übertrag aus ${year} wird ja erst dann verbraucht.`,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("leave_entitlements").upsert(
    {
      profile_id,
      year,
      annual_days,
      carryover_max,
      carryover_expires_on,
      opening_carryover,
      opening_carryover_expires_on,
      note,
    },
    { onConflict: "profile_id,year" },
  );

  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/mitarbeiter");
  revalidatePath(`/mitarbeiter/${profile_id}`);
  return { success: `Kontingent ${year} gespeichert.` };
}

export async function deleteEntitlement(formData: FormData) {
  await requireAdmin();

  const id = text(formData, "id");
  const profile_id = text(formData, "profile_id");

  const supabase = await createClient();
  await supabase.from("leave_entitlements").delete().eq("id", id);

  revalidatePath("/");
  revalidatePath(`/mitarbeiter/${profile_id}`);
}
