import Link from "next/link";
import { redirect } from "next/navigation";
import AdminTabs from "@/components/admin-tabs";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { CreateUserForm } from "@/components/user-forms";
import YearSwitch from "@/components/year-switch";
import { resolveYear, selectableYears } from "@/lib/years";
import { requireProfile } from "@/lib/auth";
import { formatDays, formatSigned } from "@/lib/format";
import { emptyBalance } from "@/lib/leave";
import { getTeamOverview } from "@/lib/queries";
import { COUNTRY_LABELS, ROLE_LABELS } from "@/lib/types";

export const metadata = { title: "Team" };

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ jahr?: string }>;
}) {
  const profile = await requireProfile();
  if (profile.role !== "admin") redirect("/");

  const year = resolveYear((await searchParams).jahr);
  const { rows } = await getTeamOverview(year, true);

  const active = rows.filter((r) => r.profile.active);
  const inactive = rows.filter((r) => !r.profile.active);

  return (
    <>
      <AdminTabs current="/mitarbeiter" />

      <PageHeader
        title="Team"
        description={`${active.length} aktiv${inactive.length ? `, ${inactive.length} ausgeschieden` : ""}`}
        action={<YearSwitch years={selectableYears()} current={year} basePath="/mitarbeiter" />}
      />

      <CreateUserForm year={new Date().getFullYear()} />

      <Card className="mt-5">
        <CardHeader
          title={`Mitarbeiter und Kontingente ${year}`}
          description="Für Kontingente, Passwort und Anträge auf einen Namen tippen"
        />
        {rows.length === 0 ? (
          <EmptyState
            title="Noch keine Mitarbeiter"
            description="Oben lässt sich das erste Konto anlegen."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs tracking-wide text-muted uppercase">
                  <th className="px-4 py-2.5 font-medium sm:px-5">Name</th>
                  <th className="px-3 py-2.5 font-medium">Land</th>
                  <th className="px-3 py-2.5 font-medium">Rolle</th>
                  <th className="px-3 py-2.5 text-right font-medium">Anspruch</th>
                  <th className="px-3 py-2.5 text-right font-medium">Vortrag</th>
                  <th className="px-3 py-2.5 text-right font-medium">Verbraucht</th>
                  <th className="px-4 py-2.5 text-right font-medium sm:px-5">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map(({ profile: person, balance }) => {
                  const b = balance ?? emptyBalance(year);
                  return (
                    <tr key={person.id} className="hover:bg-surface-muted/50">
                      <td className="px-4 py-3 sm:px-5">
                        <Link
                          href={`/mitarbeiter/${person.id}`}
                          className="font-medium hover:text-accent"
                        >
                          {person.full_name || person.email}
                        </Link>
                        <span className="block text-xs text-muted">
                          {person.email}
                        </span>
                        {!person.active && (
                          <span className="mt-1 inline-block">
                            <Badge>ausgeschieden</Badge>
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-muted">
                        {COUNTRY_LABELS[person.country]}
                      </td>
                      <td className="px-3 py-3 text-muted">
                        {ROLE_LABELS[person.role]}
                      </td>
                      <td className="tabular px-3 py-3 text-right">
                        {formatDays(b.annualDays)}
                      </td>
                      <td
                        className={`tabular px-3 py-3 text-right ${b.carryIn < 0 ? "text-negative" : ""}`}
                      >
                        {formatSigned(b.carryIn)}
                      </td>
                      <td className="tabular px-3 py-3 text-right">
                        {formatDays(b.usedVacation)}
                      </td>
                      <td
                        className={`tabular px-4 py-3 text-right font-semibold sm:px-5 ${
                          b.closing < 0 ? "text-negative" : "text-positive"
                        }`}
                      >
                        {formatSigned(b.closing)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
