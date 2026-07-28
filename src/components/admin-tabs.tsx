import Link from "next/link";

const TABS = [
  { href: "/mitarbeiter", label: "Mitarbeiter" },
  { href: "/feiertage", label: "Feiertage" },
] as const;

/**
 * Reiter über den Stammdaten. Mitarbeiter und Feiertage gehören sachlich
 * zusammen und teilen sich deshalb einen Platz in der Navigation.
 */
export default function AdminTabs({ current }: { current: string }) {
  return (
    <div className="mb-5 flex gap-1 border-b border-border">
      {TABS.map((tab) => {
        const active = current === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
              active
                ? "border-accent font-medium text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
