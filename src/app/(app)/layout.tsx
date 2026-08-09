import { BottomNav, TopNav } from "@/components/nav";
import RefreshOnReturn from "@/components/refresh-on-return";
import { requireProfile } from "@/lib/auth";
import { countUnread } from "@/lib/queries";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();
  const unread = await countUnread(profile.id);

  return (
    <>
      <RefreshOnReturn />
      <TopNav profile={profile} unread={unread} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-24 sm:px-6 sm:py-8 md:pb-8">
        {children}
      </main>
      <BottomNav profile={profile} />
    </>
  );
}
