import CancelRequestForm from "@/components/cancel-request-form";
import ConfirmButton from "@/components/confirm-button";
import StatusBadge from "@/components/status-badge";
import { EmptyState } from "@/components/ui";
import { cancelRequest } from "@/lib/actions/requests";
import { formatDate, formatDays, formatRange } from "@/lib/format";
import { toISODate } from "@/lib/leave";
import { KIND_LABELS_SHORT, type LeaveRequest, type Profile } from "@/lib/types";

/**
 * Kompakte Tabelle für längere Listen — im Jahr kommen leicht ein Dutzend
 * Einträge zusammen, dafür ist die ausführliche Kartendarstellung zu breit.
 */
export default function RequestTable({
  requests,
  days,
  people,
  mode = "none",
  emptyTitle = "Keine Einträge",
  emptyDescription,
}: {
  requests: LeaveRequest[];
  days: Map<string, number>;
  /** Namen anzeigen — für Ansichten über mehrere Personen. */
  people?: Map<string, Profile>;
  /** "own" blendet eine Spalte mit Zurückziehen bzw. Stornieren ein. */
  mode?: "none" | "own";
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const today = toISODate(new Date());
  if (requests.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs tracking-wide text-muted uppercase">
            {people && <th className="px-4 py-2.5 font-medium sm:px-5">Wer</th>}
            <th className={`py-2.5 font-medium ${people ? "px-3" : "px-4 sm:px-5"}`}>
              Zeitraum
            </th>
            <th className="px-3 py-2.5 text-right font-medium">Tage</th>
            <th className="px-3 py-2.5 font-medium">Art</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            {mode === "own" ? (
              <th className="px-4 py-2.5 font-medium sm:px-5">
                <span className="sr-only">Aktion</span>
              </th>
            ) : (
              <th className="px-4 py-2.5 font-medium sm:px-5">Entschieden</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {requests.map((request) => {
            const person = people?.get(request.profile_id);
            const note = request.decision_note || request.cancel_reason;

            return (
              <tr key={request.id} className="align-top hover:bg-surface-muted/50">
                {people && (
                  <td className="px-4 py-2.5 font-medium sm:px-5">
                    {person?.full_name || person?.email || "—"}
                  </td>
                )}
                <td
                  className={`tabular py-2.5 whitespace-nowrap ${people ? "px-3" : "px-4 sm:px-5"}`}
                >
                  {formatRange(request.start_date, request.end_date)}
                  {(request.start_half_day || request.end_half_day) && (
                    <span className="ml-1 text-xs text-muted">½</span>
                  )}
                </td>
                <td className="tabular px-3 py-2.5 text-right whitespace-nowrap">
                  {formatDays(days.get(request.id) ?? 0)}
                </td>
                <td className="px-3 py-2.5 text-muted">
                  {KIND_LABELS_SHORT[request.kind]}
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={request.status} />
                  {note && (
                    <span className="mt-1 block max-w-[18rem] text-xs text-muted">
                      {note}
                    </span>
                  )}
                </td>
                {mode === "own" ? (
                  <td className="px-4 py-2.5 sm:px-5">
                    {request.status === "pending" && (
                      <form action={cancelRequest}>
                        <input type="hidden" name="id" value={request.id} />
                        <ConfirmButton
                          question="Diesen Antrag wirklich zurückziehen?"
                          variant="ghost"
                        >
                          Zurückziehen
                        </ConfirmButton>
                      </form>
                    )}
                    {/* Vergangenes lässt sich nicht mehr zurückgeben. */}
                    {request.status === "approved" &&
                      request.end_date >= today && (
                        <CancelRequestForm requestId={request.id} direct={false} />
                      )}
                    {request.status === "cancel_requested" && (
                      <span className="text-xs text-muted">
                        beim Administrator
                      </span>
                    )}
                  </td>
                ) : (
                  <td className="tabular px-4 py-2.5 text-muted whitespace-nowrap sm:px-5">
                    {request.decided_at
                      ? formatDate(request.decided_at.slice(0, 10))
                      : "—"}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
