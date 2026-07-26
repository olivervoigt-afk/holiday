"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { generateHolidays } from "@/lib/holidays";
import { createClient } from "@/lib/supabase/server";
import { COUNTRIES, COUNTRY_LABELS, type CountryCode } from "@/lib/types";
import type { ActionState } from "./auth";

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/**
 * Legt die gesetzlichen Feiertage eines Landes für ein Jahr an. Bereits
 * vorhandene Tage bleiben unangetastet, damit eigene Korrekturen erhalten
 * bleiben.
 */
export async function generateYear(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const country = text(formData, "country") as CountryCode;
  const year = Number(text(formData, "year"));

  if (!COUNTRIES.includes(country)) return { error: "Unbekanntes Land." };
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return { error: "Bitte ein Jahr zwischen 2000 und 2100 angeben." };
  }

  const rows = generateHolidays(country, year).map((h) => ({ ...h, country }));

  const supabase = await createClient();
  const { error } = await supabase
    .from("holidays")
    .upsert(rows, { onConflict: "country,day", ignoreDuplicates: true });

  if (error) return { error: error.message };

  revalidatePath("/feiertage");
  revalidatePath("/");
  return {
    success: `Feiertage ${year} für ${COUNTRY_LABELS[country]} ergänzt.`,
  };
}

export async function addHoliday(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const country = text(formData, "country") as CountryCode;
  const day = text(formData, "day");
  const name = text(formData, "name");

  if (!COUNTRIES.includes(country)) return { error: "Unbekanntes Land." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { error: "Bitte ein Datum wählen." };
  if (!name) return { error: "Bitte eine Bezeichnung angeben." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("holidays")
    .insert({ country, day, name });

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Für diesen Tag gibt es bereits einen Eintrag."
          : error.message,
    };
  }

  revalidatePath("/feiertage");
  revalidatePath("/");
  return { success: `${name} hinzugefügt.` };
}

export async function deleteHoliday(formData: FormData) {
  await requireAdmin();

  const id = text(formData, "id");
  const supabase = await createClient();
  await supabase.from("holidays").delete().eq("id", id);

  revalidatePath("/feiertage");
  revalidatePath("/");
}
