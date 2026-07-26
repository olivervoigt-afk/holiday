import StatusBadge from "@/components/status-badge";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import YearSwitch from "@/components/year-switch";
import { requireProfile } from "@/lib/auth";
import { formatDate, formatDayCount, formatRange, formatWeekday } from "@/lib/format";
import { holidayLookup, requestDays, toISODate } from "@/lib/leave";
import { getHolidays, getTeamAbsences } from "@/lib/queries";
import {
  COUNTRY_LABELS,
  KIND_LABELS_SHORT,
  type CountryCode,
  type TeamAbsence,
} from "@/lib/types";
import { currentYear, upcomingYears } from "@/lib/years";

export const metadata = { title: "Abwesenheiten" };

const MONTHS = new Intl.DateTimeFormat("de-AT", {
  month: "long",
  year: "numeric",
});

export default async function AbsencesPage({
  searchParams,
}: {
  searchParams: Promise<{ jahr?: string }>;
}) {
  const profile = await requireProfile();
  const today = toISODate(new Date());

  // Nur nach vorn: was vorbei ist, muss niemand mehr nachschlagen.
  const years = upcomingYears();
  const raw = Number((await searchParams).jahr);
  const year = years.includes(raw) ? raw : currentYear();

  const from = year === currentYear() ? today : `${year}-01-01`;
  const to = `${year}-12-31`;

  const [absences, holidays] = await Promise.all([
    getTeamAbsences(from, to),
    getHolidays(),
  ]);

  const lookups = new Map<CountryCode, (day: string) => boolean>(
    (["AT", "MT"] as CountryCode[]).map((country) => [
      country,
      holidayLookup(
        holidays.filter((h) => h.country === country).map((h) => h.day),
      ),
    ]),
  );

  // Nach Monat des Beginns gruppieren — so bleibt eine lange Liste lesbar.
  const groups = new Map<string, TeamAbsence[]>();
  for (const absence of absences) {
    const key = (absence.start_date < from ? from : absence.start_date).slice(0, 7);
    const list = groups.get(key);
    if (list) list.push(absence);
    else groups.set(key, [absence]);
  }

  const running = absences.filter(
    (a) => a.start_date <= today && a.end_date >= today,
  );

  return (
    <>
      <PageHeader
        title="Wer ist wann weg?"
        description={
          profile.role === "admin"
            ? "Kommende Abwesenheiten im Team"
            : `Kommende Abwesenheiten der Kolleginnen und Kollegen in ${COUNTRY_LABELS[profile.country]}`
        }
        action={
          <YearSwitch
            years={years}
            current={year}
            basePath="/abwesenheiten"
          />
        }
      />

      {running.length > 0 && (
        <Card className="mb-5">
          <CardHeader title="Gerade abwesend" />
          <ul className="divide-y divide-border">
            {running.map((absence, index) => (
              <li
                key={`${absence.profile_id}-${index}`}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5"
              >
                <span className="font-medium">{absence.full_name}</span>
                <span className="tabular text-sm text-muted">
                  bis {formatDate(absence.end_date)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader
          title={`Abwesenheiten ${year}`}
          description={
            year === currentYear()
              ? `${absences.length} ${absences.length === 1 ? "Eintrag" : "Einträge"} ab heute`
              : `${absences.length} ${absences.length === 1 ? "Eintrag" : "Einträge"}`
          }
        />

        {absences.length === 0 ? (
          <EmptyState
            title={`Für ${year} ist niemand eingetragen`}
            description="Sobald Urlaub beantragt wird, steht er hier."
          />
        ) : (
          <div className="divide-y divide-border">
            {[...groups.entries()].map(([month, entries]) => (
              <section key={month}>
                <h3 className="bg-surface-muted/60 px-4 py-2 text-xs font-semibold tracking-wide text-muted uppercase sm:px-5">
                  {MONTHS.format(new Date(`${month}-01T00:00:00Z`))}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <tbody className="divide-y divide-border">
                      {entries.map((absence, index) => {
                        const isHoliday = lookups.get(absence.country)!;
                        const days = requestDays(
                          {
                            start_date: absence.start_date,
                            end_date: absence.end_date,
                            start_half_day: absence.start_half_day,
                            end_half_day: absence.end_half_day,
                          },
                          isHoliday,
                        );

                        return (
                          <tr
                            key={`${absence.profile_id}-${index}`}
                            className="hover:bg-surface-muted/50"
                          >
                            <td className="px-4 py-2.5 font-medium sm:px-5">
                              {absence.full_name}
                              {profile.role === "admin" && (
                                <span className="ml-2 text-xs font-normal text-muted">
                                  {COUNTRY_LABELS[absence.country]}
                                </span>
                              )}
                            </td>
                            <td className="tabular px-3 py-2.5 whitespace-nowrap">
                              {formatWeekday(absence.start_date)}{" "}
                              {formatRange(absence.start_date, absence.end_date)}
                            </td>
                            <td className="tabular px-3 py-2.5 text-right whitespace-nowrap text-muted">
                              {formatDayCount(days)}
                            </td>
                            <td className="px-3 py-2.5">
                              {absence.kind === "special" && (
                                <Badge>{KIND_LABELS_SHORT.special}</Badge>
                              )}
                            </td>
                            <td className="px-4 py-2.5 sm:px-5">
                              <StatusBadge status={absence.status} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        )}
      </Card>

      <p className="mt-4 text-xs text-muted">
        Angezeigt werden Name und Zeitraum — Begründungen bleiben zwischen dem
        Mitarbeiter und dem Administrator.
      </p>
    </>
  );
}
