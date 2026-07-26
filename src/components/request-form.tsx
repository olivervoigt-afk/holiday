"use client";

import { useActionState, useMemo, useState } from "react";
import {
  Button,
  ButtonLink,
  Card,
  Field,
  FormMessage,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import type { ActionState } from "@/lib/actions/auth";
import { createRequest } from "@/lib/actions/requests";
import { formatDayCount, formatRange } from "@/lib/format";
import { eachDay, holidayLookup, isWeekend, overlaps, requestDays } from "@/lib/leave";
import { KIND_LABELS, type LeaveKind, type TeamAbsence } from "@/lib/types";

export default function RequestForm({
  holidays,
  colleagues,
  myId,
}: {
  holidays: string[];
  /** Abwesenheiten der Kollegen desselben Landes. */
  colleagues: TeamAbsence[];
  myId: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createRequest,
    {},
  );

  const today = new Date().toISOString().slice(0, 10);
  const [kind, setKind] = useState<LeaveKind>("vacation");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [startHalf, setStartHalf] = useState(false);
  const [endHalf, setEndHalf] = useState(false);

  const isHoliday = useMemo(() => holidayLookup(holidays), [holidays]);
  const singleDay = start === end;

  const preview = useMemo(() => {
    if (!start || !end || end < start) return null;
    const days = requestDays(
      {
        start_date: start,
        end_date: end,
        start_half_day: startHalf,
        end_half_day: singleDay ? startHalf : endHalf,
      },
      isHoliday,
    );
    const skipped = eachDay(start, end).filter(
      (day) => isWeekend(day) || isHoliday(day),
    ).length;
    return { days, skipped };
  }, [start, end, startHalf, endHalf, singleDay, isHoliday]);

  const clashes = useMemo(() => {
    if (!start || !end || end < start) return [];
    return colleagues.filter(
      (a) =>
        a.profile_id !== myId &&
        overlaps(a, { start_date: start, end_date: end }),
    );
  }, [colleagues, myId, start, end]);

  // Das Ende darf nie vor dem Beginn liegen.
  function onStartChange(value: string) {
    setStart(value);
    if (value && end < value) setEnd(value);
  }

  return (
    <Card className="p-5">
      <form action={action} className="space-y-4">
        <Field label="Art">
          <Select
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as LeaveKind)}
          >
            {(Object.keys(KIND_LABELS) as LeaveKind[]).map((value) => (
              <option key={value} value={value}>
                {KIND_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Erster Tag">
            <Input
              name="start_date"
              type="date"
              required
              value={start}
              onChange={(e) => onStartChange(e.target.value)}
            />
          </Field>
          <Field label="Letzter Tag">
            <Input
              name="end_date"
              type="date"
              required
              min={start}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </Field>
        </div>

        {singleDay ? (
          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              name="start_half_day"
              className="size-4 accent-[var(--accent)]"
              checked={startHalf}
              onChange={(e) => setStartHalf(e.target.checked)}
            />
            Nur ein halber Tag
          </label>
        ) : (
          <div className="space-y-2.5">
            <label className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                name="start_half_day"
                className="size-4 accent-[var(--accent)]"
                checked={startHalf}
                onChange={(e) => setStartHalf(e.target.checked)}
              />
              Erster Tag erst ab Mittag
            </label>
            <label className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                name="end_half_day"
                className="size-4 accent-[var(--accent)]"
                checked={endHalf}
                onChange={(e) => setEndHalf(e.target.checked)}
              />
              Letzter Tag nur bis Mittag
            </label>
          </div>
        )}

        <Field label="Anmerkung" hint="Optional — für den Administrator sichtbar.">
          <Textarea name="reason" rows={3} />
        </Field>

        {preview && (
          <div className="rounded-md border border-border bg-surface-muted px-3.5 py-3 text-sm">
            {preview.days > 0 ? (
              <>
                <strong className="tabular">
                  {formatDayCount(preview.days)}
                </strong>{" "}
                werden angerechnet.
                {preview.skipped > 0 && (
                  <span className="text-muted">
                    {" "}
                    {preview.skipped}{" "}
                    {preview.skipped === 1 ? "Tag ist" : "Tage sind"} Wochenende
                    oder Feiertag und zählen nicht mit.
                  </span>
                )}
                {kind === "special" && (
                  <span className="text-muted">
                    {" "}
                    Sonderurlaub wird nicht vom Jahresanspruch abgezogen.
                  </span>
                )}
              </>
            ) : (
              <span className="text-warning">
                Der Zeitraum besteht nur aus Wochenenden und Feiertagen.
              </span>
            )}
          </div>
        )}

        {clashes.length > 0 && (
          <div className="rounded-md border border-warning/40 bg-warning/10 px-3.5 py-3 text-sm">
            <p className="font-medium text-warning">
              {clashes.length === 1
                ? "Eine Kollegin oder ein Kollege ist im selben Zeitraum weg:"
                : `${clashes.length} Kollegen sind im selben Zeitraum weg:`}
            </p>
            <ul className="mt-1.5 space-y-0.5 text-muted">
              {clashes.map((a, index) => (
                <li key={`${a.profile_id}-${index}`}>
                  {a.full_name} · {formatRange(a.start_date, a.end_date)}
                  {a.status === "pending" && " (noch offen)"}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">
              Der Antrag lässt sich trotzdem einreichen — entschieden wird er
              vom Administrator.
            </p>
          </div>
        )}

        <FormMessage state={state} />

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending || preview?.days === 0}>
            {pending ? "Wird eingereicht …" : "Antrag einreichen"}
          </Button>
          <ButtonLink href="/antraege" variant="secondary">
            {state.success ? "Zu meinen Anträgen" : "Abbrechen"}
          </ButtonLink>
        </div>
      </form>
    </Card>
  );
}
