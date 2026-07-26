"use client";

import { useActionState } from "react";
import { Button, Field, FormMessage, Input } from "@/components/ui";
import type { ActionState } from "@/lib/actions/auth";
import { addHoliday, generateYear } from "@/lib/actions/holidays";
import { COUNTRY_LABELS, type CountryCode } from "@/lib/types";

/** Erzeugt die gesetzlichen Feiertage eines Jahres. */
export function GenerateYearForm({
  country,
  year,
}: {
  country: CountryCode;
  year: number;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    generateYear,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="country" value={country} />
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Jahr erzeugen">
          <Input
            name="year"
            type="number"
            min={2000}
            max={2100}
            defaultValue={year}
            className="w-28"
          />
        </Field>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Wird ergänzt …" : "Feiertage ergänzen"}
        </Button>
      </div>
      <p className="text-xs text-muted">
        Bereits vorhandene Tage bleiben unverändert — eigene Ergänzungen gehen
        also nicht verloren.
      </p>
      <FormMessage state={state} />
    </form>
  );
}

/** Einzelnen Tag ergänzen, etwa einen Betriebsurlaub. */
export function AddHolidayForm({ country }: { country: CountryCode }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    addHoliday,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="country" value={country} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Datum">
          <Input name="day" type="date" required />
        </Field>
        <Field label="Bezeichnung">
          <Input name="name" placeholder="z. B. Betriebsurlaub" required />
        </Field>
      </div>
      <FormMessage state={state} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Wird hinzugefügt …" : `Tag für ${COUNTRY_LABELS[country]} hinzufügen`}
      </Button>
    </form>
  );
}
