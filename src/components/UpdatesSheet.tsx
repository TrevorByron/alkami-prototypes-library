import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { countChanges, systemUpdates, updateKindLabels, type UpdateKind } from "@/lib/updates";

const kindStyles: Record<UpdateKind, string> = {
  new: "bg-tiaga-0 text-tiaga-9",
  improved: "bg-marine-0 text-marine-8",
  fixed: "bg-desert-0 text-desert-9",
};

const formatDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

// The bell in the site header: a drawer listing what has changed in the
// prototyping system itself (src/lib/updates.ts).
export function UpdatesSheet() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Updates" title="Updates"><Bell /></Button>
      </SheetTrigger>
      <SheetContent className="w-[min(100%,30rem)]">
        <div className="border-b border-carbon-3 px-6 pb-4 pt-6 pr-14">
          <SheetTitle>Updates</SheetTitle>
          <SheetDescription className="mt-1">What’s new in the prototyping system, newest first.</SheetDescription>
        </div>
        <ol className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6">
          {systemUpdates.map((update) => (
            <li key={update.id}>
              <p className="text-xs text-abyss-5">{formatDate(update.date)}</p>
              <h3 className="text-base font-bold text-abyss-9">{update.title}</h3>
              <p className="mt-0.5 text-xs text-abyss-5">{countChanges(update).map(({ kind, count }) => `${count} ${updateKindLabels[kind].toLowerCase()}`).join(" · ")}</p>
              <ul className="mt-2 space-y-2 text-sm text-abyss-7">
                {update.changes.map((change) => (
                  <li key={change.text} className="flex items-start gap-2">
                    <span className={cn("mt-0.5 inline-flex w-[4.75rem] shrink-0 justify-center rounded px-1.5 text-xs font-medium leading-5", kindStyles[change.kind])}>{updateKindLabels[change.kind]}</span>
                    <span>{change.text}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </SheetContent>
    </Sheet>
  );
}
