"use client";

import { useActionState, useState } from "react";
import ConfirmButton from "@/components/confirm-button";
import { Button, Field, FormMessage, Input } from "@/components/ui";
import type { ActionState } from "@/lib/actions/auth";
import { deleteEntitlement, saveEntitlement } from "@/lib/actions/users";
import { formatDays } from "@/lib/format";
import type { Entitlement } from "@/lib/types";

/** Formatiert einen Zahlenwert für ein Eingabefeld (deutsche Schreibweise). */
function toInput(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : formatDays(value);
}

type Defaults = {
  annual_days: number;
  carryover_max: number;
  carryover_expires_on: string | null;
  opening_carryover: number | null;
  opening_carryover_expires_on: string | null;
};

function EntitlementFields({
  year,
  defaults,
  showOpening,
}: {
  year: number;
  defaults: Defaults;
  showOpening: boolean;
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Urlaubstage" hint={`Anspruch für ${year}.`}>
          <Input
            name="annual_days"
            inputMode="decimal"
            defaultValue={toInput(defaults.annual_days)}
            required
          />
        </Field>
        <Field
          label="Übertrag höchstens"
          hint={`Wandert nach ${year + 1}.`}
        >
          <Input
            name="carryover_max"
            inputMode="decimal"
            defaultValue={toInput(defaults.carryover_max)}
          />
        </Field>
        <Field label="Übertrag verfällt am" hint={`Datum in ${year + 1}.`}>
          <Input
            name="carryover_expires_on"
            type="date"
            defaultValue={defaults.carryover_expires_on ?? ""}
          />
        </Field>
      </div>

      {showOpening && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Startsaldo"
            hint="Vortrag aus einem früheren System. Darf negativ sein — leer lassen, wenn der Vortrag aus dem Vorjahr errechnet werden soll."
          >
            <Input
              name="opening_carryover"
              inputMode="decimal"
              placeholder="z. B. -2,5"
              defaultValue={toInput(defaults.opening_carryover)}
            />
          </Field>
          <Field label="Startsaldo verfällt am" hint="Optional.">
            <Input
              name="opening_carryover_expires_on"
              type="date"
              defaultValue={defaults.opening_carryover_expires_on ?? ""}
            />
          </Field>
        </div>
      )}
    </>
  );
}

/** Bestehendes Jahr bearbeiten. */
export function EditEntitlementForm({
  entitlement,
}: {
  entitlement: Entitlement;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    saveEntitlement,
    {},
  );
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="ghost" onClick={() => setOpen(true)}>
        Bearbeiten
      </Button>
    );
  }

  return (
    <div className="w-full space-y-4 rounded-md border border-border bg-surface-muted/50 p-4">
      <form action={action} className="space-y-4">
        <input type="hidden" name="profile_id" value={entitlement.profile_id} />
        <input type="hidden" name="year" value={entitlement.year} />

        <EntitlementFields
          year={entitlement.year}
          defaults={entitlement}
          showOpening
        />

        <Field label="Notiz">
          <Input name="note" defaultValue={entitlement.note} />
        </Field>

        <FormMessage state={state} />

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Wird gespeichert …" : "Speichern"}
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)} type="button">
            Abbrechen
          </Button>
        </div>
      </form>

      <form action={deleteEntitlement}>
        <input type="hidden" name="id" value={entitlement.id} />
        <input type="hidden" name="profile_id" value={entitlement.profile_id} />
        <ConfirmButton
          question={`Kontingent ${entitlement.year} löschen? Danach gelten die Werte des zuletzt hinterlegten früheren Jahres.`}
        >
          Jahr löschen
        </ConfirmButton>
      </form>
    </div>
  );
}

/**
 * Neues Jahr anlegen. Die Felder sind mit den Werten des Vorjahres
 * vorbelegt — meist ändert sich ja nichts.
 */
export function AddEntitlementForm({
  profileId,
  year,
  defaults,
}: {
  profileId: string;
  year: number;
  defaults: Defaults;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    saveEntitlement,
    {},
  );
  const [open, setOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(year);

  if (!open) {
    return <Button onClick={() => setOpen(true)}>Jahr hinzufügen</Button>;
  }

  return (
    <form
      action={action}
      className="space-y-4 rounded-md border border-border bg-surface-muted/50 p-4"
    >
      <input type="hidden" name="profile_id" value={profileId} />

      <Field label="Kalenderjahr">
        <Input
          name="year"
          type="number"
          min={2000}
          max={2100}
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          required
          className="sm:max-w-[10rem]"
        />
      </Field>

      <EntitlementFields
        year={selectedYear}
        defaults={{ ...defaults, opening_carryover: null }}
        showOpening={false}
      />

      <Field label="Notiz">
        <Input name="note" />
      </Field>

      <FormMessage state={state} />

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Wird gespeichert …" : "Speichern"}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)} type="button">
          Abbrechen
        </Button>
      </div>
    </form>
  );
}
