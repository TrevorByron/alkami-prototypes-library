import type { PrototypeSurfaceId } from "@/lib/surfaces";
import type { CommentAuthor, CommentRecord, PrototypeSummary, ReplyRecord, SlackChannel, SlackDirectory, SlackUser, Viewport } from "@/lib/types";

const prototypesKey = "commentor:demo:prototypes";
const commentsKey = "commentor:demo:comments";
const repliesKey = "commentor:demo:replies";
const upvotesKey = "commentor:demo:upvotes";
const viewsKey = "commentor:demo:views";
const githubKey = "commentor:demo:github";

export type GithubIdentity = { profile_id: string; login: string; linked: boolean };

type DemoUpvote = { comment_id: string; user_id: string };

export const demoProfile: CommentAuthor & { slack_user_id: string; team_id: string; auth_provider: "email"; email: string } = {
  id: "demo-user",
  slack_user_id: "demo-user",
  name: "David B.",
  avatar_url: null,
  team_id: "demo-team",
  auth_provider: "email",
  email: "demo@example.test",
};

export const demoDirectory: SlackDirectory = {
  users: [
    { id: "demo-owner", name: "Demo owner", avatar_url: null },
    { id: "demo-reviewer", name: "Demo reviewer", avatar_url: null },
  ],
  channels: [
    { id: "demo-channel", name: "prototype-review", is_private: false },
    { id: "demo-private-channel", name: "demo-private", is_private: true },
  ],
};

function read<T>(key: string): T[] {
  try { return JSON.parse(window.localStorage.getItem(key) ?? "[]") as T[]; } catch { return []; }
}

function write<T>(key: string, value: T[]) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function now() { return new Date().toISOString(); }

export function listDemoPrototypes() {
  const comments = read<CommentRecord>(commentsKey);
  const views = read<{ prototype_id: string; viewer_id: string }>(viewsKey);
  const linked = new Set(read<GithubIdentity>(githubKey).filter((identity) => identity.linked).map((identity) => identity.login));
  return read<PrototypeSummary>(prototypesKey).map((prototype) => ({
    ...prototype,
    // Same as the apply_github_owner trigger: a linked author's MANTL prototypes are theirs.
    ...(prototype.source === "mantl" && linked.has((prototype.source_meta?.author ?? "").toLowerCase()) ? { owner_id: demoProfile.id, owner_name: demoProfile.name } : {}),
    tags: prototype.tags ?? [],
    open_comment_count: countOpenComments(prototype.id),
    comment_times: comments.filter((comment) => comment.prototype_id === prototype.id).map((comment) => comment.created_at),
    view_count: views.filter((view) => view.prototype_id === prototype.id).length,
  }));
}

export function listDemoGithubIdentities() { return read<GithubIdentity>(githubKey); }

export function decideDemoGithubLogin(login: string, linked: boolean) {
  const normalized = login.toLowerCase();
  write(githubKey, [...read<GithubIdentity>(githubKey).filter((identity) => identity.login !== normalized), { profile_id: demoProfile.id, login: normalized, linked }]);
}

export function recordDemoView(prototypeId: string) {
  const views = read<{ prototype_id: string; viewer_id: string }>(viewsKey);
  if (views.some((view) => view.prototype_id === prototypeId && view.viewer_id === demoProfile.id)) return;
  write(viewsKey, [...views, { prototype_id: prototypeId, viewer_id: demoProfile.id }]);
}

export function getDemoPrototype(id: string) {
  return listDemoPrototypes().find((prototype) => prototype.id === id) ?? null;
}

export function createDemoPrototype(input: { name: string; url: string; description: string | null; owner_id: string; owner_slack_id: string | null; owner_name: string; slack_channel_id: string | null; slack_channel_name: string | null; embed_mode: "live" | "new_tab"; embed_reason: string; favicon_url: string | null; tags: string[]; surface?: PrototypeSurfaceId | null; }) {
  const timestamp = now();
  const prototype: PrototypeSummary = { id: crypto.randomUUID(), ...input, source: "manual", source_key: null, source_meta: null, archived_at: null, thumbnail_url: null, created_by: demoProfile.id, created_at: timestamp, updated_at: timestamp, open_comment_count: 0 };
  write(prototypesKey, [...read<PrototypeSummary>(prototypesKey), prototype]);
  return prototype;
}

