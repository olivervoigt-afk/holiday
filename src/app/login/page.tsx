import { Suspense } from "react";
import LoginForm from "./login-form";

export const metadata = { title: "Anmelden" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Urlaubsverwaltung
          </h1>
          <p className="mt-1 text-sm text-muted">
            Anträge erfassen, genehmigen, Salden im Blick behalten
          </p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>

        {/* Nur auf schmalen Bildschirmen — am Rechner ergibt der Hinweis
            keinen Sinn. Kein JavaScript nötig, deshalb keine Erkennung des
            Geräts: wer schon installiert hat, sieht diese Seite ohnehin
            selten. */}
        <p className="mt-6 text-center text-xs leading-relaxed text-muted sm:hidden">
          Tipp: Über <span className="font-medium">Teilen</span> →{" "}
          <span className="font-medium">Zum Home-Bildschirm</span> lässt sich
          die Urlaubsverwaltung als App ablegen.
        </p>
      </div>
    </main>
  );
}
