import Link from "next/link";
import { redirect } from "next/navigation";
import AdminTabs from "@/components/admin-tabs";
import ConfirmButton from "@/components/confirm-button";
import { AddHolidayForm, GenerateYearForm } from "@/components/holiday-forms";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import YearSwitch from "@/components/year-switch";
import { resolveYear, selectableYears } from "@/lib/years";
import { requireProfile } from "@/lib/auth";
import { deleteHoliday } from "@/lib/actions/holidays";
import { formatDate, formatWeekday } from "@/lib/format";
import { isWeekend } from "@/lib/leave";
import { getHolidays } from "@/lib/queries";
import { COUNTRIES, COUNTRY_LABELS, type CountryCode } from "@/lib/types";

export const metadata = { title: "Feiertage" };

export default async function HolidaysPage({
  searchParams,
}: {
  searchParams: Promise<{ land?: string; jahr?: string }>;
}) {
  const profile = await requireProfile();
  if (profile.role !== "admin") redirect("/");

  const params = await searchParams;
  const country: CountryCode = COUNTRIES.includes(params.land as CountryCode)
    ? (params.land as CountryCode)
    : "AT";
  const year = resolveYear(params.jahr);

  const all = await getHolidays(country);
  const inYear = all.filter((h) => h.day.startsWith(String(year)));

  return (
    <>
      <AdminTabs current="/feiertage" />

      <PageHeader
        title="Feiertage"
        description="Diese Tage werden bei jedem Antrag automatisch übersprungen."
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded-md border border-border bg-surface">
          {COUNTRIES.map((value) => (
            <Link
              key={value}
              href={`/feiertage?land=${value}&jahr=${year}`}
              aria-current={value === country ? "true" : undefined}
              className={`px-3 py-1.5 text-sm transition-colors ${
                value === country
                  ? "bg-accent text-accent-fg"
                  : "text-muted hover:bg-surface-muted hover:text-foreground"
              }`}
            >
              {COUNTRY_LABELS[value]}
            </Link>
          ))}
        </div>
        <YearSwitch
          years={selectableYears()}
          current={year}
          basePath="/feiertage"
          params={{ land: country }}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader
            title={`${COUNTRY_LABELS[country]} ${year}`}
            description={`${inYear.length} ${inYear.length === 1 ? "Eintrag" : "Einträge"}`}
          />
          {inYear.length === 0 ? (
            <EmptyState
              title={`Für ${year} ist nichts hinterlegt`}
              description="Rechts lassen sich die gesetzlichen Feiertage dieses Jahres in einem Schritt erzeugen."
            />
          ) : (
            <ul className="divide-y divide-border">
              {inYear.map((holiday) => (
                <li
                  key={holiday.id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{holiday.name}</p>
                    <p className="tabular text-xs text-muted">
                      {formatWeekday(holiday.day)}, {formatDate(holiday.day)}
                      {isWeekend(holiday.day) && " · fällt aufs Wochenende"}
                    </p>
                  </div>
                  <form action={deleteHoliday}>
                    <input type="hidden" name="id" value={holiday.id} />
                    <ConfirmButton
                      question={`„${holiday.name}“ am ${formatDate(holiday.day)} löschen?`}
                      variant="ghost"
                    >
                      Löschen
                    </ConfirmButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Gesetzliche Feiertage" />
            <div className="p-4 sm:p-5">
              <GenerateYearForm country={country} year={year} />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Eigener Tag"
              description="Für Betriebsurlaub oder regionale Besonderheiten."
            />
            <div className="p-4 sm:p-5">
              <AddHolidayForm country={country} />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
