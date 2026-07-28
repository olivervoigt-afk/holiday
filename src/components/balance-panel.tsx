import { Card, CardHeader, Stat } from "@/components/ui";
import { formatDate, formatDays, formatSigned } from "@/lib/format";
import type { YearBalance } from "@/lib/leave";

/** Die vier Kennzahlen, die im Alltag zählen. */
export function BalanceTiles({ balance }: { balance: YearBalance }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat
        label="Jahresanspruch"
        value={formatDays(balance.annualDays)}
        hint={`für ${balance.year}`}
      />
      <Stat
        label="Vortrag"
        value={formatSigned(balance.carryIn)}
        tone={balance.carryIn < 0 ? "negative" : "neutral"}
        hint={
          balance.carryIn < 0
            ? "Minus aus dem Vorjahr"
            : balance.carryExpiryPending && balance.carryExpiresOn
              ? `bis ${formatDate(balance.carryExpiresOn)} zu verbrauchen`
              : balance.carryForfeited > 0 && balance.carryExpiresOn
                ? `davon ${formatDays(balance.carryForfeited)} am ${formatDate(balance.carryExpiresOn)} verfallen`
                : "aus dem Vorjahr"
        }
      />
      <Stat
        label="Verbraucht"
        value={formatDays(balance.usedVacation)}
        hint={
          balance.pendingVacation > 0
            ? `${formatDays(balance.pendingVacation)} offen beantragt`
            : "genehmigter Urlaub"
        }
      />
      <Stat
        label="Saldo"
        value={formatSigned(balance.closing)}
        tone={
          balance.closing < 0
            ? "negative"
            : balance.closing > 0
              ? "positive"
              : "neutral"
        }
        hint={
          balance.pendingVacation > 0
            ? `${formatSigned(balance.remaining)} nach offenen Anträgen`
            : "noch verfügbar"
        }
      />
    </div>
  );
}

function Row({
  label,
  value,
  hint,
  strong,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  strong?: boolean;
  tone?: "negative" | "positive" | "muted";
}) {
  const colors = {
    negative: "text-negative",
    positive: "text-positive",
    muted: "text-muted",
  };

  return (
    <div
      className={`flex items-baseline justify-between gap-4 px-4 py-2.5 sm:px-5 ${
        strong ? "bg-surface-muted/60 font-semibold" : ""
      }`}
    >
      <span className="text-sm">
        {label}
        {hint && <span className="ml-2 text-xs text-muted">{hint}</span>}
      </span>
      <span
        className={`tabular text-sm whitespace-nowrap ${tone ? colors[tone] : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

/** Vollständige Herleitung des Saldos — für die eigene Übersicht. */
export function BalanceBreakdown({ balance }: { balance: YearBalance }) {
  return (
    <Card>
      <CardHeader
        title={`Urlaubskonto ${balance.year}`}
        description="So setzt sich der Saldo zusammen"
      />
      <div className="divide-y divide-border">
        <Row
          label="Vortrag aus dem Vorjahr"
          hint={
            balance.carryIsManual
              ? "als Startsaldo hinterlegt"
              : balance.carryExpiryPending && balance.carryExpiresOn
                ? `bis ${formatDate(balance.carryExpiresOn)} zu verbrauchen`
                : undefined
          }
          value={formatSigned(balance.carryIn)}
          tone={balance.carryIn < 0 ? "negative" : undefined}
        />
        {balance.carryForfeited > 0 && (
          <Row
            label="davon verfallen"
            hint={
              balance.carryExpiresOn
                ? `nicht verbraucht bis ${formatDate(balance.carryExpiresOn)}`
                : undefined
            }
            value={`− ${formatDays(balance.carryForfeited)}`}
            tone="negative"
          />
        )}
        <Row label="Jahresanspruch" value={`+ ${formatDays(balance.annualDays)}`} />
        <Row label="Verfügbar" value={formatDays(balance.available)} strong />
        <Row
          label="Genehmigter Urlaub"
          value={`− ${formatDays(balance.usedVacation)}`}
        />
        <Row
          label="Saldo"
          value={formatSigned(balance.closing)}
          tone={balance.closing < 0 ? "negative" : "positive"}
          strong
        />
        {balance.pendingVacation > 0 && (
          <>
            <Row
              label="Noch offene Anträge"
              value={`− ${formatDays(balance.pendingVacation)}`}
              tone="muted"
            />
            <Row
              label="Voraussichtlich übrig"
              value={formatSigned(balance.remaining)}
              tone={balance.remaining < 0 ? "negative" : undefined}
            />
          </>
        )}
        {balance.usedSpecial > 0 && (
          <Row
            label="Sonderurlaub / unbezahlt"
            hint="zählt nicht gegen den Anspruch"
            value={formatDays(balance.usedSpecial)}
            tone="muted"
          />
        )}
        <Row
          label={`Übertrag nach ${balance.year + 1}`}
          hint={
            balance.lostAtYearEnd > 0
              ? `${formatDays(balance.lostAtYearEnd)} über der Obergrenze verfallen`
              : undefined
          }
          value={formatSigned(balance.carryOut)}
          tone={balance.carryOut < 0 ? "negative" : undefined}
        />
      </div>
      {balance.missingEntitlement ? (
        <p className="border-t border-border bg-warning/10 px-4 py-3 text-sm text-warning sm:px-5">
          Für {balance.year} ist noch kein Kontingent hinterlegt. Der
          Administrator kann es unter „Team“ eintragen.
        </p>
      ) : (
        balance.inheritedFrom !== null && (
          <p className="border-t border-border px-4 py-3 text-xs text-muted sm:px-5">
            Für {balance.year} gibt es keinen eigenen Eintrag — es gelten die
            Werte aus {balance.inheritedFrom} weiter.
          </p>
        )
      )}
    </Card>
  );
}
