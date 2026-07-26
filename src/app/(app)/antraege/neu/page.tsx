import { BalanceTiles } from "@/components/balance-panel";
import RequestForm from "@/components/request-form";
import { PageHeader } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { emptyBalance } from "@/lib/leave";
import { getHolidays, getLeaveOverview, getTeamAbsences } from "@/lib/queries";
import { COUNTRY_LABELS } from "@/lib/types";
import { currentYear, FIRST_YEAR, lastYear } from "@/lib/years";

export const metadata = { title: "Neuer Antrag" };

export default async function NewRequestPage() {
  const profile = await requireProfile();
  const year = currentYear();

  const [holidays, { balances }, absences] = await Promise.all([
    getHolidays(profile.country),
    getLeaveOverview(profile),
    // Genau die Spanne, die die Anwendung führt — damit auch nachträgliche
    // Anträge und die Planung fürs übernächste Jahr abgedeckt sind.
    getTeamAbsences(`${FIRST_YEAR}-01-01`, `${lastYear()}-12-31`),
  ]);

  const balance = balances.get(year) ?? emptyBalance(year);

  return (
    <>
      <PageHeader
        title="Urlaub beantragen"
        description={`Arbeitstage nach den Feiertagen von ${COUNTRY_LABELS[profile.country]}`}
      />

      <div className="mb-5">
        <BalanceTiles balance={balance} />
      </div>

      <div className="max-w-2xl">
        <RequestForm
          holidays={holidays.map((h) => h.day)}
          colleagues={absences}
          myId={profile.id}
        />
      </div>
    </>
  );
}
