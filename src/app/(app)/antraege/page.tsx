import RequestList from "@/components/request-list";
import RequestTable from "@/components/request-table";
import { ButtonLink, Card, CardHeader, PageHeader } from "@/components/ui";
import YearSwitch from "@/components/year-switch";
import { requireProfile } from "@/lib/auth";
import { requestDays } from "@/lib/leave";
import { getLeaveOverview } from "@/lib/queries";
import { BLOCKING_STATUSES } from "@/lib/types";
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

  // Oben alles, was noch läuft: offene Anträge und genehmigte Urlaube — von
  // dort aus lässt sich zurückziehen bzw. die Stornierung beantragen.
  const open = requests.filter((r) => BLOCKING_STATUSES.includes(r.status));

  // Unten das Abgeschlossene, nach Jahr getrennt. Ein Antrag über den
  // Jahreswechsel taucht in beiden Jahren auf.
  const decided = requests.filter(
    (r) =>
      !BLOCKING_STATUSES.includes(r.status) &&
      r.start_date <= `${year}-12-31` &&
      r.end_date >= `${year}-01-01`,
  );

  return (
    <>
      <PageHeader
        title="Meine Anträge"
        description={`${open.length} ${open.length === 1 ? "laufender Eintrag" : "laufende Einträge"}`}
        action={<ButtonLink href="/antraege/neu">Neuer Antrag</ButtonLink>}
      />

      <div className="space-y-5">
        <Card>
          <CardHeader
            title="Aktuell"
            description="Offene Anträge und genehmigte Urlaube"
          />
          <RequestList
            requests={open}
            days={days}
            mode="own"
            emptyTitle="Nichts eingetragen"
            emptyDescription="Über „Neuer Antrag“ oben lässt sich Urlaub beantragen."
          />
        </Card>

        <Card>
          <CardHeader
            title="Erledigt"
            description="Abgelehnte, zurückgezogene und stornierte Anträge"
            action={
              <YearSwitch
                years={selectableYears()}
                current={year}
                basePath="/antraege"
              />
            }
          />
          <RequestTable
            requests={decided}
            days={days}
            emptyTitle={`Nichts Erledigtes aus ${year}`}
          />
        </Card>
      </div>
    </>
  );
}
