import Link from "next/link";
import { Button, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { markAllRead } from "@/lib/actions/notifications";
import { requireProfile } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { getNotifications } from "@/lib/queries";

export const metadata = { title: "Benachrichtigungen" };

export default async function NotificationsPage() {
  const profile = await requireProfile();
  const notifications = await getNotifications(profile.id);
  const unread = notifications.filter((n) => !n.read_at).length;

  return (
    <>
      <PageHeader
        title="Benachrichtigungen"
        description={
          unread > 0 ? `${unread} ungelesen` : "Alles gelesen"
        }
        action={
          unread > 0 ? (
            <form action={markAllRead}>
              <Button type="submit" variant="secondary">
                Alle als gelesen markieren
              </Button>
            </form>
          ) : undefined
        }
      />

      <Card>
        <CardHeader title="Verlauf" description="Die letzten 50 Meldungen" />
        {notifications.length === 0 ? (
          <EmptyState
            title="Noch nichts passiert"
            description="Hier landen neue Anträge und Entscheidungen."
          />
        ) : (
          <ul className="divide-y divide-border">
            {notifications.map((notification) => (
              <li
                key={notification.id}
                className={`px-4 py-3.5 sm:px-5 ${
                  notification.read_at ? "" : "bg-accent/5"
                }`}
              >
                <Link href={notification.href} className="block group">
                  <p className="flex items-center gap-2 font-medium group-hover:text-accent">
                    {!notification.read_at && (
                      <span
                        className="size-1.5 shrink-0 rounded-full bg-accent"
                        aria-label="ungelesen"
                      />
                    )}
                    {notification.title}
                  </p>
                  {notification.body && (
                    <p className="mt-1 text-sm whitespace-pre-line text-muted">
                      {notification.body}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted">
                    {formatDateTime(notification.created_at)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
