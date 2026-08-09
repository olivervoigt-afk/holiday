# Urlaubsverwaltung

Urlaubsanträge erfassen, genehmigen und Salden im Blick behalten — für Handy
und Rechner. Next.js 16, Supabase, Tailwind CSS 4.

## Was die Anwendung kann

**Für Mitarbeiter**

- Eigene Übersicht mit Jahresanspruch, Vortrag aus dem Vorjahr, verbrauchten
  Tagen und Saldo, dazu die vollständige Herleitung
- Urlaub beantragen mit Live-Berechnung der Arbeitstage; Wochenenden und die
  Feiertage des zugewiesenen Landes fallen automatisch heraus
- Halbe Tage am Anfang und am Ende eines Zeitraums
- Beim Beantragen sichtbar, welche Kolleginnen und Kollegen desselben Landes
  im gewählten Zeitraum bereits weg sind
- Offene Anträge zurückziehen

**Für den Administrator**

- Alle offenen Anträge auf einen Blick, genehmigen oder ablehnen mit Anmerkung;
  Entscheidungen lassen sich zurücknehmen
- Warnung, wenn sich der Urlaub zweier Mitarbeiter überschneidet
- Team-Übersicht mit Anspruch, Vortrag, Verbrauch und Saldo je Person und Jahr
- Mitarbeiter anlegen, Rolle und Land setzen, Passwort zurücksetzen,
  ausgeschiedene Konten sperren (die Historie bleibt erhalten)
- Jahreskontingente je Person und Kalenderjahr pflegen
- Feiertagslisten für Österreich und Malta, jahrweise per Knopfdruck erzeugbar
  und um eigene Tage ergänzbar

**Benachrichtigungen** laufen in der Anwendung (Glocke) und zusätzlich per
E-Mail, sobald Resend eingerichtet ist: der Administrator bei jedem neuen
Antrag, der Mitarbeiter bei jeder Entscheidung.

## Wie der Saldo gerechnet wird

Für jedes Kalenderjahr gilt:

```
  Vortrag aus dem Vorjahr
− davon verfallen (bis zum Stichtag nicht verbraucht)
+ Jahresanspruch
= verfügbar
− genehmigter Urlaub
= Saldo
```

- Der Übertrag wird **zuerst** verbraucht. Was bis zum Stichtag übrig ist,
  verfällt. Ohne Stichtag verfällt nichts.
- Ins Folgejahr wandert höchstens `carryover_max`; ein darüber hinausgehender
  Rest verfällt zum Jahresende.
- Ein **negativer** Saldo wandert immer vollständig ins Folgejahr und mindert
  dort den Anspruch. So bildet die Anwendung zu viel genehmigten Urlaub ab.
- Fehlt für ein Jahr ein Kontingent, gelten die Werte des zuletzt hinterlegten
  früheren Jahres weiter — inklusive Verfallstag, der um die Jahresdifferenz
  mitverschoben wird.
- **Sonderurlaub** wird erfasst und ausgewiesen, aber nicht vom Anspruch
  abgezogen.
- Anträge über den Jahreswechsel werden tagegenau auf beide Jahre aufgeteilt.

Für den Umstieg gibt es je Jahr einen **Startsaldo**: er überschreibt den
errechneten Vortrag und darf negativ sein.

Die Rechnung ist mit Beispielen abgesichert:

```bash
npm run check
```

## Einrichtung

### 1. Supabase-Projekt anlegen

