import ChangePasswordForm from "@/components/change-password-form";
import { Button, Card, CardHeader, PageHeader } from "@/components/ui";
import { signOut } from "@/lib/actions/auth";
import { requireProfile } from "@/lib/auth";
import { COUNTRY_LABELS, ROLE_LABELS } from "@/lib/types";

export const metadata = { title: "Konto" };

export default async function SettingsPage() {
  const profile = await requireProfile();

  return (
    <>
      <PageHeader title="Konto" />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Meine Daten" />
          <dl className="divide-y divide-border">
            {[
              ["Name", profile.full_name || "–"],
              ["E-Mail", profile.email],
              ["Rolle", ROLE_LABELS[profile.role]],
              ["Feiertage", COUNTRY_LABELS[profile.country]],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-baseline justify-between gap-4 px-4 py-3 sm:px-5"
              >
                <dt className="text-sm text-muted">{label}</dt>
                <dd className="text-sm font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="border-t border-border px-4 py-3 text-xs text-muted sm:px-5">
            Name, Rolle und Land pflegt der Administrator.
          </p>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Passwort ändern" />
            <ChangePasswordForm />
          </Card>

          <Card>
            <CardHeader title="Abmelden" />
            <form action={signOut} className="p-5">
              <Button type="submit" variant="secondary">
                Abmelden
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
