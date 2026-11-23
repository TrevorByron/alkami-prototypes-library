import { CalendarCheck, CalendarDays, Eye, Flame, Flower2, Gamepad2, Globe, Hourglass, Images, Moon, Package, ScrollText, Search, Smile, Sunrise, Trophy, Monitor, Smartphone, Footprints, GitFork, Handshake, Layers, MessageSquare, MessagesSquare, Reply, Rocket, ScanEye, SquareCheck, Star, Tags, ThumbsUp, Users, type LucideIcon } from "lucide-react";

import { detectPlatform } from "@/lib/platforms";
import type { PrototypeSummary } from "@/lib/types";

// Awards are computed on the fly from data the app already has: nothing is
// stored, so an award can be added, tuned or re-tiered without a migration.
// (Earned dates need a stored awards table; that is a later step.)

export type Tier = "bronze" | "silver" | "gold";
export const tierOrder: Tier[] = ["bronze", "silver", "gold"];
export const tierLabels: Record<Tier, string> = { bronze: "Bronze", silver: "Silver", gold: "Gold" };

export type AwardGroup = "Getting started" | "Builder" | "Surfaces" | "Reviewer" | "Community" | "Habits" | "Secrets";

/** What we know about a member. Everything an award can look at lives here. */
export type MemberStats = {
  prototypes: number;
  /** Distinct prototypes by someone else that this member has opened. */
  othersViewed: number;
  comments: number;
  replies: number;
  /** Replies this member posted under their own comments. */
  selfReplies: number;
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
  /** Distinct days the member opened the library. */
  visitDays: number;
  /** Longest run of consecutive weeks (Mon-Sun) with at least one visit. */
  weekStreak: number;
  /** Comments posted between 10pm and 4am, in the member's local time. */
  lateComments: number;
  /** Comments longer than 600 characters. */
  longComments: number;
  /** Comments made of nothing but emoji. */
  emojiComments: number;
  /** Most category tags on one of this member's prototypes. */
  mostTags: number;
  /** Times this member has set a custom thumbnail, across their prototypes. */
  thumbnailChanges: number;
  /** Whole years since they first signed in. */
  memberYears: number;
  earlyBird: boolean;
  playedRunner: boolean;
  onLeaderboard: boolean;
  foundContributors: boolean;
};

