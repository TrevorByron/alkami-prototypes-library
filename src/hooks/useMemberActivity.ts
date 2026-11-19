import { useEffect, useState } from "react";

import { useAuth } from "@/auth/AuthProvider";
import type { CommentFact, MemberActivity, UpvoteFact } from "@/lib/awards";
import { isDemoMode } from "@/lib/demoMode";
import { getDemoMemberActivity } from "@/lib/demoStore";
import { fetchLeaderboard } from "@/lib/runnerScores";
import { supabase } from "@/lib/supabase";

const empty: MemberActivity = { viewedPrototypeIds: [], replies: 0, comments: [], upvotes: [], visitDays: [], easterEggs: [], runnerBest: 0, onLeaderboard: false, earlyBird: false };

/** The signed-in member's views, comments and replies: what awards are earned from. */
export function useMemberActivity() {
  const { user } = useAuth();
  const [activity, setActivity] = useState<MemberActivity>(empty);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (isDemoMode) {
        setActivity(getDemoMemberActivity());
        setLoading(false);
        return;
      }
      if (!supabase || !user) {
        setLoading(false);
        return;
      }
      // Some awards compare against other members, so comments and upvotes are
      // read for everyone. Fine at this library's size; move to a database
      // function (or a stored awards table) if it grows.
      // The visit, easter-egg and runner columns arrive with the member_tracking
      // and runner migrations; until then their reads error and read as empty.
      const [views, comments, replies, upvotes, visits, me, firstMembers, board] = await Promise.all([
        supabase.from("prototype_views").select("prototype_id").eq("viewer_id", user.id),
        supabase.from("comments").select("id, prototype_id, author_id, created_at, status, resolved_by, body"),
        supabase.from("replies").select("id", { count: "exact", head: true }).eq("author_id", user.id),
        supabase.from("comment_upvotes").select("comment_id, user_id"),
        supabase.from("member_visits").select("day").eq("user_id", user.id),
        supabase.from("profiles").select("runner_best, easter_eggs").eq("id", user.id).maybeSingle(),
        supabase.from("profiles").select("id").order("created_at").limit(25),
        fetchLeaderboard(),
      ]);
      if (cancelled) return;
      setActivity({
        viewedPrototypeIds: (views.data ?? []).map((row) => row.prototype_id as string),
        replies: replies.count ?? 0,
        comments: (comments.data ?? []) as CommentFact[],
        upvotes: (upvotes.data ?? []) as UpvoteFact[],
        visitDays: (visits.data ?? []).map((row) => row.day as string),
        easterEggs: (me.data?.easter_eggs as string[] | null | undefined) ?? [],
        runnerBest: (me.data?.runner_best as number | null | undefined) ?? 0,
        onLeaderboard: (board ?? []).some((entry) => entry.id === user.id),
        earlyBird: (firstMembers.data ?? []).some((row) => row.id === user.id),
      });
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [user]);

  return { activity, loading };
}
