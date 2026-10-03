/**
 * Frame-accurate video frames for export: decodes the screen recordings of
 * video slides with WebCodecs (via mediabunny) instead of seeking a <video>
 * element, so every exported frame shows exactly the file time
 * src/engine/video.ts asks for, at any export speed.
 *
 * Export asks for times in increasing order within a slide, so each
 * recording keeps one forward-running decoder; asking for an earlier time
 * (a later slide re-using the same recording) restarts it there.
 */
import { ALL_FORMATS, BlobSource, CanvasSink, Input, type WrappedCanvas } from 'mediabunny';

import { videoFrameAt } from '../video';
import type { AssetMap, Project, Segment } from '../types';

/** Longest side of a decoded frame — the screen inside a device frame is
 * never larger than this, even in a 4K export. */
const MAX_SIDE = 1920;

interface Track {
  sink: CanvasSink;
  first: number;
  iter: AsyncGenerator<WrappedCanvas, void, unknown> | null;
  cur: WrappedCanvas | null;
  next: WrappedCanvas | null;
  /** What the engine draws: our own canvas, the decoded frame copied in. */
  out: HTMLCanvasElement;
}

export class VideoFrameFeeder {
  private tracks = new Map<string, Promise<Track | null>>();
  constructor(private blobs: Record<string, Blob>) {}

  private open(assetId: string): Promise<Track | null> {
    let t = this.tracks.get(assetId);
    if (!t) {
      t = (async () => {
        const blob = this.blobs[assetId];
        if (!blob) return null;
        const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
        const track = await input.getPrimaryVideoTrack();
        if (!track || !(await track.canDecode())) return null;
        const w = track.displayWidth,
          h = track.displayHeight,
          k = Math.min(1, MAX_SIDE / Math.max(w, h));
        const width = Math.max(2, Math.round(w * k)),
          height = Math.max(2, Math.round(h * k));
        const out = document.createElement('canvas');
        out.width = width;
        out.height = height;
        return { sink: new CanvasSink(track, { width, height, fit: 'fill', poolSize: 3 }), first: await track.getFirstTimestamp(), iter: null, cur: null, next: null, out };
      })();
      this.tracks.set(assetId, t);
    }
    return t;
  }

  /** The canvas showing `assetId` at file time `time`, or null when the file can't be decoded. */
  async frameAt(assetId: string, time: number): Promise<HTMLCanvasElement | null> {
    const tr = await this.open(assetId);
    if (!tr) return null;
    const ts = tr.first + time;
    // Restart when going backwards (or before the first request).
    if (!tr.iter || (tr.cur && ts < tr.cur.timestamp - 1e-4)) {
      await tr.iter?.return(undefined);
      tr.iter = tr.sink.canvases(ts);
      tr.cur = (await tr.iter.next()).value ?? null;
      tr.next = (await tr.iter.next()).value ?? null;
    }
    // Advance while the following frame has already started.
    while (tr.next && tr.next.timestamp <= ts + 1e-4) {
      tr.cur = tr.next;
      tr.next = (await tr.iter.next()).value ?? null;
    }
    if (!tr.cur) return tr.out;
    const ctx = tr.out.getContext('2d')!;
    ctx.drawImage(tr.cur.canvas, 0, 0, tr.out.width, tr.out.height);
    return tr.out;
  }

  /** `images` plus the recording frame the frame at time `t` shows (if any). */
  async assetsAt(project: Project, list: Segment[], images: AssetMap, t: number): Promise<AssetMap> {
    const vf = videoFrameAt(project, list, t);
    if (!vf || !vf.slide.video.assetId) return images;
    const frame = await this.frameAt(vf.slide.video.assetId, vf.sourceTime);
    return frame ? { ...images, [vf.slide.video.assetId]: frame } : images;
  }

  async close(): Promise<void> {
    for (const t of this.tracks.values()) {
      const tr = await t.catch(() => null);
      await tr?.iter?.return(undefined).catch(() => {});
    }
    this.tracks.clear();
  }
}
