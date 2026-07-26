"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { Button, Card, Field, FormMessage, Input } from "@/components/ui";
import { signIn, type ActionState } from "@/lib/actions/auth";

export default function LoginForm() {
  const params = useSearchParams();
  const next = params.get("weiter") ?? "/";
  const blocked = params.get("fehler") === "gesperrt";

  const [state, action, pending] = useActionState<ActionState, FormData>(
    signIn,
    blocked
      ? { error: "Dieses Konto ist gesperrt. Bitte an den Administrator wenden." }
      : {},
  );

  return (
    <Card className="p-6">
      <form action={action} className="space-y-4">
        <input type="hidden" name="weiter" value={next} />

        <Field label="E-Mail">
          <Input
            name="email"
            type="email"
            autoComplete="username"
            required
            autoFocus
          />
        </Field>

        <Field label="Passwort">
          <Input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>

        <FormMessage state={state} />

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Anmelden …" : "Anmelden"}
        </Button>

        <p className="text-center text-xs text-muted">
          Zugangsdaten erhältst du vom Administrator.
        </p>
      </form>
    </Card>
  );
}