type Metric = { [K in keyof MemberStats]: MemberStats[K] extends number ? K : never }[keyof MemberStats];

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
  { id: "hoarder-of-tags", name: "Hoarder of Tags", group: "Builder", icon: Package, kind: "single", earned: (stats) => stats.mostTags >= 4, describe: "Put 4 category tags on one prototype" },
  { id: "thumbnail-perfectionist", name: "Thumbnail Perfectionist", group: "Builder", icon: Images, kind: "single", earned: (stats) => stats.thumbnailChanges >= 2, describe: "Set a prototype thumbnail twice, because the first one wasn’t quite right" },
  { id: "idea-to-handoff", name: "Idea to Handoff", group: "Builder", icon: Handshake, kind: "single", earned: (stats) => stats.committed > 0, describe: "Tag a prototype Committed" },
  { id: "console-cadet", name: "Console Cadet", group: "Surfaces", icon: Monitor, kind: "tiered", metric: "consolePrototypes", thresholds: [1, 3, 10], describe: (n) => `Create ${plural(n, "Console prototype", "Console prototypes")}` },
  { id: "self-serve-sprinter", name: "Self-Serve Sprinter", group: "Surfaces", icon: Smartphone, kind: "tiered", metric: "selfServePrototypes", thresholds: [1, 3, 10], describe: (n) => `Create ${plural(n, "Self-serve prototype", "Self-serve prototypes")}` },
  { id: "both-worlds", name: "Both Worlds", group: "Surfaces", icon: Globe, kind: "single", earned: (stats) => stats.consolePrototypes > 0 && stats.selfServePrototypes > 0, describe: "Create a Console prototype and a Self-serve prototype" },
  { id: "fresh-eyes", name: "Fresh Eyes", group: "Reviewer", icon: ScanEye, kind: "tiered", metric: "firstComments", thresholds: [1, 3, 10], describe: (n) => `Be the first to comment on ${plural(n, "prototype", "prototypes")}` },
  { id: "war-and-peace", name: "War and Peace", group: "Reviewer", icon: ScrollText, kind: "single", earned: (stats) => stats.longComments > 0, describe: "Leave a comment over 600 characters long" },
  { id: "dont-mince-words", name: "Don’t Mince Words", group: "Reviewer", icon: Smile, kind: "single", earned: (stats) => stats.emojiComments > 0, describe: "Leave a comment that is nothing but emoji" },
  { id: "critics-circle", name: "Critic’s Circle", group: "Reviewer", icon: MessagesSquare, kind: "tiered", metric: "othersCommented", thresholds: [2, 5, 10], describe: (n) => `Comment on ${n} different people’s prototypes` },
  { id: "thumbs-up", name: "Thumbs Up", group: "Reviewer", icon: ThumbsUp, kind: "tiered", metric: "upvotesGiven", thresholds: [1, 10, 50], describe: (n) => `Upvote ${plural(n, "comment", "comments")}` },
  { id: "resolved", name: "Resolved!", group: "Reviewer", icon: SquareCheck, kind: "tiered", metric: "resolved", thresholds: [1, 5, 15], describe: (n) => `Resolve ${plural(n, "comment", "comments")} on your prototypes` },
  { id: "crowd-pleaser", name: "Crowd Pleaser", group: "Community", icon: Users, kind: "tiered", metric: "mostViews", thresholds: [10, 25, 50], describe: (n) => `Get ${n} views on one of your prototypes` },
  { id: "conversation-starter", name: "Conversation Starter", group: "Community", icon: Flame, kind: "tiered", metric: "mostDiscussed", thresholds: [5, 15, 30], describe: (n) => `Get ${n} comments from others on one prototype` },
  { id: "popular-take", name: "Popular Take", group: "Community", icon: Star, kind: "tiered", metric: "topUpvotes", thresholds: [5, 10, 20], describe: (n) => `Get ${n} upvotes on one of your comments` },
  { id: "regular", name: "Regular", group: "Habits", icon: CalendarDays, kind: "tiered", metric: "visitDays", thresholds: [5, 20, 60], describe: (n) => `Visit the library on ${n} different days` },
  { id: "weekly-habit", name: "Weekly Habit", group: "Habits", icon: CalendarCheck, kind: "tiered", metric: "weekStreak", thresholds: [2, 4, 12], describe: (n) => `Visit the library ${n} weeks in a row` },
  { id: "old-timer", name: "Old Timer", group: "Habits", icon: Hourglass, kind: "tiered", metric: "memberYears", thresholds: [1, 2, 3], describe: (n) => `Be a member for ${plural(n, "year", "years")}` },
  { id: "early-bird", name: "Early Bird", group: "Habits", icon: Sunrise, kind: "single", earned: (stats) => stats.earlyBird, describe: "Be among the first 25 members to sign in" },
  { id: "night-owl", name: "Night Owl", group: "Habits", icon: Moon, kind: "tiered", metric: "lateComments", thresholds: [1, 5, 20], describe: (n) => `Post ${plural(n, "comment", "comments")} between 10pm and 4am` },
  { id: "critter-friend", name: "Critter Friend", group: "Secrets", icon: Gamepad2, kind: "single", earned: (stats) => stats.playedRunner, describe: "Play the pixel runner" },
  { id: "high-roller", name: "High Roller", group: "Secrets", icon: Trophy, kind: "single", earned: (stats) => stats.onLeaderboard, describe: "Reach the pixel runner’s top 5" },
  { id: "lure-of-narcissus", name: "The Lure of Narcissus", group: "Secrets", icon: Flower2, kind: "single", earned: (stats) => stats.selfReplies > 0, describe: "Reply to one of your own comments" },
  { id: "detective", name: "Detective", group: "Secrets", icon: Search, kind: "single", earned: (stats) => stats.foundContributors, describe: "Find out who’s been here" },
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

export type CommentFact = { id: string; prototype_id: string; author_id: string; created_at: string; status: "open" | "resolved"; resolved_by: string | null; body: string };
export type UpvoteFact = { comment_id: string; user_id: string };

