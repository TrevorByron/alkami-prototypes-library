import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";

import { cardSafeRatio, clampFraming, drawFraming, initialFraming, thumbnailHeight, thumbnailWidth, zoomRange, type Framing } from "@/lib/thumbnails";

// Frames a picked picture in the 16:9 shape thumbnails are saved in: drag to
// move it, zoom with the slider, or show the whole picture. The dashed lines
// mark the band that gallery cards always show (they are shorter than 16:9).
const safeInset = ((1 - 16 / 9 / cardSafeRatio) / 2) * 100;
const nudge = 0.02;

export function ThumbnailCropper({ bitmap, framing, onChange }: { bitmap: ImageBitmap; framing: Framing; onChange: (framing: Framing) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    if (canvas.current) drawFraming(canvas.current, bitmap, framing);
  }, [bitmap, framing]);

  const move = (ox: number, oy: number) => onChange(clampFraming(bitmap, { ...framing, ox, oy }));

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, ox: framing.ox, oy: framing.oy };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    move(drag.current.ox + (event.clientX - drag.current.x) / rect.width, drag.current.oy + (event.clientY - drag.current.y) / rect.height);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const steps: Record<string, [number, number]> = { ArrowLeft: [-nudge, 0], ArrowRight: [nudge, 0], ArrowUp: [0, -nudge], ArrowDown: [0, nudge] };
    const step = steps[event.key];
    if (step) { event.preventDefault(); move(framing.ox + step[0], framing.oy + step[1]); }
    else if (event.key === "+" || event.key === "=") { event.preventDefault(); onChange(clampFraming(bitmap, { ...framing, zoom: framing.zoom + 0.1 })); }
    else if (event.key === "-") { event.preventDefault(); onChange(clampFraming(bitmap, { ...framing, zoom: framing.zoom - 0.1 })); }
  }

  return (
    <div className="space-y-2">
      <div
        role="application"
        tabIndex={0}
        aria-label="Thumbnail framing. Drag, or use the arrow keys to move the picture, and plus and minus to zoom."
        className="relative aspect-video w-full touch-none cursor-grab overflow-hidden rounded border border-carbon-3 bg-carbon-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-abyss-5 active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
        onKeyDown={onKeyDown}
      >
        <canvas ref={canvas} width={thumbnailWidth} height={thumbnailHeight} className="block h-full w-full" />
        <div className="pointer-events-none absolute inset-x-0 top-0 bg-abyss-9/30" style={{ height: `${safeInset}%` }} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-abyss-9/30" style={{ height: `${safeInset}%` }} />
        <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-white" style={{ top: `${safeInset}%` }} />
        <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-white" style={{ bottom: `${safeInset}%` }} />
      </div>
      <div className="flex items-center gap-3">
        <label className="flex flex-1 items-center gap-2 text-xs text-abyss-5">
          Zoom
          <input type="range" min={zoomRange.min} max={zoomRange.max} step={0.01} value={framing.zoom} onChange={(event) => onChange(clampFraming(bitmap, { ...framing, zoom: Number(event.target.value) }))} className="h-1 flex-1 accent-abyss-7" aria-label="Zoom" />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-abyss-7">
          <input type="checkbox" checked={framing.fit} onChange={(event) => onChange({ ...initialFraming, fit: event.target.checked })} />
          Fit whole image
        </label>
      </div>
      <p className="text-xs text-abyss-5">Drag to reposition. Gallery cards show the middle band between the dashed lines; the full frame shows on the prototype’s page.</p>
    </div>
  );
}
