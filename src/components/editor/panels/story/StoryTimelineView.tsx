'use client';

import { getStoryTimeline } from '@/engine/story';
import type { StorySlide } from '@/engine/types';
import { ACTION_LABELS } from '../../storyFields';
import { ACTION_COLORS, assignTracks } from './storyHelpers';

const TRACK_H = 26;

/** Multi-track visualization of a story slide's action sequence — actions
 * that overlap in time (via 'with-previous') get their own row instead of
 * stacking illegibly. Hidden on small screens (see StorySceneEditor) in
 * favor of the plain action list, which is easier to scan on mobile. */
export default function StoryTimelineView({ slide, selectedId, onSelect, bpm }: { slide: StorySlide; selectedId: string | null; onSelect: (actionId: string) => void; bpm?: number }) {
 const timeline = getStoryTimeline(slide);
 if (timeline.entries.length === 0 || timeline.total <= 0) {
 return <p className="text-[12.5px] text-[#767e8d] ">Add actions below to see them on the timeline.</p>;
 }
 const tracks = assignTracks(timeline.entries);
 const trackCount = Math.max(1, ...tracks) + 1;
 const beatTimes: number[] = [];
 if (bpm) {
 const beat = 60 / bpm;
 for (let t = 0; t <= timeline.total; t += beat) beatTimes.push(t);
 }

 return (
 <div className="overflow-x-auto rounded-xl bg-white/[.03] p-2">
 <div className="relative min-w-[480px]" style={{ height: trackCount * TRACK_H + 4 }}>
 {beatTimes.map((t, i) => (
 <div key={i} className="absolute top-0 bottom-0 w-px bg-white/20" style={{ left: `${(t / timeline.total) * 100}%` }} />
 ))}
 {timeline.entries.map((entry, i) => {
 const leftPct = (entry.start / timeline.total) * 100;
 const widthPct = Math.max(0.6, ((entry.end - entry.start) / timeline.total) * 100);
 const selected = selectedId === entry.action.id;
 return (
 <button
 key={entry.action.id}
 onClick={() => onSelect(entry.action.id)}
 title={`${ACTION_LABELS[entry.action.type]} — ${entry.start.toFixed(2)}s to ${entry.end.toFixed(2)}s`}
 style={{
 left: `${leftPct}%`,
 width: `${widthPct}%`,
 top: tracks[i] * TRACK_H,
 height: TRACK_H - 4,
 background: ACTION_COLORS[entry.action.type] ?? '#888',
 }}
 className={`absolute overflow-hidden rounded-md px-1.5 text-left text-[10.5px] font-bold text-white shadow-sm ${selected ? 'ring-2 ring-offset-1 ring-white' : ''}`}
 >
 <span className="block truncate leading-[18px]">{ACTION_LABELS[entry.action.type]}</span>
 </button>
 );
 })}
 </div>
 </div>
 );
}
