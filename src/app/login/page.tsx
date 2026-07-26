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
      </div>
    </main>
  );
}
