import "server-only";
import { Resend } from "resend";
import { createAdminClient } from "./supabase/admin";
import type { Profile } from "./types";

/**
 * Benachrichtigungen laufen zweigleisig: ein Eintrag in der Glocke innerhalb
 * der Anwendung und — sofern Resend konfiguriert ist — eine E-Mail.
 *
 * Der Versand darf einen Antrag nie scheitern lassen. Fehler werden deshalb
 * protokolliert und geschluckt.
 */

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

export type NotifyInput = {
  recipient: Pick<Profile, "id" | "email" | "full_name">;
  title: string;
  body: string;
  /** Interner Pfad, auf den die Glocke und der Knopf in der E-Mail zeigen. */
  href?: string;
};

function emailHtml(title: string, body: string, href: string): string {
  const url = `${APP_URL}${href}`;
  return `<!doctype html>
<html lang="de"><body style="margin:0;padding:24px;background:#f6f7f9;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#16191d">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #dfe3e8;border-radius:10px;padding:24px">
    <h1 style="margin:0 0 12px;font-size:17px">${escapeHtml(title)}</h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#3d444d;white-space:pre-line">${escapeHtml(body)}</p>
    <a href="${url}" style="display:inline-block;background:#1f5eff;color:#fff;text-decoration:none;font-size:14px;font-weight:500;padding:10px 18px;border-radius:6px">In der Urlaubsverwaltung öffnen</a>
    <p style="margin:20px 0 0;font-size:12px;color:#676e79">Diese Nachricht wurde automatisch von der Urlaubsverwaltung verschickt.</p>
  </div>
</body></html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) return; // E-Mail-Versand ist nicht eingerichtet.

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: recipient.email,
      subject: title,
      html: emailHtml(title, body, href),
      text: `${title}\n\n${body}\n\n${APP_URL}${href}`,
    });
    if (error) console.error("E-Mail-Versand fehlgeschlagen:", error);
  } catch (error) {
    console.error("E-Mail-Versand fehlgeschlagen:", error);
  }
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
