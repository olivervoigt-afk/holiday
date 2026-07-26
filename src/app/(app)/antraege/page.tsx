import RequestTable from "@/components/request-table";
import { ButtonLink, Card, CardHeader, PageHeader } from "@/components/ui";
import YearSwitch from "@/components/year-switch";
import { requireProfile } from "@/lib/auth";
import { requestDays, toISODate } from "@/lib/leave";
import { getLeaveOverview } from "@/lib/queries";
import { OPEN_STATUSES, type LeaveRequest } from "@/lib/types";
import { resolveYear, selectableYears } from "@/lib/years";

export const metadata = { title: "Meine Anträge" };

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ jahr?: string }>;
}) {
  const profile = await requireProfile();
  const year = resolveYear((await searchParams).jahr);
  const { requests, isHoliday } = await getLeaveOverview(profile);

  const days = new Map(
    requests.map((r) => [r.id, requestDays(r, isHoliday)] as const),
  );

  const today = toISODate(new Date());

  // Oben nur, was noch etwas werden kann: offene Anträge, beantragte
  // Stornierungen und genehmigter Urlaub, der noch bevorsteht. Was gelaufen
  // ist, gehört in die Historie — stornieren lässt es sich ohnehin nicht mehr.
  const isLive = (r: LeaveRequest) =>
    OPEN_STATUSES.includes(r.status) ||
    (r.status === "approved" && r.end_date >= today);

  const live = [...requests]
    .filter(isLive)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));

  const past = requests.filter(
    (r) =>
      !isLive(r) &&
      r.start_date <= `${year}-12-31` &&
      r.end_date >= `${year}-01-01`,
  );

  return (
    <>
      <PageHeader
        title="Meine Anträge"
        description={`${live.length} ${live.length === 1 ? "laufender Eintrag" : "laufende Einträge"}`}
        action={<ButtonLink href="/antraege/neu">Neuer Antrag</ButtonLink>}
      />

      <div className="space-y-5">
        <Card>
          <CardHeader
            title="Offen und bevorstehend"
            description="Nur hier lässt sich noch etwas ändern"
          />
          <RequestTable
            requests={live}
            days={days}
            mode="own"
            emptyTitle="Nichts eingetragen"
            emptyDescription="Über „Neuer Antrag“ oben lässt sich Urlaub beantragen."
          />
        </Card>

        <Card>
          <CardHeader
            title="Historie"
            description="Genommener Urlaub sowie abgelehnte, zurückgezogene und stornierte Anträge"
            action={
              <YearSwitch
                years={selectableYears()}
                current={year}
                basePath="/antraege"
              />
            }
          />
          <RequestTable
            requests={past}
            days={days}
            emptyTitle={`Nichts aus ${year}`}
          />
        </Card>
      </div>
    </>
  );
}
