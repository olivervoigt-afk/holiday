import Link from "next/link";

/** Jahreswahl als Segmentleiste — funktioniert auch ohne JavaScript. */
export default function YearSwitch({
  years,
  current,
  basePath,
  params,
}: {
  years: number[];
  current: number;
  basePath: string;
  /** Weitere Parameter, die beim Jahreswechsel erhalten bleiben sollen. */
  params?: Record<string, string>;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-border bg-surface">
      {years.map((year) => {
        const active = year === current;
        const query = new URLSearchParams({
          ...params,
          jahr: String(year),
        });
        return (
          <Link
            key={year}
            href={`${basePath}?${query}`}
            aria-current={active ? "true" : undefined}
            className={`tabular px-3 py-1.5 text-sm transition-colors ${
              active
                ? "bg-accent text-accent-fg"
                : "text-muted hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            {year}
          </Link>
        );
      })}
    </div>
  );
}

/** Die Jahre, die zur Auswahl stehen: zwei zurück, eines voraus. */
export function selectableYears(reference = new Date().getFullYear()): number[] {
  return [reference - 2, reference - 1, reference, reference + 1];
}

/** Liest ?jahr= aus der Adresse und begrenzt den Wert auf die Auswahl. */
export function resolveYear(raw: string | string[] | undefined): number {
  const years = selectableYears();
  const value = Number(Array.isArray(raw) ? raw[0] : raw);
  return years.includes(value) ? value : new Date().getFullYear();
}
