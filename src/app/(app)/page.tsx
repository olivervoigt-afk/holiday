import Link from "next/link";
import { BalanceBreakdown, BalanceTiles } from "@/components/balance-panel";
import RequestList from "@/components/request-list";
import RequestTable from "@/components/request-table";
import { ButtonLink, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import YearSwitch from "@/components/year-switch";
import { lastYear, resolveYear, selectableYears } from "@/lib/years";
import { requireProfile } from "@/lib/auth";
import { formatDays, formatSigned } from "@/lib/format";
import { clashesFor, emptyBalance, requestDays } from "@/lib/leave";
import { getLeaveOverview, getTeamOverview } from "@/lib/queries";
import { COUNTRY_LABELS, OPEN_STATUSES, type Profile } from "@/lib/types";

type PageProps = {
  searchParams: Promise<{ jahr?: string }>;
};

export default async function DashboardPage({ searchParams }: PageProps) {
  const profile = await requireProfile();
  const year = resolveYear((await searchParams).jahr);

  return profile.role === "admin" ? (
    <AdminDashboard profile={profile} year={year} />
  ) : (
    <UserDashboard profile={profile} year={year} />
  );
}

/* ---------------- Mitarbeiteransicht ---------------- */

async function UserDashboard({
  profile,
  year,
}: {
  profile: Profile;
  year: number;
}) {
  const { requests, isHoliday, balances } = await getLeaveOverview(
    profile,
    Math.max(year, lastYear()),
  );
  const balance = balances.get(year) ?? emptyBalance(year);

  const inYear = requests.filter(
    (r) => r.start_date <= `${year}-12-31` && r.end_date >= `${year}-01-01`,
  );
  const days = new Map(
    inYear.map((r) => [r.id, requestDays(r, isHoliday)] as const),
  );

  return (
    <>
      <PageHeader
        title={`Hallo, ${profile.full_name.split(" ")[0] || profile.email}`}
        description={`Feiertage nach ${COUNTRY_LABELS[profile.country]}`}
        action={
          <ButtonLink href="/antraege/neu">Urlaub beantragen</ButtonLink>
        }
      />

      <div className="mb-5">
        <YearSwitch years={selectableYears()} current={year} basePath="/" />
      </div>

      <div className="space-y-5">
        <BalanceTiles balance={balance} />

        <div className="grid gap-5 lg:grid-cols-2">
          <BalanceBreakdown balance={balance} />

          <Card>
            <CardHeader
              title={`Meine Anträge ${year}`}
              description={`${inYear.length} ${inYear.length === 1 ? "Eintrag" : "Einträge"} — ändern lässt sich das unter „Anträge“`}
            />
            <RequestTable
              requests={inYear}
              days={days}
              emptyTitle={`Noch keine Anträge für ${year}`}
              emptyDescription="Über „Urlaub beantragen“ oben lässt sich der erste erfassen."
            />
          </Card>
        </div>
      </div>
    </>
  );
}

/* ---------------- Administratoransicht ---------------- */

async function AdminDashboard({
  profile,
  year,
}: {
  profile: Profile;
  year: number;
}) {
  const { rows, requests, lookups } = await getTeamOverview(year);

  const people = new Map(rows.map((row) => [row.profile.id, row.profile]));
  // Offene Anträge und beantragte Stornierungen warten beide auf eine
  // Entscheidung und stehen deshalb in derselben Liste.
  const pending = requests
    .filter((r) => OPEN_STATUSES.includes(r.status))
    .sort((a, b) => a.start_date.localeCompare(b.start_date));

  const days = new Map(
    requests.map((r) => {
      const person = people.get(r.profile_id);
      const isHoliday = lookups.get(person?.country ?? "AT")!;
      return [r.id, requestDays(r, isHoliday)] as const;
    }),
  );

  const clashes = new Map(
    pending.map((r) => [r.id, clashesFor(r, requests, people)] as const),
  );

  return (
    <>
      <PageHeader
        title={`Hallo, ${profile.full_name.split(" ")[0] || profile.email}`}
        description={`${rows.length} aktive Mitarbeiter · ${pending.length} offene ${pending.length === 1 ? "Antrag" : "Anträge"}`}
        action={<ButtonLink href="/antraege/neu">Urlaub beantragen</ButtonLink>}
      />

      <div className="mb-5">
        <YearSwitch years={selectableYears()} current={year} basePath="/" />
      </div>

      <div className="space-y-5">
        <Card>
          <CardHeader
            title="Offene Anträge"
            description="Warten auf eine Entscheidung"
          />
          <RequestList
            requests={pending}
            days={days}
            people={people}
            clashes={clashes}
            mode="admin"
            emptyTitle="Alles erledigt"
            emptyDescription="Zurzeit liegt kein Antrag zur Entscheidung vor."
          />
        </Card>

        <Card>
          <CardHeader
            title={`Urlaubskonten ${year}`}
            description="Anspruch, Vortrag und Saldo je Mitarbeiter"
          />
          {rows.length === 0 ? (
            <EmptyState
              title="Noch keine Mitarbeiter"
              description="Unter „Team“ lassen sich Konten anlegen."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs tracking-wide text-muted uppercase">
                    <th className="px-4 py-2.5 font-medium sm:px-5">Mitarbeiter</th>
                    <th className="px-3 py-2.5 text-right font-medium">Anspruch</th>
                    <th className="px-3 py-2.5 text-right font-medium">Vortrag</th>
                    <th className="px-3 py-2.5 text-right font-medium">Verbraucht</th>
                    <th className="px-3 py-2.5 text-right font-medium">Offen</th>
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
                          <span className="ml-2 text-xs text-muted">
                            {COUNTRY_LABELS[person.country]}
                            {person.id === profile.id && " · du"}
                          </span>
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
                        <td className="tabular px-3 py-3 text-right text-muted">
                          {b.pendingVacation > 0 ? formatDays(b.pendingVacation) : "–"}
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
      </div>
    </>
  );
}
