import { Eye, Flame, Globe, Monitor, Smartphone, Footprints, GitFork, Handshake, Layers, MessageSquare, MessagesSquare, Reply, Rocket, ScanEye, SquareCheck, Star, Tags, ThumbsUp, Users, type LucideIcon } from "lucide-react";

import { detectPlatform } from "@/lib/platforms";
import type { PrototypeSummary } from "@/lib/types";

// Awards are computed on the fly from data the app already has: nothing is
// stored, so an award can be added, tuned or re-tiered without a migration.
// (Earned dates need a stored awards table; that is a later step.)

export type Tier = "bronze" | "silver" | "gold";
export const tierOrder: Tier[] = ["bronze", "silver", "gold"];
export const tierLabels: Record<Tier, string> = { bronze: "Bronze", silver: "Silver", gold: "Gold" };

export type AwardGroup = "Getting started" | "Builder" | "Surfaces" | "Reviewer" | "Community";

/** What we know about a member. Everything an award can look at lives here. */
export type MemberStats = {
  prototypes: number;
  /** Distinct prototypes by someone else that this member has opened. */
  othersViewed: number;
  comments: number;
  replies: number;
  /** Distinct prototyping tools (Claude, Replit, MANTL) used across their prototypes. */
  tools: number;
  /** Distinct category tags used across their prototypes. */
  tags: number;
  remixes: number;
  committed: number;
  /** Prototypes by someone else where this member left the very first comment. */
  firstComments: number;
  /** Distinct prototypes by someone else this member has commented on. */
  othersCommented: number;
  upvotesGiven: number;
  /** Comments on this member's prototypes that this member resolved. */
  resolved: number;
  /** Views on this member's most-viewed prototype. */
  mostViews: number;
  /** Comments from others on this member's most-discussed prototype. */
  mostDiscussed: number;
  /** Upvotes on this member's most-upvoted comment. */
  topUpvotes: number;
  consolePrototypes: number;
  selfServePrototypes: number;
};

type Metric = keyof MemberStats;

type AwardBase = { id: string; name: string; group: AwardGroup; icon: LucideIcon };
type TieredAward = AwardBase & {
  kind: "tiered";
  metric: Metric;
  /** The count that earns bronze, silver and (when there are three) gold. */
  thresholds: number[];
  /** The trigger in words for a given count: "Create 3 prototypes". */
  describe: (count: number) => string;
};
type SingleAward = AwardBase & { kind: "single"; earned: (stats: MemberStats) => boolean; describe: string };
export type AwardDefinition = TieredAward | SingleAward;

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export const awardDefinitions: AwardDefinition[] = [
  { id: "first-steps", name: "First Steps", group: "Getting started", icon: Footprints, kind: "single", earned: () => true, describe: "Sign in for the first time" },
  { id: "ship-it", name: "Ship It", group: "Getting started", icon: Rocket, kind: "tiered", metric: "prototypes", thresholds: [1, 3, 10], describe: (n) => `Create ${plural(n, "prototype", "prototypes")}` },
  { id: "window-shopper", name: "Window Shopper", group: "Getting started", icon: Eye, kind: "tiered", metric: "othersViewed", thresholds: [1, 5, 15], describe: (n) => `Open ${plural(n, "prototype", "prototypes")} built by someone else` },
  { id: "first-words", name: "First Words", group: "Getting started", icon: MessageSquare, kind: "tiered", metric: "comments", thresholds: [1, 5, 20], describe: (n) => `Leave ${plural(n, "comment", "comments")}` },
  { id: "echo", name: "Echo", group: "Getting started", icon: Reply, kind: "tiered", metric: "replies", thresholds: [1, 5, 20], describe: (n) => `Post ${plural(n, "reply", "replies")}` },
  { id: "multi-tool", name: "Multi-Tool", group: "Builder", icon: Layers, kind: "tiered", metric: "tools", thresholds: [2, 3], describe: (n) => `Build prototypes in ${n} different tools` },
  { id: "remixer", name: "Remixer", group: "Builder", icon: GitFork, kind: "single", earned: (stats) => stats.remixes > 0, describe: "Start a prototype from someone else’s with “Build on this”" },
  { id: "tag-collector", name: "Tag Collector", group: "Builder", icon: Tags, kind: "tiered", metric: "tags", thresholds: [2, 4, 6], describe: (n) => `Use ${n} different category tags` },
  { id: "idea-to-handoff", name: "Idea to Handoff", group: "Builder", icon: Handshake, kind: "single", earned: (stats) => stats.committed > 0, describe: "Tag a prototype Committed" },
  { id: "console-cadet", name: "Console Cadet", group: "Surfaces", icon: Monitor, kind: "tiered", metric: "consolePrototypes", thresholds: [1, 3, 10], describe: (n) => `Create ${plural(n, "Console prototype", "Console prototypes")}` },
  { id: "self-serve-sprinter", name: "Self-Serve Sprinter", group: "Surfaces", icon: Smartphone, kind: "tiered", metric: "selfServePrototypes", thresholds: [1, 3, 10], describe: (n) => `Create ${plural(n, "Self-serve prototype", "Self-serve prototypes")}` },
  { id: "both-worlds", name: "Both Worlds", group: "Surfaces", icon: Globe, kind: "single", earned: (stats) => stats.consolePrototypes > 0 && stats.selfServePrototypes > 0, describe: "Create a Console prototype and a Self-serve prototype" },
  { id: "fresh-eyes", name: "Fresh Eyes", group: "Reviewer", icon: ScanEye, kind: "tiered", metric: "firstComments", thresholds: [1, 3, 10], describe: (n) => `Be the first to comment on ${plural(n, "prototype", "prototypes")}` },
  { id: "critics-circle", name: "Critic’s Circle", group: "Reviewer", icon: MessagesSquare, kind: "tiered", metric: "othersCommented", thresholds: [2, 5, 10], describe: (n) => `Comment on ${n} different people’s prototypes` },
  { id: "thumbs-up", name: "Thumbs Up", group: "Reviewer", icon: ThumbsUp, kind: "tiered", metric: "upvotesGiven", thresholds: [1, 10, 50], describe: (n) => `Upvote ${plural(n, "comment", "comments")}` },
  { id: "resolved", name: "Resolved!", group: "Reviewer", icon: SquareCheck, kind: "tiered", metric: "resolved", thresholds: [1, 5, 15], describe: (n) => `Resolve ${plural(n, "comment", "comments")} on your prototypes` },
  { id: "crowd-pleaser", name: "Crowd Pleaser", group: "Community", icon: Users, kind: "tiered", metric: "mostViews", thresholds: [10, 25, 50], describe: (n) => `Get ${n} views on one of your prototypes` },
  { id: "conversation-starter", name: "Conversation Starter", group: "Community", icon: Flame, kind: "tiered", metric: "mostDiscussed", thresholds: [5, 15, 30], describe: (n) => `Get ${n} comments from others on one prototype` },
  { id: "popular-take", name: "Popular Take", group: "Community", icon: Star, kind: "tiered", metric: "topUpvotes", thresholds: [5, 10, 20], describe: (n) => `Get ${n} upvotes on one of your comments` },
];

