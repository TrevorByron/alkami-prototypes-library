import { useMemo } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "@/auth/AuthProvider";
import { AwardsGrid } from "@/components/AwardsGrid";
import { UserAvatar } from "@/components/UserIdentity";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemberActivity } from "@/hooks/useMemberActivity";
import { usePrototypes } from "@/hooks/usePrototypes";
import { computeMemberStats, evaluateAwards } from "@/lib/awards";
import { displayName } from "@/lib/names";

const DAY = 24 * 60 * 60 * 1000;

// "Joined today", "12 days", "3 months", "1 year, 2 months".
function memberFor(since: string | undefined, now = Date.now()) {
  const start = since ? new Date(since).getTime() : NaN;
  if (Number.isNaN(start)) return "—";
  const days = Math.floor((now - start) / DAY);
  if (days < 1) return "Joined today";
  if (days < 31) return `${days} ${days === 1 ? "day" : "days"}`;
  const months = Math.floor(days / 30.44);
  if (months < 12) return `${months} ${months === 1 ? "month" : "months"}`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return `${years} ${years === 1 ? "year" : "years"}${rest ? `, ${rest} ${rest === 1 ? "month" : "months"}` : ""}`;
}

const dateFormat = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" });
const formatDate = (value: string | undefined) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? dateFormat.format(date) : "—";
};

export function ProfileDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { profile, user } = useAuth();
  const name = profile?.name ?? user?.email ?? "Member";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-6 p-8">
        <DialogDescription className="sr-only">Your profile: how long you have been a member and the prototypes you own.</DialogDescription>
        {/* Only mounted while open, so the list loads when the profile is opened. */}
        {open ? <ProfileBody name={name} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ProfileBody({ name }: { name: string }) {
  const { profile, user } = useAuth();
  const { prototypes, loading, error } = usePrototypes();
  const { activity, loading: activityLoading } = useMemberActivity();

  const mine = useMemo(
    () => prototypes.filter((prototype) => prototype.owner_id === user?.id).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [prototypes, user?.id],
  );

  const statuses = useMemo(() => evaluateAwards(computeMemberStats(user?.id, prototypes, activity, user?.created_at)), [prototypes, activity, user?.id]);

  return (
    <>
      <div className="flex items-center gap-5 pr-10">
        <UserAvatar id={user?.id} name={name} src={profile?.avatar_url} className="h-[75px] w-[75px] text-2xl" />
        <div className="min-w-0 text-left">
          <DialogTitle className="text-2xl leading-8">{displayName(name)}</DialogTitle>
          {profile?.email ?? user?.email ? <p className="text-sm text-abyss-5">{profile?.email ?? user?.email}</p> : null}
        </div>
      </div>

      <Card className="px-6 py-4">
        <p className="text-xs text-abyss-5">Member for</p>
        <p className="text-xl font-bold leading-6 text-abyss-9">{memberFor(user?.created_at)}</p>
        <p className="text-xs text-abyss-5">Joined {formatDate(user?.created_at)}</p>
      </Card>

      <section aria-labelledby="profile-prototypes">
        <h3 id="profile-prototypes" className="mb-2 text-base font-bold leading-5 text-abyss-9">
          Your prototypes{loading ? "" : ` (${mine.length})`}
        </h3>
        {loading ? (
          <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
        ) : error ? (
          <p className="text-sm text-abyss-5">Couldn’t load your prototypes.</p>
        ) : mine.length === 0 ? (
          <p className="text-sm text-abyss-5">You haven’t added a prototype yet.</p>
        ) : (
          <div className="max-h-64 overflow-y-auto rounded-lg border-2 border-carbon-2">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-abyss-0 text-xs text-abyss-5">
                <tr className="border-b-2 border-carbon-2">
                  <th scope="col" className="px-4 py-2 font-medium">Prototype</th>
                  <th scope="col" className="px-4 py-2 font-medium">Created</th>
                  <th scope="col" className="w-24 px-4 py-2"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {mine.map((prototype) => (
                  <tr key={prototype.id} className="border-b border-carbon-2 last:border-b-0">
                    <td className="max-w-0 truncate px-4 py-2 text-abyss-9">{prototype.name}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-abyss-7">{formatDate(prototype.created_at)}</td>
                    <td className="px-4 py-1 text-right">
                      <Button asChild variant="ghost" size="sm"><Link to={`/p/${prototype.id}`} aria-label={`Open ${prototype.name}`}>Open</Link></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {loading || activityLoading ? <Skeleton className="h-32 w-full" /> : <AwardsGrid statuses={statuses} />}
    </>
  );
}
