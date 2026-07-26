import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Profile } from "./types";

/** Profil des angemeldeten Benutzers, oder null. */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (data as Profile) ?? null;
}

export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  // Ausgeschiedene Mitarbeiter behalten ihre Historie, kommen aber nicht mehr
  // in die Anwendung.
  if (!profile.active) redirect("/login?fehler=gesperrt");
  return profile;
}

/**
 * Erzwingt Administratorrechte. Server Actions sind auch per direktem POST
 * erreichbar, deshalb wird die Rolle in jeder Aktion erneut geprüft.
 */
export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "admin") {
    throw new Error("Keine Berechtigung: Administratorrechte erforderlich.");
  }
  return profile;
}