/** The raw activity that stats are derived from. Comments and upvotes cover every member, since some awards compare against others. */
export type MemberActivity = {
  /** Prototypes this member has opened (any owner). */
  viewedPrototypeIds: string[];
  /** Replies this member has posted. */
  replies: number;
  /** The comment each of those replies was posted under. */
  repliedCommentIds: string[];
  comments: CommentFact[];
  upvotes: UpvoteFact[];
  /** Local dates ("2026-11-12") the member opened the library. */
  visitDays: string[];
  easterEggs: string[];
  /** Their saved pixel runner best; above 0 means they played. */
  runnerBest: number;
  onLeaderboard: boolean;
  earlyBird: boolean;
};

const maxOf = (values: number[]) => values.reduce((top, value) => Math.max(top, value), 0);

const DAY_MS = 24 * 60 * 60 * 1000;

/** Longest run of consecutive Monday-to-Sunday weeks containing a visit. */
function longestWeekStreak(days: string[]) {
  // Day numbers since 1970-01-01 (a Thursday), shifted so weeks start on Monday.
  const weeks = [...new Set(days.map((day) => Math.floor((Date.parse(`${day}T00:00:00Z`) / DAY_MS + 3) / 7)).filter((week) => !Number.isNaN(week)))].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  weeks.forEach((week, index) => {
    run = index > 0 && week === weeks[index - 1] + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

const emojiOnly = /^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\u200d|\ufe0f|\s)+$/u;
const hasEmoji = /\p{Extended_Pictographic}/u;
const isEmojiOnly = (text: string) => emojiOnly.test(text) && hasEmoji.test(text);

const isLateNight = (isoTime: string) => { const hour = new Date(isoTime).getHours(); return hour >= 22 || hour < 4; };

export function computeMemberStats(userId: string | undefined, prototypes: PrototypeSummary[], activity: MemberActivity, joinedAt?: string, now = Date.now()): MemberStats {
  const mine = prototypes.filter((prototype) => prototype.owner_id === userId);
  const ownedIds = new Set(mine.map((prototype) => prototype.id));
  const others = prototypes.filter((prototype) => prototype.owner_id !== userId);
  const tools = new Set(mine.map((prototype) => detectPlatform(prototype.url, prototype.embed_mode)?.id).filter(Boolean));
  const tags = new Set(mine.flatMap((prototype) => prototype.tags));

  const myComments = activity.comments.filter((comment) => comment.author_id === userId);
  const myCommentIds = new Set(myComments.map((comment) => comment.id));
  const commentsOn = (prototypeId: string) => activity.comments.filter((comment) => comment.prototype_id === prototypeId);
  const earliest = (prototypeId: string) => [...commentsOn(prototypeId)].sort((a, b) => a.created_at.localeCompare(b.created_at))[0];

  const upvotesOn = (commentId: string) => activity.upvotes.filter((upvote) => upvote.comment_id === commentId).length;

  return {
    prototypes: mine.length,
    othersViewed: new Set(activity.viewedPrototypeIds.filter((id) => !ownedIds.has(id))).size,
    comments: myComments.length,
    replies: activity.replies,
    selfReplies: activity.repliedCommentIds.filter((id) => myCommentIds.has(id)).length,
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
    visitDays: new Set(activity.visitDays).size,
    weekStreak: longestWeekStreak(activity.visitDays),
    lateComments: myComments.filter((comment) => isLateNight(comment.created_at)).length,
    longComments: myComments.filter((comment) => (comment.body ?? "").trim().length > 600).length,
    emojiComments: myComments.filter((comment) => isEmojiOnly(comment.body ?? "")).length,
    mostTags: maxOf(mine.map((prototype) => prototype.tags.length)),
    thumbnailChanges: mine.reduce((total, prototype) => total + (prototype.thumbnail_changes ?? 0), 0),
    memberYears: joinedAt && !Number.isNaN(Date.parse(joinedAt)) ? Math.max(0, Math.floor((now - Date.parse(joinedAt)) / (365.25 * DAY_MS))) : 0,
    earlyBird: activity.earlyBird,
    playedRunner: activity.runnerBest > 0,
    onLeaderboard: activity.onLeaderboard,
    foundContributors: activity.easterEggs.includes("contributors"),
  };
}