export function updateDemoPrototypeTags(id: string, tags: string[]) {
  write(prototypesKey, read<PrototypeSummary>(prototypesKey).map((prototype) => prototype.id === id ? { ...prototype, tags, updated_at: now() } : prototype));
}

export function updateDemoPrototype(id: string, fields: Partial<PrototypeSummary>) {
  write(prototypesKey, read<PrototypeSummary>(prototypesKey).map((prototype) => prototype.id === id ? { ...prototype, ...fields, updated_at: now() } : prototype));
}

export function deleteDemoPrototype(id: string) {
  write(prototypesKey, read<PrototypeSummary>(prototypesKey).filter((prototype) => prototype.id !== id));
  const commentIds = new Set(read<CommentRecord>(commentsKey).filter((comment) => comment.prototype_id === id).map((comment) => comment.id));
  write(commentsKey, read<CommentRecord>(commentsKey).filter((comment) => comment.prototype_id !== id));
  write(repliesKey, read<ReplyRecord>(repliesKey).filter((reply) => !commentIds.has(reply.comment_id)));
}

function countOpenComments(prototypeId: string) {
  return read<CommentRecord>(commentsKey).filter((comment) => comment.prototype_id === prototypeId && comment.status === "open").length;
}

function author(): CommentAuthor { return demoProfile; }

export function listDemoComments(prototypeId: string) {
  const replies = read<ReplyRecord>(repliesKey);
  const upvotes = read<DemoUpvote>(upvotesKey);
  const prototypeUrl = getDemoPrototype(prototypeId)?.url ?? null;
  return read<CommentRecord>(commentsKey).filter((comment) => comment.prototype_id === prototypeId).map((comment) => ({ ...comment, page_url: "page_url" in comment ? comment.page_url : prototypeUrl, author: author(), replies: replies.filter((reply) => reply.comment_id === comment.id).map((reply) => ({ ...reply, author: author() })), upvoters: upvotes.filter((upvote) => upvote.comment_id === comment.id).map((upvote) => upvote.user_id) }));
}

export function addDemoComment(input: { prototype_id: string; body: string; page_url: string | null; screen_label: string | null; viewport: Viewport | null; x_pct: number | null; y_pct: number | null; selector: string | null; scroll_y: number | null; snapshot_url: string | null; }) {
  const comment: CommentRecord = { id: crypto.randomUUID(), ...input, author_id: demoProfile.id, status: "open", slack_ts: null, resolved_by: null, resolved_at: null, resolution_note: null, created_at: now(), author: author(), replies: [], upvoters: [] };
  write(commentsKey, [...read<CommentRecord>(commentsKey), comment]);
  return comment;
}

export function addDemoReply(input: { comment_id: string; body: string }) {
  const reply: ReplyRecord = { id: crypto.randomUUID(), comment_id: input.comment_id, author_id: demoProfile.id, body: input.body, slack_ts: null, created_at: now(), author: author() };
  write(repliesKey, [...read<ReplyRecord>(repliesKey), reply]);
  return reply;
}

export function updateDemoComment(id: string, values: { status: "open" | "resolved"; resolved_by: string | null; resolved_at: string | null; resolution_note: string | null; }) {
  const next = read<CommentRecord>(commentsKey).map((comment) => comment.id === id ? { ...comment, ...values } : comment);
  write(commentsKey, next);
}

export function updateDemoCommentBody(id: string, body: string) {
  write(commentsKey, read<CommentRecord>(commentsKey).map((comment) => (comment.id === id ? { ...comment, body } : comment)));
}

export function toggleDemoUpvote(commentId: string) {
  const upvotes = read<DemoUpvote>(upvotesKey);
  const mine = (upvote: DemoUpvote) => upvote.comment_id === commentId && upvote.user_id === demoProfile.id;
  write(upvotesKey, upvotes.some(mine) ? upvotes.filter((upvote) => !mine(upvote)) : [...upvotes, { comment_id: commentId, user_id: demoProfile.id }]);
}

export function clearDemoData() {
  [prototypesKey, commentsKey, repliesKey, upvotesKey].forEach((key) => window.localStorage.removeItem(key));
}

export function isDemoUser(userId: string) { return userId === demoProfile.id; }

export function demoSlackUser(id: string): SlackUser | undefined { return demoDirectory.users.find((user) => user.id === id); }
export function demoSlackChannel(id: string): SlackChannel | undefined { return demoDirectory.channels.find((channel) => channel.id === id); }