export type AwardStatus = {
  award: AwardDefinition;
  /** Highest tier reached; "earned" for one-off awards; null while locked. */
  tier: Tier | "earned" | null;
  count: number | null;
  /** What the next tier asks for (tiered only; null at the top). */
  next: number | null;
  /** The trigger text to show: the next goal while climbing, the top goal once done. */
  hint: string;
};

export function evaluateAward(award: AwardDefinition, stats: MemberStats): AwardStatus {
  if (award.kind === "single") {
    return { award, tier: award.earned(stats) ? "earned" : null, count: null, next: null, hint: award.describe };
  }
  const count = stats[award.metric];
  const reached = award.thresholds.filter((threshold) => count >= threshold).length;
  const nextThreshold = award.thresholds[reached] ?? null;
  const goal = nextThreshold ?? award.thresholds[award.thresholds.length - 1];
  return {
    award,
    tier: reached ? tierOrder[reached - 1] : null,
    count,
    next: nextThreshold,
    hint: award.describe(goal),
  };
}

export function evaluateAwards(stats: MemberStats) {
  return awardDefinitions.map((award) => evaluateAward(award, stats));
}

export type CommentFact = { id: string; prototype_id: string; author_id: string; created_at: string; status: "open" | "resolved"; resolved_by: string | null };
export type UpvoteFact = { comment_id: string; user_id: string };

/** The raw activity that stats are derived from. Comments and upvotes cover every member, since some awards compare against others. */
export type MemberActivity = {
  /** Prototypes this member has opened (any owner). */
  viewedPrototypeIds: string[];
  /** Replies this member has posted. */
  replies: number;
  comments: CommentFact[];
  upvotes: UpvoteFact[];
};

const maxOf = (values: number[]) => values.reduce((top, value) => Math.max(top, value), 0);

export function computeMemberStats(userId: string | undefined, prototypes: PrototypeSummary[], activity: MemberActivity): MemberStats {
  const mine = prototypes.filter((prototype) => prototype.owner_id === userId);
  const ownedIds = new Set(mine.map((prototype) => prototype.id));
  const others = prototypes.filter((prototype) => prototype.owner_id !== userId);
  const tools = new Set(mine.map((prototype) => detectPlatform(prototype.url, prototype.embed_mode)?.id).filter(Boolean));
  const tags = new Set(mine.flatMap((prototype) => prototype.tags));

  const myComments = activity.comments.filter((comment) => comment.author_id === userId);
  const commentsOn = (prototypeId: string) => activity.comments.filter((comment) => comment.prototype_id === prototypeId);
  const earliest = (prototypeId: string) => [...commentsOn(prototypeId)].sort((a, b) => a.created_at.localeCompare(b.created_at))[0];

  const upvotesOn = (commentId: string) => activity.upvotes.filter((upvote) => upvote.comment_id === commentId).length;

  return {
    prototypes: mine.length,
    othersViewed: new Set(activity.viewedPrototypeIds.filter((id) => !ownedIds.has(id))).size,
    comments: myComments.length,
    replies: activity.replies,
    tools: tools.size,
    tags: tags.size,
    remixes: mine.filter((prototype) => Boolean(prototype.source_meta?.based_on)).length,
    committed: mine.filter((prototype) => prototype.tags.includes("committed")).length,
    firstComments: others.filter((prototype) => earliest(prototype.id)?.author_id === userId).length,
    othersCommented: new Set(myComments.map((comment) => comment.prototype_id).filter((id) => !ownedIds.has(id))).size,
    upvotesGiven: activity.upvotes.filter((upvote) => upvote.user_id === userId).length,
    resolved: activity.comments.filter((comment) => ownedIds.has(comment.prototype_id) && comment.status === "resolved" && comment.resolved_by === userId).length,
    mostViews: maxOf(mine.map((prototype) => prototype.view_count ?? 0)),
    mostDiscussed: maxOf(mine.map((prototype) => commentsOn(prototype.id).filter((comment) => comment.author_id !== userId).length)),
    topUpvotes: maxOf(myComments.map((comment) => upvotesOn(comment.id))),
    consolePrototypes: mine.filter((prototype) => prototype.surface === "console").length,
    selfServePrototypes: mine.filter((prototype) => prototype.surface === "self_serve").length,
  };
}
