import { computeBalances, holidayLookup } from "./leave";
import { createClient } from "./supabase/server";
import type {
  CountryCode,
  Entitlement,
  Holiday,
  LeaveRequest,
  Notification,
  Profile,
  TeamAbsence,
} from "./types";

export const currentYear = () => new Date().getFullYear();

export async function countUnread(profileId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .is("read_at", null);
  return count ?? 0;
}

export async function getNotifications(
  profileId: string,
): Promise<Notification[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data as Notification[]) ?? [];
}

export async function getHolidays(country?: CountryCode): Promise<Holiday[]> {
  const supabase = await createClient();
  let query = supabase.from("holidays").select("*").order("day");
  if (country) query = query.eq("country", country);
  const { data } = await query;
  return (data as Holiday[]) ?? [];
}

/** Nachschlagefunktion für die Feiertage eines Landes. */
export async function holidaysFor(country: CountryCode) {
  const holidays = await getHolidays(country);
  return holidayLookup(holidays.map((h) => h.day));
}

export async function getProfiles(includeInactive = false): Promise<Profile[]> {
  const supabase = await createClient();
  let query = supabase.from("profiles").select("*").order("full_name");
  if (!includeInactive) query = query.eq("active", true);
  const { data } = await query;
  return (data as Profile[]) ?? [];
}

export async function getProfileById(id: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as Profile) ?? null;
}

export async function getEntitlements(
  profileId: string,
): Promise<Entitlement[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leave_entitlements")
    .select("*")
    .eq("profile_id", profileId)
    .order("year");
  return (data as Entitlement[]) ?? [];
}

export async function getRequests(profileId: string): Promise<LeaveRequest[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leave_requests")
    .select("*")
    .eq("profile_id", profileId)
    .order("start_date", { ascending: false });
  return (data as LeaveRequest[]) ?? [];
}

/** Alle Anträge — die Auswahl beschränkt RLS auf das Erlaubte. */
export async function getAllRequests(): Promise<LeaveRequest[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leave_requests")
    .select("*")
    .order("start_date", { ascending: false });
  return (data as LeaveRequest[]) ?? [];
}

export async function getPendingRequests(): Promise<LeaveRequest[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leave_requests")
    .select("*")
    .eq("status", "pending")
    .order("start_date");
  return (data as LeaveRequest[]) ?? [];
}

/**
 * Offene und genehmigte Abwesenheiten der Kollegen in einem Zeitraum.
 * Die Datenbankfunktion liefert nur Name und Zeitraum und beschränkt das
 * Ergebnis auf das eigene Land.
 */
export async function getTeamAbsences(
  from: string,
  to: string,
): Promise<TeamAbsence[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("team_absences", {
    from_day: from,
    to_day: to,
  });
  if (error) {
    console.error("team_absences fehlgeschlagen:", error.message);
    return [];
  }
  return (data as TeamAbsence[]) ?? [];
}

async function getAllEntitlements(): Promise<Entitlement[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leave_entitlements")
    .select("*")
    .order("year");
  return (data as Entitlement[]) ?? [];
}

/**
 * Salden aller Mitarbeiter für ein Jahr — Grundlage der Admin-Übersicht.
 * Lädt Profile, Kontingente, Anträge und Feiertage in einem Zug und rechnet
 * die Jahre je Person durch.
 */
export async function getTeamOverview(year: number, includeInactive = false) {
  const [profiles, entitlements, requests, holidays] = await Promise.all([
    getProfiles(includeInactive),
    getAllEntitlements(),
    getAllRequests(),
    getHolidays(),
  ]);

  const lookups = new Map<CountryCode, (day: string) => boolean>();
  for (const country of ["AT", "MT"] as CountryCode[]) {
    lookups.set(
      country,
      holidayLookup(holidays.filter((h) => h.country === country).map((h) => h.day)),
    );
  }

  const rows = profiles.map((profile) => {
    const isHoliday = lookups.get(profile.country)!;
    const own = requests.filter((r) => r.profile_id === profile.id);
    const balances = computeBalances(
      entitlements.filter((e) => e.profile_id === profile.id),
      own,
      isHoliday,
      Math.max(year, currentYear()),
    );
    return { profile, balance: balances.get(year), requests: own, isHoliday };
  });

  return { rows, requests, holidays, lookups };
}

/**
 * Kontingente, Anträge und Salden eines Mitarbeiters in einem Rutsch.
 * Gerechnet wird bis einschliesslich Folgejahr, damit im Herbst bereits
 * Anträge für das nächste Jahr erfasst werden können.
 */
export async function getLeaveOverview(profile: Profile, throughYear?: number) {
  const [entitlements, requests, isHoliday] = await Promise.all([
    getEntitlements(profile.id),
    getRequests(profile.id),
    holidaysFor(profile.country),
  ]);

  const last = throughYear ?? currentYear() + 1;
  const balances = computeBalances(entitlements, requests, isHoliday, last);

  return { entitlements, requests, isHoliday, balances };
}
