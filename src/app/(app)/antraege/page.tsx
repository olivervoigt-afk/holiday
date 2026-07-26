import RequestList from "@/components/request-list";
import { ButtonLink, Card, CardHeader, PageHeader } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { requestDays } from "@/lib/leave";
import { getLeaveOverview } from "@/lib/queries";
import { STATUS_LABELS } from "@/lib/types";

export const metadata = { title: "Meine Anträge" };

export default async function RequestsPage() {
  const profile = await requireProfile();
  const { requests, isHoliday } = await getLeaveOverview(profile);

  const days = new Map(
    requests.map((r) => [r.id, requestDays(r, isHoliday)] as const),
  );

  const open = requests.filter((r) => r.status === "pending");
  const decided = requests.filter((r) => r.status !== "pending");

  return (
    <>
      <PageHeader
        title="Meine Anträge"
        description={`${requests.length} ${requests.length === 1 ? "Eintrag" : "Einträge"} insgesamt`}
        action={<ButtonLink href="/antraege/neu">Neuer Antrag</ButtonLink>}
      />

      <div className="space-y-5">
        <Card>
          <CardHeader
            title={STATUS_LABELS.pending}
            description="Warten auf die Entscheidung des Administrators"
          />
          <RequestList
            requests={open}
            days={days}
            mode="own"
            emptyTitle="Kein offener Antrag"
          />
        </Card>

        <Card>
          <CardHeader title="Erledigt" description="Entschiedene und zurückgezogene Anträge" />
          <RequestList
            requests={decided}
            days={days}
            mode="none"
            emptyTitle="Noch nichts entschieden"
          />
        </Card>
      </div>
    </>
  );
}
