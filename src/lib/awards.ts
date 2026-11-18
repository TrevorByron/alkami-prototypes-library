import { Eye, Footprints, GitFork, Handshake, Layers, MessageSquare, Reply, Rocket, Tags, type LucideIcon } from "lucide-react";

import { detectPlatform } from "@/lib/platforms";
import type { PrototypeSummary } from "@/lib/types";

// Awards are computed on the fly from data the app already has: nothing is
// stored, so an award can be added, tuned or re-tiered without a migration.
// (Earned dates need a stored awards table; that is a later step.)

export type Tier = "bronze" | "silver" | "gold";
export const tierOrder: Tier[] = ["bronze", "silver", "gold"];
export const tierLabels: Record<Tier, string> = { bronze: "Bronze", silver: "Silver", gold: "Gold" };

export type AwardGroup = "Getting started" | "Builder";

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

/** The raw activity that stats are derived from. */
export type MemberActivity = {
  /** Prototypes this member has opened (any owner). */
  viewedPrototypeIds: string[];
  comments: number;
  replies: number;
};

export function computeMemberStats(userId: string | undefined, prototypes: PrototypeSummary[], activity: MemberActivity): MemberStats {
  const mine = prototypes.filter((prototype) => prototype.owner_id === userId);
  const ownedIds = new Set(mine.map((prototype) => prototype.id));
  const tools = new Set(mine.map((prototype) => detectPlatform(prototype.url, prototype.embed_mode)?.id).filter(Boolean));
  const tags = new Set(mine.flatMap((prototype) => prototype.tags));
  return {
    prototypes: mine.length,
    othersViewed: new Set(activity.viewedPrototypeIds.filter((id) => !ownedIds.has(id))).size,
    comments: activity.comments,
    replies: activity.replies,
    tools: tools.size,
    tags: tags.size,
    remixes: mine.filter((prototype) => Boolean(prototype.source_meta?.based_on)).length,
    committed: mine.filter((prototype) => prototype.tags.includes("committed")).length,
  };
}
