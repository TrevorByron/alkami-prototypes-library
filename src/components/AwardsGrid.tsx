import { Lock } from "lucide-react";

import { type AwardGroup, type AwardStatus, type Tier, tierLabels } from "@/lib/awards";
import { cn } from "@/lib/utils";

// Tier colours reuse the Console palettes: chaparral reads as bronze, carbon as
// silver, desert as gold. Classes are written out in full so Tailwind sees them.
const tierStyles: Record<Tier | "earned", { tile: string; chip: string }> = {
  bronze: { tile: "bg-chaparral-0 text-chaparral-8 border-chaparral-3", chip: "bg-chaparral-0 text-chaparral-8" },
  silver: { tile: "bg-carbon-2 text-abyss-7 border-carbon-4", chip: "bg-carbon-2 text-abyss-7" },
  gold: { tile: "bg-desert-0 text-desert-8 border-desert-3", chip: "bg-desert-0 text-desert-8" },
  earned: { tile: "bg-tiaga-0 text-tiaga-8 border-tiaga-3", chip: "bg-tiaga-0 text-tiaga-8" },
};

const groupOrder: AwardGroup[] = ["Getting started", "Builder"];

export function AwardsGrid({ statuses }: { statuses: AwardStatus[] }) {
  const earned = statuses.filter((status) => status.tier).length;

  return (
    <section aria-labelledby="profile-awards">
      <h3 id="profile-awards" className="mb-3 text-base font-bold leading-5 text-abyss-9">Awards ({earned} of {statuses.length})</h3>
      <div className="space-y-5">
        {groupOrder.map((group) => (
          <div key={group}>
            <p className="mb-2 text-xs text-abyss-5">{group}</p>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {statuses.filter((status) => status.award.group === group).map((status) => <AwardCard key={status.award.id} status={status} />)}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function AwardCard({ status }: { status: AwardStatus }) {
  const { award, tier, count, next, hint } = status;
  const Icon = award.icon;
  const style = tier ? tierStyles[tier] : null;
  const done = tier && !next;
  const state = !tier ? "Locked" : tier === "earned" ? "Earned" : tierLabels[tier];

  return (
    <li className={cn("flex items-start gap-3 rounded-lg border-2 border-carbon-2 p-3", !tier && "bg-carbon-0")} aria-label={`${award.name}: ${state}. ${hint}`}>
      <span className={cn("pixel-notch flex h-10 w-10 shrink-0 items-center justify-center border-2", style ? style.tile : "border-carbon-2 bg-carbon-1 text-abyss-4")}>
        {tier ? <Icon className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={cn("truncate text-sm font-medium", tier ? "text-abyss-9" : "text-abyss-5")}>{award.name}</p>
          <span className={cn("shrink-0 rounded px-1.5 text-[11px] leading-4", style ? style.chip : "bg-carbon-1 text-abyss-5")}>{state}</span>
        </div>
        <p className="text-xs text-abyss-5">{done && tier !== "earned" ? `${hint} ✓` : hint}</p>
        {count !== null && next ? <p className="text-xs text-abyss-7">{count} / {next}</p> : null}
      </div>
    </li>
  );
}