/** What the awards look at: the demo member's views, comments and replies. */
export function getDemoMemberActivity() {
  return {
    viewedPrototypeIds: read<{ prototype_id: string; viewer_id: string }>(viewsKey).filter((view) => view.viewer_id === demoProfile.id).map((view) => view.prototype_id),
    replies: read<ReplyRecord>(repliesKey).filter((reply) => reply.author_id === demoProfile.id).length,
    comments: read<CommentRecord>(commentsKey).map(({ id, prototype_id, author_id, created_at, status, resolved_by }) => ({ id, prototype_id, author_id, created_at, status, resolved_by })),
    upvotes: read<DemoUpvote>(upvotesKey),
    ...readDemoExtras(),
  };
}

// Placeholder data so the awards have something to show in local demo mode:
// a member who has built across three tools, browsed and commented on other
// people's work, never replied and never tagged anything Committed, so some
// awards are earned at different tiers and some are still locked. Written once
// per browser (bump the version to reseed); never runs outside demo mode.
const seedKey = "commentor:demo:seed:v5";

export function seedDemoProfile() {
  if (window.localStorage.getItem(seedKey)) return;
  const day = (daysAgo: number) => new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  const base = { description: null, owner_slack_id: null, slack_channel_id: null, slack_channel_name: null, embed_reason: "Placeholder data", favicon_url: null, archived_at: null, thumbnail_url: null, open_comment_count: 0 };
  const proto = (id: string, name: string, url: string, owner: "demo-user" | "demo-owner", tags: string[], daysAgo: number, extra: Partial<PrototypeSummary> = {}): PrototypeSummary => ({
    ...base, id, name, url, tags, owner_id: owner === "demo-user" ? demoProfile.id : "demo-owner", owner_name: owner === "demo-user" ? demoProfile.name : "Demo owner",
    embed_mode: "new_tab", source: "manual", source_key: null, source_meta: null, created_by: owner === "demo-user" ? demoProfile.id : "demo-owner", created_at: day(daysAgo), updated_at: day(daysAgo), ...extra,
  });

  const prototypes: PrototypeSummary[] = [
    proto("seed-mine-1", "Cross-sells setup", "https://example.pages.github.io/cross-sells-setup/", "demo-user", ["working"], 22, { surface: "console", source: "mantl", source_key: "proto/cross-sells-setup", source_meta: { name: "cross-sells-setup", based_on: null } }),
    proto("seed-mine-2", "AI document processing", "https://example.pages.github.io/ai-document-processing/", "demo-user", ["review", "exploratory"], 40, { surface: "console", source: "mantl", source_key: "proto/ai-document-processing", source_meta: { name: "ai-document-processing", based_on: "Document intake" } }),
    proto("seed-mine-3", "Onboarding flow", "https://claude.ai/public/artifacts/placeholder-onboarding", "demo-user", ["concept"], 120, {}),
    proto("seed-mine-4", "Rate calculator", "https://rate-calculator.replit.app", "demo-user", ["tool"], 210, { surface: "console" }),
    proto("seed-mine-5", "Pixel pong", "https://pixel-pong.replit.app", "demo-user", ["fun"], 300, {}),
    proto("seed-other-1", "Member dashboard", "https://claude.ai/public/artifacts/placeholder-dashboard", "demo-owner", ["working"], 30),
    proto("seed-other-2", "Loan application", "https://example.pages.github.io/loan-application/", "demo-owner", ["review"], 18, { source: "mantl", source_key: "proto/loan-application" }),
    proto("seed-other-3", "Branch finder", "https://branch-finder.replit.app", "demo-owner", ["concept"], 9),
    proto("seed-other-4", "Card controls", "https://claude.ai/public/artifacts/placeholder-card-controls", "demo-owner", ["exploratory"], 4),
  ];

  const commentOn = (prototypeId: string, index: number, daysAgo: number): CommentRecord => ({
    id: `seed-comment-${prototypeId}-${index}`, prototype_id: prototypeId, author_id: demoProfile.id, body: ["Love the layout.", "Could the totals sit higher?", "This flow feels clear.", "What happens when it fails?"][index % 4],
    page_url: null, status: "open", screen_label: null, viewport: null, x_pct: null, y_pct: null, selector: null, scroll_y: null, snapshot_url: null, slack_ts: null, resolved_by: null, resolved_at: null, resolution_note: null, created_at: day(daysAgo), replies: [], upvoters: [],
  });
  // Comments from other members, so the community awards have something to count.
  const fromOthers = (prototypeId: string, index: number, daysAgo: number, resolved = false): CommentRecord => ({
    ...commentOn(prototypeId, index, daysAgo), id: `seed-theirs-${prototypeId}-${index}`, author_id: "demo-owner", author: { id: "demo-owner", name: "Demo owner", avatar_url: null },
    status: resolved ? "resolved" : "open", resolved_by: resolved ? demoProfile.id : null, resolved_at: resolved ? day(daysAgo - 1) : null,
  });
  const comments = [
    commentOn("seed-other-1", 0, 28), commentOn("seed-other-1", 1, 27), commentOn("seed-other-2", 2, 16), commentOn("seed-other-2", 3, 15), commentOn("seed-other-3", 0, 7),
    commentOn("seed-mine-1", 1, 20), commentOn("seed-mine-3", 2, 100),
    // Someone got to this one before the member did, so it is not a "first comment".
    fromOthers("seed-other-2", 1, 17),
    ...[0, 1, 2, 3, 4, 5].map((index) => fromOthers("seed-mine-1", index, 21 - index, index < 2)),
  ];

  // Twelve other members have opened "AI document processing".
  const views = [
    ...["seed-other-1", "seed-other-2", "seed-other-3"].map((prototype_id) => ({ prototype_id, viewer_id: demoProfile.id })),
    ...Array.from({ length: 12 }, (_, index) => ({ prototype_id: "seed-mine-2", viewer_id: `seed-viewer-${index}` })),
  ];

  // The member upvoted two comments, and three people upvoted one of theirs.
  const upvotes = [
    { comment_id: "seed-theirs-seed-mine-1-0", user_id: demoProfile.id },
    { comment_id: "seed-theirs-seed-mine-1-1", user_id: demoProfile.id },
    ...["a", "b", "c"].map((user_id) => ({ comment_id: "seed-comment-seed-other-1-0", user_id })),
  ];

  // Two of the member's comments were posted late at night.
  const lateNight = (comment: CommentRecord, hour: number): CommentRecord => { const when = new Date(comment.created_at); when.setHours(hour, 15, 0, 0); return { ...comment, created_at: when.toISOString() }; };
  comments[0] = lateNight(comments[0], 23);
  comments[1] = lateNight(comments[1], 1);

  // Visits: three weeks in a row plus some extra days; played the runner but
  // not on the board; an early member; hasn't opened the Contributors card.
  const visitDays = [0, 7, 14, 2, 3, 9, 10, 21, 30, 31, 45, 46, 47].map((daysAgo) => { const when = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000); return `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, "0")}-${String(when.getDate()).padStart(2, "0")}`; });
  window.localStorage.setItem(extrasKey, JSON.stringify({ visitDays, easterEggs: [], runnerBest: 1420, onLeaderboard: false, earlyBird: true }));

  write(prototypesKey, prototypes);
  write(commentsKey, comments);
  write(repliesKey, []);
  write(upvotesKey, upvotes);
  write(viewsKey, views);
  window.localStorage.setItem(seedKey, "1");
}

// Demo-mode stand-ins for the member_visits table and profile flags.
const extrasKey = "commentor:demo:extras";
type DemoExtras = { visitDays: string[]; easterEggs: string[]; runnerBest: number; onLeaderboard: boolean; earlyBird: boolean };

export function readDemoExtras(): DemoExtras {
  try { return { visitDays: [], easterEggs: [], runnerBest: 0, onLeaderboard: false, earlyBird: false, ...JSON.parse(window.localStorage.getItem(extrasKey) ?? "{}") }; } catch { return { visitDays: [], easterEggs: [], runnerBest: 0, onLeaderboard: false, earlyBird: false }; }
}

function writeDemoExtras(extras: DemoExtras) { window.localStorage.setItem(extrasKey, JSON.stringify(extras)); }

export function recordDemoVisit(day: string) {
  const extras = readDemoExtras();
  if (!extras.visitDays.includes(day)) writeDemoExtras({ ...extras, visitDays: [...extras.visitDays, day] });
}

export function recordDemoEasterEgg(egg: string) {
  const extras = readDemoExtras();
  if (!extras.easterEggs.includes(egg)) writeDemoExtras({ ...extras, easterEggs: [...extras.easterEggs, egg] });
}
