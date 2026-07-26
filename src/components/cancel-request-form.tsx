"use client";

import { useActionState, useState } from "react";
import { Button, Field, FormMessage, Input } from "@/components/ui";
import type { ActionState } from "@/lib/actions/auth";
import { requestCancellation } from "@/lib/actions/requests";

/**
 * Stornierung eines bereits genehmigten Urlaubs. Beim Mitarbeiter ist das ein
 * Antrag, beim Administrator wirkt er sofort — der Text richtet sich danach.
 */
export default function CancelRequestForm({
  requestId,
  direct,
}: {
  requestId: string;
  /** true für den Administrator: storniert ohne Umweg. */
  direct: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    requestCancellation,
    {},
  );
  const [open, setOpen] = useState(false);

  if (state.success) return <FormMessage state={state} />;

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {direct ? "Stornieren" : "Stornierung beantragen"}
      </Button>
    );
  }

  return (
    <form action={action} className="w-full space-y-3">
      <input type="hidden" name="id" value={requestId} />

      <Field
        label={direct ? "Grund" : "Warum soll storniert werden?"}
        hint={
          direct
            ? "Optional."
            : "Optional — hilft dem Administrator bei der Entscheidung."
        }
      >
        <Input name="cancel_reason" autoFocus className="sm:max-w-md" />
      </Field>

      <FormMessage state={state} />

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending
            ? "Wird gesendet …"
            : direct
              ? "Urlaub stornieren"
              : "Stornierung beantragen"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}
