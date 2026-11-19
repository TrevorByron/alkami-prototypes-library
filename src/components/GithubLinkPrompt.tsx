import { useEffect, useMemo, useState } from "react";
import { Github, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InfoBanner } from "@/components/ui/info-banner";
import { isDemoMode } from "@/lib/demoMode";
import { decideDemoGithubLogin, type GithubIdentity, listDemoGithubIdentities } from "@/lib/demoStore";
import { bestGithubMatch, isPersonLogin } from "@/lib/githubMatch";
import { displayName } from "@/lib/names";
import { supabase } from "@/lib/supabase";
import type { PrototypeSummary } from "@/lib/types";

// Closing the prompt without answering puts it off until the next visit.
const laterKey = "alkami-prototypes:github-link-later";

function askedLater() {
  try { return JSON.parse(window.sessionStorage.getItem(laterKey) ?? "[]") as string[]; } catch { return []; }
}

function rememberLater(login: string) {
  try { window.sessionStorage.setItem(laterKey, JSON.stringify([...askedLater(), login.toLowerCase()])); } catch { /* private window: it just asks again */ }
}

// Prototypes shared from Prototyping in MANTL only carry the GitHub login that
// shared them. When one looks like the signed-in member's name ("Trevor
// Borden" and TrevorByron), ask "Is this you?" once. Yes links the login to
// them (link_github_login), so those prototypes and every later share are
// theirs: their name on the card, in Mine, and theirs to edit. No is
// remembered and never asked again.
export function GithubLinkPrompt({ prototypes, onLinked }: { prototypes: PrototypeSummary[]; onLinked: () => void }) {
  const { user, profile } = useAuth();
  const [identities, setIdentities] = useState<GithubIdentity[] | null>(null);
  const [dismissed, setDismissed] = useState<string[]>(askedLater);
  const [saving, setSaving] = useState<"yes" | "no" | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      if (isDemoMode) { setIdentities(listDemoGithubIdentities()); return; }
      if (!supabase || !user) return;
      const { data, error } = await supabase.from("github_identities").select("profile_id, login, linked");
      // Until the github_identities migration is applied this errors and the prompt never shows.
      if (active && !error) setIdentities((data ?? []) as GithubIdentity[]);
    }
    void load();
    return () => { active = false; };
  }, [user]);

  const login = useMemo(() => {
    if (!identities || !user || !profile) return null;
    // Logins someone has already claimed, or this member has answered.
    const settled = new Set(identities.filter((identity) => identity.linked || identity.profile_id === user.id).map((identity) => identity.login));
    const authors = new Map<string, string>();
    for (const prototype of prototypes) {
      const author = prototype.source === "mantl" ? prototype.source_meta?.author ?? "" : "";
      const key = author.toLowerCase();
      if (isPersonLogin(author) && !settled.has(key) && !dismissed.includes(key)) authors.set(key, author);
    }
    // The name they signed in with, or their email's "trevor.borden".
    return bestGithubMatch([...authors.values()], profile.name || profile.email || user.email || "");
  }, [dismissed, identities, profile, prototypes, user]);

  if (!login || !user) return null;
  const count = prototypes.filter((prototype) => prototype.source === "mantl" && prototype.source_meta?.author?.toLowerCase() === login.toLowerCase()).length;
  const sample = prototypes.find((prototype) => prototype.source === "mantl" && prototype.source_meta?.author?.toLowerCase() === login.toLowerCase());

  async function answer(linked: boolean) {
    if (!login || !user) return;
    setSaving(linked ? "yes" : "no");
    setFormError(null);
    const key = login.toLowerCase();
    let error: string | null = null;
    if (isDemoMode) {
      decideDemoGithubLogin(key, linked);
    } else if (!supabase) {
      error = "Supabase is not configured.";
    } else {
      const result = linked
        ? await supabase.rpc("link_github_login", { github_login: key })
        : await supabase.from("github_identities").insert({ profile_id: user.id, login: key, linked: false });
      error = result.error?.message ?? null;
    }
    setSaving(null);
    if (error) { setFormError(error); return; }
    setIdentities((current) => [...(current ?? []), { profile_id: user.id, login: key, linked }]);
    if (linked) {
      toast.success(`Linked. ${login}’s prototypes are now yours.`);
      onLinked();
    }
  }

  function later(open: boolean) {
    if (open || !login || saving) return;
    rememberLater(login);
    setDismissed((current) => [...current, login.toLowerCase()]);
  }

  return (
    <Dialog open onOpenChange={later}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Is this you?</DialogTitle>
          <DialogDescription>
            {count === 1 ? "A prototype" : `${count} prototypes`} in Prototyping in MANTL {count === 1 ? "was" : "were"} shared by a GitHub account that looks like yours.
          </DialogDescription>
        </DialogHeader>
        <a href={`https://github.com/${encodeURIComponent(login)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg border-2 border-carbon-2 bg-carbon-0 px-4 py-3 hover:border-marine-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-marine-2">
          <img src={`https://github.com/${encodeURIComponent(login)}.png?size=80`} alt="" className="pixel-notch h-10 w-10 shrink-0 bg-carbon-2" onError={(event) => { event.currentTarget.style.visibility = "hidden"; }} />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate text-base font-medium text-abyss-9"><Github className="h-4 w-4 shrink-0 text-abyss-5" />{login}</p>
            <p className="truncate text-xs text-abyss-5">{sample ? `Shared ${sample.name}${count > 1 ? ` and ${count - 1} more` : ""}` : "GitHub"}</p>
          </div>
        </a>
        <p className="text-sm text-abyss-7">If it’s you, {displayName(profile?.name ?? "")}, its prototypes will show your name and appear under Mine, and anything it shares later will too.</p>
        {formError ? <InfoBanner type="danger">{formError}</InfoBanner> : null}
        <DialogFooter>
          <Button type="button" variant="secondary" size="lg" disabled={Boolean(saving)} onClick={() => void answer(false)}>{saving === "no" ? <Loader2 className="animate-spin" /> : null}No, that’s not me</Button>
          <Button type="button" size="lg" disabled={Boolean(saving)} onClick={() => void answer(true)}>{saving === "yes" ? <Loader2 className="animate-spin" /> : null}Yes, that’s me</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
