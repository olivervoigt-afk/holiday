"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireProfile } from "@/lib/auth";
import { formatDayCount, formatRange } from "@/lib/format";
import { overlaps, requestDays, toISODate } from "@/lib/leave";
import { activeAdmins, notify } from "@/lib/notify";
import { getProfileById, holidaysFor } from "@/lib/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  BLOCKING_STATUSES,
  KIND_LABELS_SHORT,
  type LeaveKind,
  type LeaveRequest,
} from "@/lib/types";
import type { ActionState } from "./auth";

const KINDS: LeaveKind[] = ["vacation", "special"];

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function flag(formData: FormData, key: string): boolean {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Text für die Benachrichtigung, wenn im selben Zeitraum bereits andere
 * Mitarbeiter weg sind. Läuft über den Service-Role-Client, weil der
 * Antragsteller die Anträge der Kollegen nicht lesen darf.
 */
async function describeClashes(
  profileId: string,
  start_date: string,
  end_date: string,
): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("leave_requests")
    .select("start_date, end_date, status, profiles!inner(full_name, email)")
    .neq("profile_id", profileId)
    .in("status", BLOCKING_STATUSES)
    .lte("start_date", end_date)
    .gte("end_date", start_date)
    .order("start_date");

  const rows = (data ?? []) as unknown as {
    start_date: string;
    end_date: string;
    status: string;
    profiles: { full_name: string; email: string };
  }[];

  if (rows.length === 0) return "";

  const lines = rows.map(
    (r) =>
      `· ${r.profiles.full_name || r.profiles.email}: ${formatRange(r.start_date, r.end_date)}${r.status === "pending" ? " (noch offen)" : ""}`,
  );

  return `Achtung, Überschneidung mit:\n${lines.join("\n")}`;
}

export async function createRequest(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireProfile();

  const kind = text(formData, "kind") as LeaveKind;
  const start_date = text(formData, "start_date");
  const end_date = text(formData, "end_date");
  const start_half_day = flag(formData, "start_half_day");
  const end_half_day = flag(formData, "end_half_day");
  const reason = text(formData, "reason");

  if (!KINDS.includes(kind)) return { error: "Unbekannte Antragsart." };
  if (!ISO_DATE.test(start_date) || !ISO_DATE.test(end_date)) {
    return { error: "Bitte Beginn und Ende angeben." };
  }
  if (end_date < start_date) {
    return { error: "Das Ende darf nicht vor dem Beginn liegen." };
  }

  const isHoliday = await holidaysFor(profile.country);
  const days = requestDays(
    { start_date, end_date, start_half_day, end_half_day },
    isHoliday,
  );

  if (days <= 0) {
    return {
      error:
        "Der gewählte Zeitraum enthält keine Arbeitstage — er besteht nur aus Wochenenden und Feiertagen.",
    };
  }

  const supabase = await createClient();

  // Doppelbuchungen verhindern: offene und genehmigte Anträge dürfen sich
  // nicht überschneiden.
  const { data: existing } = await supabase
    .from("leave_requests")
    .select("start_date, end_date")
    .eq("profile_id", profile.id)
    .in("status", BLOCKING_STATUSES)
    .lte("start_date", end_date)
    .gte("end_date", start_date);

  if (
    (existing as Pick<LeaveRequest, "start_date" | "end_date">[] | null)?.some(
      (r) => overlaps(r, { start_date, end_date }),
    )
  ) {
    return {
      error: "Für diesen Zeitraum gibt es bereits einen Antrag.",
    };
  }

  // Der Administrator entscheidet ohnehin selbst — sein eigener Antrag gilt
  // deshalb sofort als genehmigt.
  const selfApproved = profile.role === "admin";

  const { error } = await supabase.from("leave_requests").insert({
    profile_id: profile.id,
    kind,
    start_date,
    end_date,
    start_half_day,
    end_half_day,
    reason,
    status: selfApproved ? "approved" : "pending",
    decided_by: selfApproved ? profile.id : null,
    decided_at: selfApproved ? new Date().toISOString() : null,
  });

  if (error) return { error: error.message };

  const name = profile.full_name || profile.email;
  const clashNote = await describeClashes(profile.id, start_date, end_date);

  for (const admin of await activeAdmins()) {
    if (admin.id === profile.id) continue;
    await notify({
      recipient: admin,
      title: selfApproved
        ? `${name} hat Urlaub eingetragen`
        : `Neuer Urlaubsantrag von ${name}`,
      body: [
        `${KIND_LABELS_SHORT[kind]}: ${formatRange(start_date, end_date)} (${formatDayCount(days)})`,
        reason && `\nAnmerkung: ${reason}`,
        clashNote && `\n${clashNote}`,
      ]
        .filter(Boolean)
        .join("\n"),
      href: "/",
      subjectId: profile.id,
    });
  }

  revalidatePath("/");
  revalidatePath("/antraege");
  return {
    success: selfApproved
      ? `Urlaub über ${formatDayCount(days)} eingetragen und genehmigt.`
      : `Antrag über ${formatDayCount(days)} eingereicht.`,
  };
}