Ein **eigenes** Projekt auf [supabase.com](https://supabase.com) — bewusst
nicht das der Mietverwaltung, damit Mitarbeiterkonten die Mietdaten technisch
nicht erreichen können.

Unter *Settings → API* stehen die drei Werte für `.env.local`.

### 2. Schema einspielen

`supabase/schema.sql` vollständig im **SQL Editor** des Projekts ausführen. Das
Skript ist wiederholbar und legt Tabellen, Trigger, Zugriffsrechte und die
Funktion `team_absences` an.

### 3. Zugangsdaten eintragen

```bash
cp .env.example .env.local
```

und ausfüllen:

| Schlüssel | Bedeutung |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Projekt-URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | öffentlicher Schlüssel |
| `SUPABASE_SERVICE_ROLE_KEY` | Dienstschlüssel, nur serverseitig |
| `NEXT_PUBLIC_APP_URL` | Adresse der Anwendung, für die Links in den E-Mails |
| `RESEND_API_KEY`, `RESEND_FROM` | optional, für den E-Mail-Versand |

### 4. Konten und Feiertage anlegen

```bash
npm run seed
```

Legt die in `scripts/seed.mjs` hinterlegten Konten samt Kontingenten an und
füllt die Feiertagslisten für Vorjahr, laufendes Jahr und Folgejahr. Die
Startpasswörter werden **einmalig** ausgegeben — bitte persönlich weitergeben.
Ein zweiter Lauf ändert nichts an bestehenden Konten.

### 5. Starten

```bash
npm run dev
```

→ http://localhost:3400

## E-Mail-Versand (optional)

Verschickt werden zwei Nachrichten: an den Administrator bei jedem neuen
Antrag und bei jeder beantragten Stornierung, an den Mitarbeiter bei jeder
Entscheidung.

1. Konto auf [resend.com](https://resend.com) anlegen (kostenlos bis 3.000
   Mails im Monat).
2. Unter *Domains* die Absender-Domain eintragen und die angezeigten
   DNS-Einträge setzen. Zum blossen Ausprobieren geht auch
   `onboarding@resend.dev` — damit lässt sich allerdings nur an die eigene
   Kontoadresse senden.
3. Unter *API Keys* einen Schlüssel mit dem Recht *Sending access* erzeugen.
4. `RESEND_API_KEY` und `RESEND_FROM` in `.env.local` eintragen und in Vercel
   hinterlegen, etwa `RESEND_FROM="Urlaubsverwaltung <urlaub@oylio.com>"`.

Prüfen lässt sich der Versand mit einer Beispielnachricht:

```bash
npm run test-mail -- name@example.com
```

Ohne die beiden Werte bleibt alles bei der Glocke in der Anwendung — der
Versand wird stillschweigend übersprungen und kein Antrag scheitert daran.

## Als App auf dem Handy

Die Anwendung ist installierbar (PWA). Auf dem iPhone in Safari öffnen, dann
**Teilen → Zum Home-Bildschirm**. Danach liegt sie mit eigenem Symbol auf dem
Home-Bildschirm und startet im Vollbild ohne Adresszeile. Auf Android bietet
Chrome das von selbst an.

Am Zugang ändert das nichts — geschützt wird weiterhin durch die Anmeldung.
Eine Verteilung über den App Store ist weder nötig noch sinnvoll: sie wäre
öffentlich, kostet 99 $ im Jahr und TestFlight-Fassungen verfallen nach
90 Tagen.

Das Symbol liegt als `src/app/icon.svg` vor. Nach einer Änderung daran:

```bash
npm run icons
```

Das erzeugt die Rastergrössen für Manifest, Home-Bildschirm und Browser-Reiter.

Noch nicht eingebaut ist ein Service Worker. Er wäre die Voraussetzung für
Push-Nachrichten aufs iPhone (ab iOS 16.4) — Offline-Betrieb dagegen wäre bei
einer Anwendung, die Salden anzeigt, eher gefährlich als nützlich.

## Veröffentlichen

1. Auf [Vercel](https://vercel.com) *Add New → Project* wählen und das Repo
   `olivervoigt-afk/holiday` importieren. Framework und Befehle erkennt Vercel
   selbst.
2. Vor dem ersten Deploy unter *Environment Variables* diese drei Werte
   eintragen — dieselben wie in `.env.local`:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`.
3. `NEXT_PUBLIC_APP_URL` kann weggelassen werden: ohne diesen Wert nimmt die
   Anwendung die Produktionsdomain aus `VERCEL_PROJECT_PRODUCTION_URL`. Erst
   bei einer eigenen Domain lohnt es sich, ihn ausdrücklich zu setzen.
4. Für den E-Mail-Versand zusätzlich `RESEND_API_KEY` und `RESEND_FROM`.

Jeder Push auf `main` löst ein neues Deploy aus. Vercel fasst die Datenbank
nicht an: Schemaänderungen laufen weiterhin über den SQL Editor.

## Aufbau

```
src/lib/leave.ts          Arbeitstage, halbe Tage, Jahressalden, Überschneidungen
src/lib/holidays.mjs      Feiertage AT/MT samt Osterberechnung (auch vom Seed genutzt)
src/lib/queries.ts        Lesezugriffe
src/lib/actions/          Server Actions (Anträge, Benutzer, Feiertage, Anmeldung)
src/lib/notify.ts         Glocke und E-Mail
src/lib/mail.ts           Versand über Resend samt Nachrichtenlayout
src/app/(app)/            Angemeldeter Bereich
supabase/schema.sql       Tabellen, Trigger, Zugriffsrechte
scripts/seed.mjs          Einmalige Einrichtung
scripts/check-balance.ts  Prüfungen der Saldo-Rechnung
```

Die Zugriffsrechte liegen in der Datenbank (Row Level Security): Mitarbeiter
sehen nur ihre eigenen Anträge und Kontingente, der Administrator alles. Die
Anträge der Kollegen sind ausschliesslich über `team_absences` sichtbar — und
dort ohne Begründung, nur Name und Zeitraum.
