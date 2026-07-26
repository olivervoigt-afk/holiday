"use client";

import { useActionState, useState } from "react";
import {
  Button,
  Card,
  CardHeader,
  Field,
  FormMessage,
  Input,
  Select,
} from "@/components/ui";
import type { ActionState } from "@/lib/actions/auth";
import { createUser, resetUserPassword, updateUser } from "@/lib/actions/users";
import {
  COUNTRIES,
  COUNTRY_LABELS,
  ROLE_LABELS,
  type Profile,
  type UserRole,
} from "@/lib/types";

const ROLES: UserRole[] = ["user", "admin"];

/** Anlegen eines neuen Mitarbeiters samt Startkontingent. */
export function CreateUserForm({ year }: { year: number }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createUser,
    {},
  );
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>Mitarbeiter anlegen</Button>
    );
  }

  return (
    <Card className="mb-5">
      <CardHeader
        title="Neuer Mitarbeiter"
        description="Das Konto ist sofort nutzbar — das Startpasswort bitte persönlich weitergeben."
        action={
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Schliessen
          </Button>
        }
      />
      <form action={action} className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <Input name="full_name" required autoFocus />
          </Field>
          <Field label="E-Mail">
            <Input name="email" type="email" required />
          </Field>
          <Field label="Rolle">
            <Select name="role" defaultValue="user">
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Land" hint="Bestimmt, welche Feiertage gelten.">
            <Select name="country" defaultValue="AT">
              {COUNTRIES.map((country) => (
                <option key={country} value={country}>
                  {COUNTRY_LABELS[country]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Startpasswort" hint="Mindestens 8 Zeichen.">
            <Input name="password" type="text" minLength={8} required />
          </Field>
        </div>

        <fieldset className="rounded-md border border-border p-4">
          <legend className="px-1.5 text-sm font-medium">
            Kontingent {year}
          </legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Urlaubstage">
              <Input name="annual_days" defaultValue="25" inputMode="decimal" />
            </Field>
            <Field label="Übertrag höchstens">
              <Input name="carryover_max" defaultValue="0" inputMode="decimal" />
            </Field>
            <Field label="Übertrag verfällt am" hint={`Datum in ${year + 1}.`}>
              <Input name="carryover_expires_on" type="date" />
            </Field>
          </div>
        </fieldset>

        <FormMessage state={state} />

        <Button type="submit" disabled={pending}>
          {pending ? "Wird angelegt …" : "Anlegen"}
        </Button>
      </form>
    </Card>
  );
}

/** Stammdaten eines bestehenden Mitarbeiters. */
export function EditUserForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateUser,
    {},
  );

  return (
    <form action={action} className="space-y-4 p-5">
      <input type="hidden" name="id" value={profile.id} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <Input name="full_name" defaultValue={profile.full_name} required />
        </Field>
        <Field label="E-Mail" hint="Die Anmeldeadresse lässt sich nicht ändern.">
          <Input value={profile.email} disabled readOnly />
        </Field>
        <Field label="Rolle">
          <Select name="role" defaultValue={profile.role}>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Land" hint="Bestimmt, welche Feiertage gelten.">
          <Select name="country" defaultValue={profile.country}>
            {COUNTRIES.map((country) => (
              <option key={country} value={country}>
                {COUNTRY_LABELS[country]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <label className="flex items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          name="active"
          defaultChecked={profile.active}
          className="size-4 accent-[var(--accent)]"
        />
        Konto aktiv — ausgeschiedene Mitarbeiter hier abwählen, die Historie
        bleibt erhalten
      </label>

      <FormMessage state={state} />

      <Button type="submit" disabled={pending}>
        {pending ? "Wird gespeichert …" : "Speichern"}
      </Button>
    </form>
  );
}

export function PasswordResetForm({ profileId }: { profileId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    resetUserPassword,
    {},
  );

  return (
    <form action={action} className="space-y-4 p-5">
      <input type="hidden" name="id" value={profileId} />
      <Field label="Neues Passwort" hint="Mindestens 8 Zeichen.">
        <Input name="password" type="text" minLength={8} required />
      </Field>
      <FormMessage state={state} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Wird gesetzt …" : "Passwort setzen"}
      </Button>
    </form>
  );
}
