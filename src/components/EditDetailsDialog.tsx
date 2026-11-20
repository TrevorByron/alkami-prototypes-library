import { useEffect, useState, type FormEvent } from "react";
import { ExternalLink, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InfoBanner } from "@/components/ui/info-banner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectionPill } from "@/components/ui/selection-pill";
import { Textarea } from "@/components/ui/textarea";
import { useCommentThreads } from "@/hooks/useCommentThreads";
import { prototypesChangedEvent } from "@/hooks/usePrototypes";
import { isDemoMode } from "@/lib/demoMode";
import { findDescriptionComment } from "@/lib/descriptionComment";
import { addDemoComment, updateDemoCommentBody, updateDemoPrototype } from "@/lib/demoStore";
import { launchUrl, parseStartPath } from "@/lib/startPath";
import { supabase } from "@/lib/supabase";
import { prototypeSurfaces, type PrototypeSurfaceId } from "@/lib/surfaces";
import { ThumbnailCropper } from "@/components/ThumbnailCropper";
import { blobToDataUrl, deleteCustomThumbnail, initialFraming, loadThumbnailSource, renderThumbnail, thumbnailOf, uploadCustomThumbnail, type Framing } from "@/lib/thumbnails";
import type { CommentRecord, PrototypeSummary } from "@/lib/types";

