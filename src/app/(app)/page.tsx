import { BalanceBreakdown, BalanceTiles } from "@/components/balance-panel";
import RequestList from "@/components/request-list";
import RequestTable from "@/components/request-table";
import { ButtonLink, Card, CardHeader, PageHeader } from "@/components/ui";
import YearSwitch from "@/components/year-switch";
import { requireProfile } from "@/lib/auth";
import { clashesFor, emptyBalance, requestDays } from "@/lib/leave";
import { getLeaveOverview, getTeamOverview } from "@/lib/queries";
import { COUNTRY_LABELS, OPEN_STATUSES } from "@/lib/types";
import { lastYear, resolveYear, selectableYears } from "@/lib/years";

/**
 * Die Startseite zeigt jedem dasselbe: das eigene Urlaubskonto. Der
 * Administrator bekommt darüber die Anträge, über die er entscheiden muss —
 * die Team-Tabelle steht unter „Team“ und wird hier nicht wiederholt.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ jahr?: string }>;
}) {
  const profile = await requireProfile();
  const year = resolveYear((await searchParams).jahr);

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

  const firstName = profile.full_name.split(" ")[0] || profile.email;

  return (
    <>
      <PageHeader
        title={`Hallo, ${firstName}`}
        description={`Feiertage nach ${COUNTRY_LABELS[profile.country]}`}
        action={<ButtonLink href="/antraege/neu">Urlaub beantragen</ButtonLink>}
      />

      {profile.role === "admin" && <PendingDecisions />}

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

/** Nur für den Administrator: was auf eine Entscheidung wartet. */
async function PendingDecisions() {
  const { rows, requests, lookups } = await getTeamOverview(new Date().getFullYear());

  const people = new Map(rows.map((row) => [row.profile.id, row.profile]));
  const pending = requests
    .filter((r) => OPEN_STATUSES.includes(r.status))
    .sort((a, b) => a.start_date.localeCompare(b.start_date));

  if (pending.length === 0) return null;

  const days = new Map(
    pending.map((r) => {
      const person = people.get(r.profile_id);
      const isHoliday = lookups.get(person?.country ?? "AT")!;
      return [r.id, requestDays(r, isHoliday)] as const;
    }),
  );

  const clashes = new Map(
    pending.map((r) => [r.id, clashesFor(r, requests, people)] as const),
  );

  return (
    <Card className="mb-5 border-warning/40">
      <CardHeader
        title="Zu entscheiden"
        description={`${pending.length} ${pending.length === 1 ? "Antrag wartet" : "Anträge warten"} auf dich`}
      />
      <RequestList
        requests={pending}
        days={days}
        people={people}
        clashes={clashes}
        mode="admin"
      />
    </Card>
  );
}
