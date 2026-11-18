import { useEffect, useState } from "react";

import { useAuth } from "@/auth/AuthProvider";
import type { CommentFact, MemberActivity, UpvoteFact } from "@/lib/awards";
import { isDemoMode } from "@/lib/demoMode";
import { getDemoMemberActivity } from "@/lib/demoStore";
import { supabase } from "@/lib/supabase";

const empty: MemberActivity = { viewedPrototypeIds: [], replies: 0, comments: [], upvotes: [] };

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
      const [views, comments, replies, upvotes] = await Promise.all([
        supabase.from("prototype_views").select("prototype_id").eq("viewer_id", user.id),
        supabase.from("comments").select("id, prototype_id, author_id, created_at, status, resolved_by"),
        supabase.from("replies").select("id", { count: "exact", head: true }).eq("author_id", user.id),
        supabase.from("comment_upvotes").select("comment_id, user_id"),
      ]);
      if (cancelled) return;
      setActivity({
        viewedPrototypeIds: (views.data ?? []).map((row) => row.prototype_id as string),
        replies: replies.count ?? 0,
        comments: (comments.data ?? []) as CommentFact[],
        upvotes: (upvotes.data ?? []) as UpvoteFact[],
      });
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [user]);

  return { activity, loading };
}
