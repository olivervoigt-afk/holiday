"use client";

import { useActionState } from "react";
import { Button, Field, FormMessage, Input } from "@/components/ui";
import { changePassword, type ActionState } from "@/lib/actions/auth";

export default function ChangePasswordForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    changePassword,
    {},
  );

  return (
    <form action={action} className="space-y-4 p-5">
      <Field label="Neues Passwort" hint="Mindestens 8 Zeichen.">
        <Input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </Field>
      <Field label="Wiederholen">
        <Input
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </Field>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Wird geändert …" : "Passwort ändern"}
      </Button>
    </form>
  );
}
