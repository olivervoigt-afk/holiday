import "server-only";
import { mailConfigured, sendMail } from "./mail";
import { createAdminClient } from "./supabase/admin";
import type { Profile } from "./types";

/**
 * Benachrichtigungen laufen zweigleisig: ein Eintrag in der Glocke innerhalb
 * der Anwendung und — sofern Resend konfiguriert ist — eine E-Mail.
 *
 * Der Versand darf einen Antrag nie scheitern lassen. Fehler werden deshalb
 * protokolliert und geschluckt.
 */

export type NotifyInput = {
  recipient: Pick<Profile, "id" | "email" | "full_name">;
  title: string;
  body: string;
  /** Interner Pfad, auf den die Glocke und der Knopf in der E-Mail zeigen. */
  href?: string;
};

/** Eintrag in der Glocke plus E-Mail an eine Person. */
export async function notify({ recipient, title, body, href = "/" }: NotifyInput) {
  const admin = createAdminClient();

  try {
    await admin
      .from("notifications")
      .insert({ profile_id: recipient.id, title, body, href });
  } catch (error) {
    console.error("Benachrichtigung konnte nicht gespeichert werden:", error);
  }

  if (!mailConfigured()) return; // Versand ist nicht eingerichtet.

  const failure = await sendMail(recipient.email, title, body, href);
  if (failure) console.error("E-Mail-Versand fehlgeschlagen:", failure);
}

/** Alle aktiven Administratoren — Empfänger für neue Anträge. */
export async function activeAdmins(): Promise<Profile[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("*")
    .eq("role", "admin")
    .eq("active", true);
  return (data as Profile[]) ?? [];
}
