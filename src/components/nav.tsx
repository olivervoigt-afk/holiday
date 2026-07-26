"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BellIcon,
  CalendarIcon,
  FlagIcon,
  GearIcon,
  HomeIcon,
  ListIcon,
  UsersIcon,
} from "@/components/icons";
import type { Profile } from "@/lib/types";

type NavLink = {
  href: string;
  label: string;
  Icon: (props: { className?: string }) => React.ReactElement;
};

const DASHBOARD: NavLink = { href: "/", label: "Start", Icon: HomeIcon };

function linksFor(profile: Profile): NavLink[] {
  const base: NavLink[] = [
    { href: "/antraege", label: "Anträge", Icon: ListIcon },
    { href: "/abwesenheiten", label: "Abwesend", Icon: CalendarIcon },
  ];

  if (profile.role === "admin") {
    base.push(
      { href: "/mitarbeiter", label: "Team", Icon: UsersIcon },
      { href: "/feiertage", label: "Feiertage", Icon: FlagIcon },
    );
  }

  // Die Einstellungen sitzen als Zahnrad oben rechts, nicht in der Leiste.
  return base;
}

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/**
 * Runder Symbolknopf oben rechts. Die Trefferfläche ist 44 × 44 Punkte gross,
 * das ist das Mindestmass aus Apples Gestaltungsrichtlinien.
 */
function IconButton({
  href,
  label,
  active,
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`relative flex size-11 items-center justify-center rounded-full transition-colors active:scale-95 ${
        active
          ? "bg-surface-muted text-foreground"
          : "text-muted hover:bg-surface-muted hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}

/** Kopfzeile mit Navigation ab Tablet-Breite. */
export function TopNav({
  profile,
  unread,
}: {
  profile: Profile;
  unread: number;
}) {
  const pathname = usePathname();
  // Zum Dashboard führt hier der Namenszug links — ein Eintrag daneben wäre
  // doppelt. In der Fusszeile am Handy gibt es ihn dagegen, dort fehlt der
  // Namenszug in Daumenreichweite.
  const links = linksFor(profile);
  const onNotifications = pathname.startsWith("/benachrichtigungen");
  const onSettings = pathname.startsWith("/einstellungen");

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-surface/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link
          href="/"
          className="text-[15px] font-semibold tracking-tight whitespace-nowrap transition-opacity hover:opacity-70"
        >
          Urlaub<span className="font-normal text-muted">sverwaltung</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {links.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`text-[13px] transition-colors ${
                  active
                    ? "font-medium text-foreground"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-0.5">
          <span className="mr-1.5 hidden text-[13px] text-muted sm:inline">
            {profile.full_name || profile.email}
          </span>

          <IconButton
            href="/benachrichtigungen"
            label={
              unread > 0
                ? `Benachrichtigungen, ${unread} ungelesen`
                : "Benachrichtigungen"
            }
            active={onNotifications}
          >
            <BellIcon className="size-[21px]" />
            {unread > 0 && (
              <span className="absolute top-1.5 right-1.5 flex min-w-[17px] items-center justify-center rounded-full bg-negative px-1 text-[10px] leading-[17px] font-semibold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </IconButton>

          <IconButton
            href="/einstellungen"
            label="Einstellungen"
            active={onSettings}
          >
            <GearIcon className="size-[21px]" />
          </IconButton>
        </div>
      </div>
    </header>
  );
}

/** Fusszeile mit Symbolen — nur auf dem Handy sichtbar. */
export function BottomNav({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const links = [DASHBOARD, ...linksFor(profile)];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      <div className="flex">
        {links.map((link) => {
          const active = isActive(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] transition-colors ${
                active ? "text-accent" : "text-muted"
              }`}
            >
              <link.Icon className="size-5" />
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
