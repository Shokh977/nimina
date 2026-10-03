'use client';

import { getStoryTimeline } from '@/engine/story';
import type { CameraKey, StorySlide } from '@/engine/types';
import { useEditorStore } from '@/store/editorStore';
import Details from '../../ui/Details';
import { ACTION_LABELS } from '../../storyFields';

/** Auto mode needs no configuration — the camera pushes in on taps/
 * highlights and eases back on scrolls/screen changes automatically (see
 * src/engine/story/camera.ts). Manual mode exposes the same authored
 * keyframe list that engine consumes directly. */
export default function CameraEditor({ slide }: { slide: StorySlide }) {
 const setCameraMode = useEditorStore((s) => s.setCameraMode);
 const addCameraKey = useEditorStore((s) => s.addCameraKey);
 const updateCameraKey = useEditorStore((s) => s.updateCameraKey);
 const removeCameraKey = useEditorStore((s) => s.removeCameraKey);
 const timeline = getStoryTimeline(slide);

 return (
 <div>
 <h4 className="mb-1.5 text-[12.5px] font-bold text-[#767e8d] ">Camera</h4>
 <div className="flex gap-3">
 {(['auto', 'manual'] as const).map((mode) => (
 <label key={mode} className="flex min-h-11 items-center gap-2 text-[13px] font-semibold md:min-h-0 md:gap-1.5">
 <input type="radio" name={`camera-mode-${slide.id}`} checked={slide.cameraMode === mode} onChange={() => setCameraMode(slide.id, mode)} className="h-[22px] w-[22px] shrink-0 accent-indigo-600 md:h-[16px] md:w-[16px]" />
 {mode === 'auto' ? 'Auto (push in on taps, ease back on scroll)' : 'Manual keyframes'}
 </label>
 ))}
 </div>

 {slide.cameraMode === 'manual' && (
 <Details summary={`${slide.cameraKeys.length} keyframe${slide.cameraKeys.length === 1 ? '' : 's'}`} defaultOpen>
 {slide.cameraKeys.map((key, i) => (
 <CameraKeyRow key={i} slide={slide} keyIndex={i} cameraKey={key} onChange={(k) => updateCameraKey(slide.id, i, k)} onRemove={() => removeCameraKey(slide.id, i)} />
 ))}
 <button
 onClick={() => addCameraKey(slide.id, { time: timeline.total / 2, target: { x: 0.5, y: 0.5 }, zoom: 1.3 })}
 className="mt-1 rounded-lg border border-dashed border-white/[.18] bg-white/[.03] px-3 py-1.5 text-[12.5px] font-bold hover:border-indigo-500 "
 >
 + Add keyframe
 </button>
 </Details>
 )}
 </div>
 );
}

function CameraKeyRow({
 slide,
 cameraKey,
 onChange,
 onRemove,
}: {
 slide: StorySlide;
 keyIndex: number;
 cameraKey: CameraKey;
 onChange: (k: CameraKey) => void;
 onRemove: () => void;
}) {
 const anchoredToAction = 'actionId' in cameraKey && cameraKey.actionId !== undefined;

 return (
 <div className="mb-1.5 grid grid-cols-1 items-end gap-1.5 rounded-lg bg-white/[.03] p-1.5 md:grid-cols-[1fr_1fr_1fr_1fr_auto] ">
 <label className="text-[11px] font-semibold text-[#767e8d] ">
 Anchor
 <select
 value={anchoredToAction ? (cameraKey as { actionId: string }).actionId : '__time__'}
 onChange={(e) =>
 onChange(
 e.target.value === '__time__'
 ? { target: cameraKey.target, zoom: cameraKey.zoom, rotation: cameraKey.rotation, time: 0 }
 : { target: cameraKey.target, zoom: cameraKey.zoom, rotation: cameraKey.rotation, actionId: e.target.value },
 )
 }
 className="mt-0.5 block w-full rounded-md border border-white/[.12] bg-white/[.03] px-1.5 py-1 text-[12px] "
 >
 <option value="__time__">At time (s)</option>
 {slide.actions.map((a, i) => (
 <option key={a.id} value={a.id}>
 {i + 1}. {ACTION_LABELS[a.type]}
 </option>
 ))}
 </select>
 </label>
 {!anchoredToAction && (
 <label className="text-[11px] font-semibold text-[#767e8d] ">
 Time (s)
 <input
 type="number"
 step={0.1}
 min={0}
 value={'time' in cameraKey ? cameraKey.time : 0}
 onChange={(e) => onChange({ ...cameraKey, time: Number(e.target.value) })}
 className="mt-0.5 block w-full rounded-md border border-white/[.12] bg-white/[.03] px-1.5 py-1 text-[12px] "
 />
 </label>
 )}
 <label className="text-[11px] font-semibold text-[#767e8d] ">
 Target x,y
 <div className="mt-0.5 flex gap-1">
 <input
 type="number"
 step={0.02}
 min={0}
 max={1}
 value={cameraKey.target.x}
 onChange={(e) => onChange({ ...cameraKey, target: { ...cameraKey.target, x: Number(e.target.value) } })}
 className="w-full min-w-0 rounded-md border border-white/[.12] bg-white/[.03] px-1.5 py-1 text-[12px] "
 />
 <input
 type="number"
 step={0.02}
 min={0}
 max={1}
 value={cameraKey.target.y}
 onChange={(e) => onChange({ ...cameraKey, target: { ...cameraKey.target, y: Number(e.target.value) } })}
 className="w-full min-w-0 rounded-md border border-white/[.12] bg-white/[.03] px-1.5 py-1 text-[12px] "
 />
 </div>
 </label>
 <label className="text-[11px] font-semibold text-[#767e8d] ">
 Zoom
 <input
 type="number"
 step={0.1}
 min={0.5}
 max={3}
 value={cameraKey.zoom}
 onChange={(e) => onChange({ ...cameraKey, zoom: Number(e.target.value) })}
 className="mt-0.5 block w-full rounded-md border border-white/[.12] bg-white/[.03] px-1.5 py-1 text-[12px] "
 />
 </label>
 <button onClick={onRemove} className="rounded-md border border-white/[.12] bg-white/[.03] px-2 py-1 text-[11px] font-semibold text-[#ff8f76] ">
 ✕
 </button>
 </div>
 );
}
