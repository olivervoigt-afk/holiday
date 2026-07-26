import { Resend } from "resend";

/**
 * E-Mail-Versand über Resend.
 *
 * Bewusst ohne `server-only`, damit das Prüfskript (`npm run test-mail`) das
 * Modul laden kann. Der Schlüssel steckt in `RESEND_API_KEY` — ohne das
 * Präfix NEXT_PUBLIC_ ist er im Browser nicht vorhanden, und der Aufrufer
 * `notify.ts` ist seinerseits als serverseitig gekennzeichnet.
 */

const APP_URL = appUrl();

/**
 * Adresse für die Links in den E-Mails. Auf Vercel steht die endgültige
 * Domain erst nach dem ersten Deploy fest, deshalb greift die Anwendung
 * ersatzweise auf die von Vercel gesetzten Variablen zurück.
 */
function appUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3400";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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

/** Ist der Versand überhaupt eingerichtet? */
export function mailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
}

/**
 * Verschickt eine Nachricht im Layout der Anwendung. Gibt eine Fehlermeldung
 * zurück statt zu werfen — ein misslungener Versand darf keinen Antrag
 * scheitern lassen.
 */
export async function sendMail(
  to: string,
  title: string,
  body: string,
  href = "/",
): Promise<string | null> {
  if (!mailConfigured()) return "Kein RESEND_API_KEY oder RESEND_FROM gesetzt.";

  try {
    const resend = new Resend(process.env.RESEND_API_KEY!);
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM!,
      to,
      subject: title,
      html: emailHtml(title, body, href),
      text: `${title}\n\n${body}\n\n${APP_URL}${href}`,
    });
    return error ? `${error.name}: ${error.message}` : null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
