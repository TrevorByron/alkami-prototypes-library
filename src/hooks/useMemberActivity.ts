import { useEffect, useState } from "react";

import { useAuth } from "@/auth/AuthProvider";
import type { MemberActivity } from "@/lib/awards";
import { isDemoMode } from "@/lib/demoMode";
import { getDemoMemberActivity } from "@/lib/demoStore";
import { supabase } from "@/lib/supabase";

const empty: MemberActivity = { viewedPrototypeIds: [], comments: 0, replies: 0 };

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
      const [views, comments, replies] = await Promise.all([
        supabase.from("prototype_views").select("prototype_id").eq("viewer_id", user.id),
        supabase.from("comments").select("id", { count: "exact", head: true }).eq("author_id", user.id),
        supabase.from("replies").select("id", { count: "exact", head: true }).eq("author_id", user.id),
      ]);
      if (cancelled) return;
      setActivity({
        viewedPrototypeIds: (views.data ?? []).map((row) => row.prototype_id as string),
        comments: comments.count ?? 0,
        replies: replies.count ?? 0,
      });
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [user]);

  return { activity, loading };
}
