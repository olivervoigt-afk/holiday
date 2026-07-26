/**
 * Prüft den E-Mail-Versand mit einer Beispielnachricht im Layout der
 * Anwendung.
 *
 *   npm run test-mail -- oliver@oylio.com
 *
 * Ohne RESEND_API_KEY und RESEND_FROM bleibt der Versand aus — die
 * Benachrichtigungen laufen dann nur über die Glocke in der Anwendung.
 */

import { mailConfigured, sendMail } from "../src/lib/mail";

async function main() {
  const to = process.argv[2];

  if (!to) {
    console.error("Aufruf: npm run test-mail -- empfaenger@example.com");
    process.exit(1);
  }

  console.log(`Absender:   ${process.env.RESEND_FROM ?? "— nicht gesetzt —"}`);
  console.log(`Schlüssel:  ${process.env.RESEND_API_KEY ? "gesetzt" : "— nicht gesetzt —"}`);
  console.log(`Adresse:    ${process.env.NEXT_PUBLIC_APP_URL ?? "— nicht gesetzt —"}`);
  console.log(`Empfänger:  ${to}\n`);

  if (!mailConfigured()) {
    console.error(
      "Der Versand ist nicht eingerichtet. RESEND_API_KEY und RESEND_FROM\n" +
        "in .env.local eintragen (und in Vercel hinterlegen).",
    );
    process.exit(1);
  }

  const failure = await sendMail(
    to,
    "Neuer Urlaubsantrag von Silvia Baburek",
    "Urlaub: 30.03.–03.04.2026 (3 Tage)\n\nAnmerkung: Beispielnachricht zur Prüfung des Versands.",
    "/",
  );

  if (failure) {
    console.error("Fehlgeschlagen:", failure);
    process.exit(1);
  }

  console.log("Verschickt. Bitte im Postfach nachsehen (auch im Spam-Ordner).");
}

main();