/**
 * Ein bereits genehmigter Urlaub lässt sich nicht einfach löschen — der
 * Mitarbeiter beantragt die Stornierung, der Administrator entscheidet.
 * Der Administrator storniert seinen eigenen Urlaub direkt.
 */
export async function requestCancellation(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireProfile();
  const id = text(formData, "id");
  const cancel_reason = text(formData, "cancel_reason");

  const supabase = await createClient();
  const { data } = await supabase
    .from("leave_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (!data) return { error: "Der Antrag wurde nicht gefunden." };
  const leave = data as LeaveRequest;

  if (leave.profile_id !== profile.id && profile.role !== "admin") {
    return { error: "Keine Berechtigung." };
  }
  if (leave.status !== "approved") {
    return { error: "Nur ein genehmigter Urlaub lässt sich stornieren." };
  }

  const direct = profile.role === "admin";

  // Vergangenen Urlaub kann man nicht mehr zurückgeben. Der Administrator
  // darf es trotzdem, um Fehler in der Aufzeichnung zu berichtigen.
  if (!direct && leave.end_date < toISODate(new Date())) {
    return {
      error:
        "Dieser Urlaub liegt in der Vergangenheit und lässt sich nicht mehr stornieren.",
    };
  }

  const { error } = await supabase
    .from("leave_requests")
    .update(
      direct
        ? {
            status: "cancelled",
            cancel_reason,
            decided_by: profile.id,
            decided_at: new Date().toISOString(),
          }
        : { status: "cancel_requested", cancel_reason },
    )
    .eq("id", id);

  if (error) return { error: error.message };

  if (!direct) {
    const isHoliday = await holidaysFor(profile.country);
    const days = requestDays(leave, isHoliday);
    const name = profile.full_name || profile.email;

    for (const admin of await activeAdmins()) {
      await notify({
        recipient: admin,
        title: `${name} möchte Urlaub stornieren`,
        body: `${KIND_LABELS_SHORT[leave.kind]}: ${formatRange(leave.start_date, leave.end_date)} (${formatDayCount(days)})${cancel_reason ? `\n\nBegründung: ${cancel_reason}` : ""}`,
        href: "/",
        subjectId: profile.id,
      });
    }
  }

  revalidatePath("/");
  revalidatePath("/antraege");
  revalidatePath("/mitarbeiter");
  return {
    success: direct
      ? "Urlaub storniert."
      : "Stornierung beantragt — der Administrator entscheidet.",
  };
}

/** Der Administrator entscheidet über eine beantragte Stornierung. */
async function decideCancellation(
  formData: FormData,
  accept: boolean,
): Promise<void> {
  const admin = await requireAdmin();
  const id = text(formData, "id");
  const decision_note = text(formData, "decision_note");

  const supabase = await createClient();
  const { data } = await supabase
    .from("leave_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (!data) return;
  const leave = data as LeaveRequest;
  if (leave.status !== "cancel_requested") return;

  const { error } = await supabase
    .from("leave_requests")
    .update({
      status: accept ? "cancelled" : "approved",
      decided_by: admin.id,
      decided_at: new Date().toISOString(),
      decision_note,
    })
    .eq("id", id);

  if (error) return;

  const applicant = await getProfileById(leave.profile_id);
  if (applicant) {
    const isHoliday = await holidaysFor(applicant.country);
    const days = requestDays(leave, isHoliday);

    await notify({
      recipient: applicant,
      title: accept
        ? "Deine Stornierung wurde genehmigt"
        : "Deine Stornierung wurde abgelehnt",
      body: [
        `${KIND_LABELS_SHORT[leave.kind]}: ${formatRange(leave.start_date, leave.end_date)} (${formatDayCount(days)})`,
        accept
          ? "\nDie Tage stehen dir wieder zur Verfügung."
          : "\nDer Urlaub bleibt genehmigt.",
        decision_note && `\nAnmerkung: ${decision_note}`,
      ]
        .filter(Boolean)
        .join("\n"),
      href: "/antraege",
      subjectId: applicant.id,
    });
  }

  revalidatePath("/");
  revalidatePath("/antraege");
  revalidatePath("/mitarbeiter");
}

export async function approveCancellation(formData: FormData) {
  await decideCancellation(formData, true);
}

export async function rejectCancellation(formData: FormData) {
  await decideCancellation(formData, false);
}

/** Der Mitarbeiter zieht seinen eigenen, noch offenen Antrag zurück. */
export async function cancelRequest(formData: FormData) {
  const profile = await requireProfile();
  const id = text(formData, "id");

  const supabase = await createClient();
  await supabase
    .from("leave_requests")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("profile_id", profile.id)
    .eq("status", "pending");

  revalidatePath("/");
  revalidatePath("/antraege");
}

async function decide(
  formData: FormData,
  status: "approved" | "rejected",
): Promise<void> {
  const admin = await requireAdmin();
  const id = text(formData, "id");
  const decision_note = text(formData, "decision_note");

  const supabase = await createClient();

  const { data: request } = await supabase
    .from("leave_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (!request) return;
  const leave = request as LeaveRequest;

  const { error } = await supabase
    .from("leave_requests")
    .update({
      status,
      decided_by: admin.id,
      decided_at: new Date().toISOString(),
      decision_note,
    })
    .eq("id", id);

  if (error) return;

  const applicant = await getProfileById(leave.profile_id);
  if (applicant) {
    const isHoliday = await holidaysFor(applicant.country);
    const days = requestDays(leave, isHoliday);
    const verb = status === "approved" ? "genehmigt" : "abgelehnt";

    await notify({
      recipient: applicant,
      title: `Dein Antrag wurde ${verb}`,
      body: `${KIND_LABELS_SHORT[leave.kind]}: ${formatRange(leave.start_date, leave.end_date)} (${formatDayCount(days)})${decision_note ? `\n\nAnmerkung: ${decision_note}` : ""}`,
      href: "/antraege",
      subjectId: applicant.id,
    });
  }

  revalidatePath("/");
  revalidatePath("/antraege");
  revalidatePath("/mitarbeiter");
}

export async function approveRequest(formData: FormData) {
  await decide(formData, "approved");
}

export async function rejectRequest(formData: FormData) {
  await decide(formData, "rejected");
}

/**
 * Der Administrator nimmt eine Entscheidung zurück — der Antrag ist danach
 * wieder offen und zählt nicht mehr gegen den Saldo.
 */
export async function reopenRequest(formData: FormData) {
  await requireAdmin();
  const id = text(formData, "id");

  const supabase = await createClient();
  const { data } = await supabase
    .from("leave_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (!data) return;
  const leave = data as LeaveRequest;

  const { error } = await supabase
    .from("leave_requests")
    .update({
      status: "pending",
      decided_by: null,
      decided_at: null,
      decision_note: "",
    })
    .eq("id", id);

  if (error) return;

  // Ohne Nachricht stünde der Urlaub für den Mitarbeiter plötzlich wieder
  // auf „Offen", ohne dass er erführe warum.
  const applicant = await getProfileById(leave.profile_id);
  if (applicant) {
    const isHoliday = await holidaysFor(applicant.country);
    const days = requestDays(leave, isHoliday);

    await notify({
      recipient: applicant,
      title: "Dein Antrag ist wieder offen",
      body: `${KIND_LABELS_SHORT[leave.kind]}: ${formatRange(leave.start_date, leave.end_date)} (${formatDayCount(days)})\n\nDie frühere Entscheidung wurde zurückgenommen, der Antrag wird erneut geprüft.`,
      href: "/antraege",
      subjectId: applicant.id,
    });
  }

  revalidatePath("/");
  revalidatePath("/antraege");
  revalidatePath("/mitarbeiter");
}

/** Der Administrator löscht einen Antrag endgültig. */
export async function deleteRequest(formData: FormData) {
  await requireAdmin();
  const id = text(formData, "id");

  const supabase = await createClient();
  await supabase.from("leave_requests").delete().eq("id", id);

  revalidatePath("/");
  revalidatePath("/antraege");
  revalidatePath("/mitarbeiter");
}