// Changes a prototype's name and description. The description is also the
// builder's pinned first comment (descriptionComment.ts), so that comment is
// kept in step: edited when it exists, posted when the builder adds a first
// description.
export function EditDetailsDialog({ prototype, descriptionComment, open, onOpenChange, onSaved }: { prototype: PrototypeSummary; descriptionComment: CommentRecord | null; open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [name, setName] = useState(prototype.name);
  const [description, setDescription] = useState(prototype.description ?? "");
  const [surface, setSurface] = useState<PrototypeSurfaceId | null>(prototype.surface ?? null);
  // A picture picked and being framed but not saved yet, and whether to clear the custom one.
  const [pickedThumbnail, setPickedThumbnail] = useState<{ bitmap: ImageBitmap; framing: Framing } | null>(null);
  const [removeThumbnail, setRemoveThumbnail] = useState(false);
  const [startPath, setStartPath] = useState(prototype.start_path ?? "");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const isBuilder = Boolean(user && (user.id === prototype.owner_id || user.id === prototype.created_by));

  useEffect(() => {
    if (!open) return;
    setName(prototype.name);
    setDescription(prototype.description ?? "");
    setSurface(prototype.surface ?? null);
    setPickedThumbnail((current) => { current?.bitmap.close(); return null; });
    setRemoveThumbnail(false);
    setStartPath(prototype.start_path ?? "");
    setFormError(null);
  }, [open, prototype.name, prototype.description, prototype.surface, prototype.start_path]);

  // What was typed, checked against the prototype's link, and where it would open.
  const parsedStart = parseStartPath(startPath, prototype.url);
  const startPreview = parsedStart.path !== undefined ? launchUrl({ url: prototype.url, start_path: parsedStart.path }) : null;

  // What the thumbnail will be after saving, for the preview.
  const hasCustomThumbnail = Boolean(prototype.custom_thumbnail_url) && !removeThumbnail || Boolean(pickedThumbnail);
  const thumbnailPreview = removeThumbnail ? prototype.thumbnail_url : thumbnailOf(prototype);

  async function pickThumbnail(file: File | undefined) {
    if (!file) return;
    setFormError(null);
    try {
      const bitmap = await loadThumbnailSource(file);
      setPickedThumbnail((current) => { current?.bitmap.close(); return { bitmap, framing: initialFraming }; });
      setRemoveThumbnail(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "That image could not be used.");
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) { setFormError("Give the prototype a name."); return; }
    if (isBuilder && parsedStart.error) { setFormError(parsedStart.error); return; }
    const nextDescription = description.trim() || null;
    setSaving(true); setFormError(null);
    // The surface is only sent when it changed, so other edits keep working before the surface migration is applied.
    const fields: Partial<PrototypeSummary> = { name: name.trim(), description: nextDescription, ...(surface !== (prototype.surface ?? null) ? { surface } : {}) };
    let commentWarning: string | null = null;
    const previousThumbnail = prototype.custom_thumbnail_url ?? null;
    // Like the thumbnail, only sent when it changed, so the owner-only rule isn't tripped by other edits.
    if (isBuilder && parsedStart.path !== undefined && parsedStart.path !== (prototype.start_path ?? null)) fields.start_path = parsedStart.path;

    // The thumbnail column is only sent when it changed, like surface above.
    try {
      if (isBuilder && pickedThumbnail) {
        const blob = await renderThumbnail(pickedThumbnail.bitmap, pickedThumbnail.framing);
        fields.custom_thumbnail_url = isDemoMode ? await blobToDataUrl(blob) : await uploadCustomThumbnail(prototype.id, blob);
      }
      else if (isBuilder && removeThumbnail && previousThumbnail) fields.custom_thumbnail_url = null;
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "The thumbnail could not be uploaded.");
      setSaving(false);
      return;
    }

    if (isDemoMode) {
      updateDemoPrototype(prototype.id, fields);
      if (nextDescription && descriptionComment) updateDemoCommentBody(descriptionComment.id, nextDescription);
      else if (nextDescription && isBuilder) addDemoComment({ prototype_id: prototype.id, body: nextDescription, page_url: null, screen_label: null, viewport: null, x_pct: null, y_pct: null, selector: null, scroll_y: null, snapshot_url: null });
    } else {
      if (!supabase || !user) { setSaving(false); return; }
      const { error } = await supabase.from("prototypes").update(fields).eq("id", prototype.id);
      if (error) { setFormError(error.message); setSaving(false); if (fields.custom_thumbnail_url) void deleteCustomThumbnail(fields.custom_thumbnail_url); return; }
      if ("custom_thumbnail_url" in fields) void deleteCustomThumbnail(previousThumbnail);
      if (nextDescription && nextDescription !== prototype.description?.trim()) {
        const result = descriptionComment
          ? await supabase.from("comments").update({ body: nextDescription }).eq("id", descriptionComment.id)
          : isBuilder ? await supabase.from("comments").insert({ prototype_id: prototype.id, author_id: user.id, body: nextDescription }) : { error: null };
        if (result.error) commentWarning = result.error.message;
      }
    }

    setSaving(false);
    onOpenChange(false);
    if (commentWarning) toast.error(`Details saved, but the pinned description comment could not be updated: ${commentWarning}`);
    else toast.success("Details saved");
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit details</DialogTitle><DialogDescription>The name shows on its card and page. The description is pinned to the top of its comments.</DialogDescription></DialogHeader>
        <form className="space-y-4" onSubmit={(event) => void save(event)}>
          <div className="space-y-2"><Label htmlFor="prototype-edit-name">Name</Label><Input id="prototype-edit-name" value={name} onChange={(event) => setName(event.target.value)} required /></div>
          <div className="space-y-2"><Label htmlFor="prototype-edit-description">Description <span className="font-normal text-abyss-5">(optional)</span></Label><Textarea id="prototype-edit-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={4} /></div>
          <fieldset className="space-y-2"><legend className="text-sm font-medium leading-5 text-abyss-9">Surface <span className="font-normal text-abyss-5">(optional)</span></legend><div className="flex flex-wrap gap-2">{prototypeSurfaces.map((option) => <SelectionPill key={option.id} selected={surface === option.id} title={option.hint} onClick={() => setSurface((current) => current === option.id ? null : option.id)}>{option.label}</SelectionPill>)}</div></fieldset>
          {isBuilder ? <div className="space-y-2">
            <Label htmlFor="prototype-edit-start">Start page <span className="font-normal text-abyss-5">(optional)</span></Label>
            <Input id="prototype-edit-start" value={startPath} onChange={(event) => setStartPath(event.target.value)} placeholder="Paste the page’s address, or a path like /accounts" autoComplete="off" spellCheck={false} aria-invalid={Boolean(parsedStart.error)} />
            {parsedStart.error ? <p className="text-xs text-chaparral-8">{parsedStart.error}</p> : startPreview && parsedStart.path ? <p className="flex flex-wrap items-center gap-x-2 text-xs text-abyss-5"><span className="break-all">Opens {startPreview}</span><a href={startPreview} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-abyss-9 underline"><ExternalLink className="h-3 w-3" />Test it</a></p> : <p className="text-xs text-abyss-5">Where Open and Launch take people. Leave empty to open the prototype’s main link.</p>}
          </div> : null}
          {isBuilder ? <div className="space-y-2">
            <Label>Thumbnail <span className="font-normal text-abyss-5">(optional)</span></Label>
            {pickedThumbnail ? <ThumbnailCropper bitmap={pickedThumbnail.bitmap} framing={pickedThumbnail.framing} onChange={(framing) => setPickedThumbnail((current) => current ? { ...current, framing } : current)} /> : null}
            <div className="flex items-center gap-3">
              {pickedThumbnail ? null : <div className="aspect-video w-40 shrink-0 overflow-hidden rounded border border-carbon-2 bg-carbon-1">{thumbnailPreview ? <img src={thumbnailPreview} alt="" className="h-full w-full object-cover object-center" /> : <div className="flex h-full items-center justify-center text-xs text-abyss-5">None</div>}</div>}
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded border border-carbon-3 px-3 text-sm text-abyss-9 hover:bg-carbon-1 focus-within:ring-2 focus-within:ring-abyss-5"><ImagePlus className="h-4 w-4" />{pickedThumbnail ? "Choose a different image" : hasCustomThumbnail ? "Replace image" : "Upload image"}<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { void pickThumbnail(event.target.files?.[0]); event.target.value = ""; }} /></label>
                {hasCustomThumbnail ? <Button type="button" variant="secondary" onClick={() => { setPickedThumbnail((current) => { current?.bitmap.close(); return null; }); setRemoveThumbnail(true); }}><Trash2 className="h-4 w-4" />{pickedThumbnail && !prototype.custom_thumbnail_url ? "Discard" : "Remove"}</Button> : null}
              </div>
            </div>
            <p className="text-xs text-abyss-5">Saved as a small 16:9 picture. {prototype.source === "mantl" ? "Replaces the automatic one, and stays when you share again from MANTL." : ""}</p>
          </div> : null}
          {prototype.source === "mantl" ? <InfoBanner type="grayscale">Sharing this prototype again from Prototyping in MANTL replaces its name and description with the ones from the share.</InfoBanner> : null}
          {formError ? <InfoBanner type="danger">{formError}</InfoBanner> : null}
          <DialogFooter><Button type="button" variant="secondary" size="lg" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button><Button type="submit" size="lg" disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : null}{saving ? "Saving…" : "Save details"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Edit details opened from a list (the gallery or the profile) rather than from
// the prototype's own page. It loads the prototype's comments first, so the
// pinned description comment is found and edited rather than posted a second
// time, and it tells every open list to reload once saved.
export function EditDetailsLauncher({ prototype, open, onOpenChange }: { prototype: PrototypeSummary; open: boolean; onOpenChange: (open: boolean) => void }) {
  if (!open) return null;
  return <LauncherBody prototype={prototype} onOpenChange={onOpenChange} />;
}

function LauncherBody({ prototype, onOpenChange }: { prototype: PrototypeSummary; onOpenChange: (open: boolean) => void }) {
  const { comments, loading } = useCommentThreads(prototype.id);
  if (loading) return null;
  return <EditDetailsDialog prototype={prototype} descriptionComment={findDescriptionComment(comments, prototype)} open onOpenChange={onOpenChange} onSaved={() => window.dispatchEvent(new Event(prototypesChangedEvent))} />;
}
