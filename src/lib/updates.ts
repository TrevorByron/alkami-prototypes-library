// What has changed in the prototyping system itself, newest first, shown in the
// Updates drawer. One entry per merge. Add an entry in the same pull request as
// the change, in plain words for the people using the library (not developer
// notes). The counts in each entry's header are worked out from its changes.

export type UpdateKind = "new" | "improved" | "fixed";
export const updateKindLabels: Record<UpdateKind, string> = { new: "New", improved: "Improved", fixed: "Fixed" };
export const updateKindOrder: UpdateKind[] = ["new", "improved", "fixed"];

export type SystemUpdate = {
  id: string;
  /** "2026-11-23" */
  date: string;
  title: string;
  changes: { kind: UpdateKind; text: string }[];
};

export const systemUpdates: SystemUpdate[] = [
  {
    id: "2026-11-23-narcissus",
    date: "2026-11-23",
    title: "A new secret award",
    changes: [
      { kind: "new", text: "The Lure of Narcissus: reply to one of your own comments." },
    ],
  },
  {
    id: "2026-11-23-start-page",
    date: "2026-11-23",
    title: "Start page for each prototype",
    changes: [
      { kind: "new", text: "Owners can set the page a prototype opens on, from Edit details. Paste an address or a path, and Test it before saving." },
      { kind: "improved", text: "Open, New tab and the in-app viewer take people straight to that page instead of the main link." },
    ],
  },
  {
    id: "2026-11-23-more-awards",
    date: "2026-11-23",
    title: "Four new awards",
    changes: [
      { kind: "new", text: "Hoarder of Tags: put 4 category tags on one prototype." },
      { kind: "new", text: "Thumbnail Perfectionist: set a prototype’s thumbnail twice." },
      { kind: "new", text: "War and Peace: leave a comment over 600 characters." },
      { kind: "new", text: "Don’t Mince Words: leave a comment that is nothing but emoji." },
    ],
  },
  {
    id: "2026-11-19-thumbnails",
    date: "2026-11-19",
    title: "Custom thumbnails and Edit links",
    changes: [
      { kind: "new", text: "Owners can upload their own thumbnail and frame it with a 16:9 crop, zoom and fit." },
      { kind: "new", text: "An Edit link on your prototypes in your profile, and a pencil on their cards in the library." },
      { kind: "improved", text: "A custom thumbnail stays put when the prototype is shared again from Prototyping in MANTL." },
    ],
  },
  {
    id: "2026-11-19-github",
    date: "2026-11-19",
    title: "GitHub sign-in matching and share dates",
    changes: [
      { kind: "new", text: "“Is this you?” prompt links your GitHub login to your Alkami sign-in, so your MANTL prototypes are recognised as yours." },
      { kind: "improved", text: "MANTL cards show when the prototype was last shared." },
      { kind: "fixed", text: "Company GitHub logins now match their owner correctly." },
    ],
  },
  {
    id: "2026-11-18-profile",
    date: "2026-11-18",
    title: "Profiles and awards",
    changes: [
      { kind: "new", text: "A profile with your prototypes, how long you’ve been a member and your activity." },
      { kind: "new", text: "27 awards to earn, from first steps to secrets, with bronze, silver and gold levels." },
      { kind: "new", text: "Mark a prototype as Console or Self-serve." },
    ],
  },
];

export function countChanges(update: SystemUpdate) {
  return updateKindOrder
    .map((kind) => ({ kind, count: update.changes.filter((change) => change.kind === kind).length }))
    .filter((entry) => entry.count > 0);
}
