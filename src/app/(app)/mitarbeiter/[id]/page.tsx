import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BalanceBreakdown, BalanceTiles } from "@/components/balance-panel";
import ConfirmButton from "@/components/confirm-button";
import {
  AddEntitlementForm,
  EditEntitlementForm,
} from "@/components/entitlement-forms";
import RequestList from "@/components/request-list";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { EditUserForm, PasswordResetForm } from "@/components/user-forms";
import YearSwitch, { resolveYear, selectableYears } from "@/components/year-switch";
import { requireProfile } from "@/lib/auth";
import { deleteUser } from "@/lib/actions/users";
import { formatDate, formatDays } from "@/lib/format";
import {
  clashesFor,
  emptyBalance,
  requestDays,
  resolveEntitlement,
} from "@/lib/leave";
import {
  getAllRequests,
  getEntitlements,
  getLeaveOverview,
  getProfileById,
  getProfiles,
} from "@/lib/queries";
import { COUNTRY_LABELS, ROLE_LABELS } from "@/lib/types";

export const metadata = { title: "Mitarbeiter" };

export default async function EmployeePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ jahr?: string }>;
}) {
  const me = await requireProfile();
  if (me.role !== "admin") redirect("/");

  const { id } = await params;
  const year = resolveYear((await searchParams).jahr);

  const person = await getProfileById(id);
  if (!person) notFound();

  const [{ requests, isHoliday, balances }, entitlements, allRequests, profiles] =
    await Promise.all([
      getLeaveOverview(person, Math.max(year, new Date().getFullYear() + 1)),
      getEntitlements(person.id),
      getAllRequests(),
      getProfiles(true),
    ]);

  const balance = balances.get(year) ?? emptyBalance(year);
  const days = new Map(
    requests.map((r) => [r.id, requestDays(r, isHoliday)] as const),
  );
  const people = new Map(profiles.map((p) => [p.id, p]));
  const clashes = new Map(
    requests.map((r) => [r.id, clashesFor(r, allRequests, people)] as const),
  );

  // Vorschlag für ein neues Jahr: das erste, für das es noch nichts gibt.
  const nextYear = entitlements.length
    ? Math.max(...entitlements.map((e) => e.year)) + 1
    : new Date().getFullYear();
  const inherited = resolveEntitlement(entitlements, nextYear);

  return (
    <>
      <PageHeader
        title={person.full_name || person.email}
        description={`${person.email} · ${ROLE_LABELS[person.role]} · Feiertage ${COUNTRY_LABELS[person.country]}`}
        action={
          <Link href="/mitarbeiter" className="text-sm text-muted hover:text-foreground">
            ← Zurück zum Team
          </Link>
        }
      />

      <div className="mb-5">
        <YearSwitch
          years={selectableYears()}
          current={year}
          basePath={`/mitarbeiter/${person.id}`}
        />
      </div>

      <div className="space-y-5">
        <BalanceTiles balance={balance} />

        <div className="grid gap-5 lg:grid-cols-2">
          <BalanceBreakdown balance={balance} />

          <Card>
            <CardHeader
              title="Jahreskontingente"
              description="Fehlt ein Jahr, gelten die Werte des zuletzt hinterlegten Jahres weiter."
            />
            {entitlements.length === 0 ? (
              <EmptyState
                title="Noch kein Kontingent"
                description="Ohne Kontingent stehen null Urlaubstage zur Verfügung."
              />
            ) : (
              <ul className="divide-y divide-border">
                {[...entitlements]
                  .sort((a, b) => b.year - a.year)
                  .map((entitlement) => (
                    <li
                      key={entitlement.id}
                      className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5 sm:px-5"
                    >
                      <div>
                        <p className="font-medium">
                          <span className="tabular">{entitlement.year}</span>
                          <span className="tabular ml-3 font-normal">
                            {formatDays(Number(entitlement.annual_days))} Tage
                          </span>
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          Übertrag höchstens{" "}
                          {formatDays(Number(entitlement.carryover_max))}
                          {entitlement.carryover_expires_on
                            ? `, verfällt am ${formatDate(entitlement.carryover_expires_on)}`
                            : ", ohne Verfall"}
                        </p>
                        {entitlement.opening_carryover !== null && (
                          <p className="mt-1">
                            <Badge tone="accent">
                              Startsaldo{" "}
                              {formatDays(Number(entitlement.opening_carryover))}
                            </Badge>
                          </p>
                        )}
                        {entitlement.note && (
                          <p className="mt-1 text-xs text-muted">
                            {entitlement.note}
                          </p>
                        )}
                      </div>
                      <EditEntitlementForm entitlement={entitlement} />
                    </li>
                  ))}
              </ul>
            )}
            <div className="border-t border-border p-4 sm:p-5">
              <AddEntitlementForm
                profileId={person.id}
                year={nextYear}
                defaults={{
                  annual_days: inherited?.annualDays ?? 25,
                  carryover_max: inherited?.carryoverMax ?? 0,
                  carryover_expires_on: inherited?.carryExpiresOn ?? null,
                  opening_carryover: null,
                  opening_carryover_expires_on: null,
                }}
              />
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader
            title="Anträge"
            description="Alle Einträge dieses Mitarbeiters"
          />
          <RequestList
            requests={requests}
            days={days}
            clashes={clashes}
            mode="admin"
            emptyTitle="Noch keine Anträge"
          />
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Stammdaten" />
            <EditUserForm profile={person} />
          </Card>

          <div className="space-y-5">
            <Card>
              <CardHeader
                title="Passwort zurücksetzen"
                description="Das neue Passwort bitte persönlich weitergeben."
              />
              <PasswordResetForm profileId={person.id} />
            </Card>

            <Card>
              <CardHeader
                title="Konto löschen"
                description="Löscht auch alle Anträge und Kontingente. Wer nur ausscheidet, wird oben besser auf inaktiv gesetzt."
              />
              <form action={deleteUser} className="p-5">
                <input type="hidden" name="id" value={person.id} />
                <ConfirmButton
                  question={`${person.full_name || person.email} endgültig löschen? Alle Anträge und Kontingente gehen verloren.`}
                >
                  Endgültig löschen
                </ConfirmButton>
              </form>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
