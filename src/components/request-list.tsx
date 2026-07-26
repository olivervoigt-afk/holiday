import ConfirmButton from "@/components/confirm-button";
import StatusBadge from "@/components/status-badge";
import { Button, EmptyState, Input } from "@/components/ui";
import {
  approveRequest,
  cancelRequest,
  deleteRequest,
  rejectRequest,
  reopenRequest,
} from "@/lib/actions/requests";
import { formatDateTime, formatDayCount, formatRange } from "@/lib/format";
import {
  COUNTRY_LABELS,
  KIND_LABELS_SHORT,
  type LeaveRequest,
  type Profile,
  type TeamAbsence,
} from "@/lib/types";

export type RequestListProps = {
  requests: LeaveRequest[];
  /** Urlaubstage je Antrag — vom Aufrufer berechnet, inklusive Feiertagen. */
  days: Map<string, number>;
  /** Namen anzeigen (Admin-Ansicht über mehrere Personen). */
  people?: Map<string, Profile>;
  /** Überschneidende Abwesenheiten anderer Mitarbeiter je Antrag. */
  clashes?: Map<string, TeamAbsence[]>;
  /** "own": zurückziehen. "admin": genehmigen, ablehnen, löschen. */
  mode: "own" | "admin" | "none";
  emptyTitle?: string;
  emptyDescription?: string;
};

export default function RequestList({
  requests,
  days,
  people,
  clashes,
  mode,
  emptyTitle = "Keine Anträge",
  emptyDescription,
}: RequestListProps) {
  if (requests.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <ul className="divide-y divide-border">
      {requests.map((request) => {
        const person = people?.get(request.profile_id);
        const count = days.get(request.id) ?? 0;
        const overlapping = clashes?.get(request.id) ?? [];

        return (
          <li key={request.id} className="px-4 py-3.5 sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {person && (
                    <span className="font-medium">
                      {person.full_name || person.email}
                    </span>
                  )}
                  <span className={person ? "text-muted" : "font-medium"}>
                    {formatRange(request.start_date, request.end_date)}
                  </span>
                  <span className="tabular text-sm text-muted">
                    · {formatDayCount(count)}
                  </span>
                </p>

                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                  <span>{KIND_LABELS_SHORT[request.kind]}</span>
                  {(request.start_half_day || request.end_half_day) && (
                    <span>
                      ·{" "}
                      {request.start_half_day && request.end_half_day
                        ? "halbe Tage am Rand"
                        : request.start_half_day
                          ? "Beginn ab Mittag"
                          : "Ende bis Mittag"}
                    </span>
                  )}
                  <span>· eingereicht {formatDateTime(request.created_at)}</span>
                </p>

                {request.reason && (
                  <p className="mt-1.5 text-sm">{request.reason}</p>
                )}
                {request.decision_note && (
                  <p className="mt-1.5 text-sm text-muted">
                    Anmerkung: {request.decision_note}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge status={request.status} />
              </div>
            </div>

            {overlapping.length > 0 && (
              <div className="mt-2.5 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
                <p className="font-medium text-warning">
                  Überschneidung mit{" "}
                  {overlapping.length === 1
                    ? "einem weiteren Urlaub"
                    : `${overlapping.length} weiteren Urlauben`}
                </p>
                <ul className="mt-1 space-y-0.5 text-xs text-muted">
                  {overlapping.map((a, index) => (
                    <li key={`${a.profile_id}-${index}`}>
                      {a.full_name} ({COUNTRY_LABELS[a.country]}) ·{" "}
                      {formatRange(a.start_date, a.end_date)}
                      {a.status === "pending" && " · noch offen"}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {mode === "own" && request.status === "pending" && (
              <form action={cancelRequest} className="mt-3">
                <input type="hidden" name="id" value={request.id} />
                <ConfirmButton
                  question="Diesen Antrag wirklich zurückziehen?"
                  variant="secondary"
                >
                  Zurückziehen
                </ConfirmButton>
              </form>
            )}

            {mode === "admin" && request.status === "pending" && (
              <div className="mt-3 space-y-2">
                <form action={approveRequest} className="flex flex-wrap gap-2">
                  <input type="hidden" name="id" value={request.id} />
                  <Input
                    name="decision_note"
                    placeholder="Anmerkung (optional)"
                    className="min-w-0 flex-1 sm:max-w-xs"
                  />
                  <Button type="submit" variant="positive">
                    Genehmigen
                  </Button>
                </form>
                <form action={rejectRequest}>
                  <input type="hidden" name="id" value={request.id} />
                  <ConfirmButton
                    question="Antrag ablehnen?"
                    variant="secondary"
                  >
                    Ablehnen
                  </ConfirmButton>
                </form>
              </div>
            )}

            {mode === "admin" && request.status !== "pending" && (
              <div className="mt-3 flex flex-wrap gap-2">
                <form action={reopenRequest}>
                  <input type="hidden" name="id" value={request.id} />
                  <Button type="submit" variant="ghost">
                    Entscheidung zurücknehmen
                  </Button>
                </form>
                <form action={deleteRequest}>
                  <input type="hidden" name="id" value={request.id} />
                  <ConfirmButton question="Diesen Antrag endgültig löschen?">
                    Löschen
                  </ConfirmButton>
                </form>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
