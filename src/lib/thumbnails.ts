import { supabase } from "@/lib/supabase";
import type { PrototypeSummary } from "@/lib/types";

// Member-set thumbnails. The picture goes in the public prototype-thumbnails
// bucket under custom/<prototype id>/ and its link in custom_thumbnail_url
// (migration 20261119130000_custom_thumbnails.sql).

const bucket = "prototype-thumbnails";
/** Widest a stored thumbnail gets: sharp on a high-density card, still small. */
export const thumbnailMaxWidth = 800;
/** The most a stored thumbnail may weigh. */
export const thumbnailMaxBytes = 300 * 1024;
/** The biggest picture we will even try to shrink. */
export const thumbnailMaxInputBytes = 5 * 1024 * 1024;

/** The picture a card shows: the member's own, else the one from MANTL. */
export function thumbnailOf(prototype: Pick<PrototypeSummary, "custom_thumbnail_url" | "thumbnail_url">) {
  return prototype.custom_thumbnail_url || prototype.thumbnail_url || null;
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Stored thumbnails are this shape, so the whole picture shows on a prototype's page. */
export const thumbnailWidth = thumbnailMaxWidth;
export const thumbnailHeight = Math.round((thumbnailMaxWidth * 9) / 16);
/** Gallery cards are a fixed height and their width varies, so they show a wider, shorter slice (1.9:1 on a phone, up to about 2.4:1). The cropper marks this band. */
export const cardSafeRatio = 2.4;
export const zoomRange = { min: 1, max: 4 };

/** How a picture sits in the 16:9 frame. ox and oy are the picture's centre, as a fraction of the frame's width and height away from the middle. */
export type Framing = { zoom: number; ox: number; oy: number; fit: boolean };
export const initialFraming: Framing = { zoom: 1, ox: 0, oy: 0, fit: false };

function frameGeometry(bitmap: ImageBitmap, width: number, height: number, framing: Framing) {
  // Fill covers the frame edge to edge; fit shows the whole picture with space around it.
  const base = framing.fit ? Math.min(width / bitmap.width, height / bitmap.height) : Math.max(width / bitmap.width, height / bitmap.height);
  const drawWidth = bitmap.width * base * framing.zoom;
  const drawHeight = bitmap.height * base * framing.zoom;
  return { drawWidth, drawHeight, maxX: Math.max(0, (drawWidth - width) / 2) / width, maxY: Math.max(0, (drawHeight - height) / 2) / height };
}

/** Keeps the picture from being dragged off the frame, so there are never gaps unless the whole picture is smaller than it. */
export function clampFraming(bitmap: ImageBitmap, framing: Framing): Framing {
  const zoom = Math.min(zoomRange.max, Math.max(zoomRange.min, framing.zoom));
  const limited = frameGeometry(bitmap, thumbnailWidth, thumbnailHeight, { ...framing, zoom });
  return { ...framing, zoom, ox: Math.min(limited.maxX, Math.max(-limited.maxX, framing.ox)), oy: Math.min(limited.maxY, Math.max(-limited.maxY, framing.oy)) };
}

/** Draws the framed picture onto a canvas. The preview and the saved file both use this, so what you see is what you get. */
export function drawFraming(canvas: HTMLCanvasElement, bitmap: ImageBitmap, framing: Framing) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const { width, height } = canvas;
  const { drawWidth, drawHeight } = frameGeometry(bitmap, width, height, framing);
  context.fillStyle = "#eef0f3";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, width / 2 + framing.ox * width - drawWidth / 2, height / 2 + framing.oy * height - drawHeight / 2, drawWidth, drawHeight);
}

/** Opens a picked file, checking it is an image of a sensible size. Throws a readable message when it cannot. */
export async function loadThumbnailSource(file: File): Promise<ImageBitmap> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file (PNG, JPEG or WebP).");
  if (file.size > thumbnailMaxInputBytes) throw new Error("That image is over 5 MB. Choose a smaller one.");
  try { return await createImageBitmap(file); } catch { throw new Error("That image could not be read. Try a PNG or JPEG."); }
}

/** Renders the framed picture to a small WebP (JPEG where WebP is unavailable). */
export async function renderThumbnail(bitmap: ImageBitmap, framing: Framing): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = thumbnailWidth;
  canvas.height = thumbnailHeight;
  drawFraming(canvas, bitmap, clampFraming(bitmap, framing));
  // WebP first; browsers without it hand back PNG, so fall to JPEG then.
  for (const quality of [0.85, 0.7, 0.55, 0.4]) {
    let blob = await encode(canvas, "image/webp", quality);
    if (blob && blob.type !== "image/webp") blob = await encode(canvas, "image/jpeg", quality);
    if (blob && blob.size <= thumbnailMaxBytes) return blob;
  }
  throw new Error("That image is too detailed to shrink to a thumbnail. Try a simpler one.");
}

/** Reads a blob as a data URL (demo mode keeps pictures in local storage). */
export function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.readAsDataURL(blob);
  });
}

/** Uploads a new thumbnail and returns its public link. Each upload gets its own file name, so a changed picture is never served from cache. */
export async function uploadCustomThumbnail(prototypeId: string, blob: Blob) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const extension = blob.type === "image/jpeg" ? "jpg" : "webp";
  const path = `custom/${prototypeId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: blob.type, upsert: false, cacheControl: "31536000" });
  if (error) {
    if (/bucket not found|row-level security|policy/i.test(error.message)) throw new Error("Could not save the thumbnail. Only the prototype’s owner can set one, and the custom-thumbnails Supabase migration must be applied.");
    throw new Error(error.message);
  }
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Removes the file behind an old custom thumbnail link. Quiet on failure: a leftover file is harmless. */
export async function deleteCustomThumbnail(url: string | null | undefined) {
  if (!supabase || !url) return;
  const marker = `/${bucket}/`;
  const at = url.indexOf(marker);
  if (at < 0) return;
  const path = decodeURIComponent(url.slice(at + marker.length).split("?")[0]);
  if (!path.startsWith("custom/")) return;
  await supabase.storage.from(bucket).remove([path]);
}
