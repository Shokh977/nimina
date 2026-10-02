'use client';

import { useRef } from 'react';

import { snapToBeat } from '@/engine/audio';
import type { Action, ImageAsset, StorySlide } from '@/engine/types';
import { assetSrc, loadImageFile, newAssetId } from '@/lib/assetSrc';
import { uploadAsset } from '@/lib/storage/assets';
import { useEditorStore } from '@/store/editorStore';
import { usePlayback } from '../../PlaybackContext';
import { sceneStart } from '../../timelineHelpers';
import { ACTION_LABELS, BUILTIN_ICONS, BUILTIN_SPRITES, EASINGS, ICON_ANIMS, LOADING_STYLES, SCREEN_TRANSITIONS, sfxOptionsFor, START_MODES, TAP_PRESSES } from '../../storyFields';
import ScreenPlacementPicker from './ScreenPlacementPicker';
import { resolveActionScreenId } from './storyHelpers';
import type { StoryTimelineEntry } from '@/engine/story/timeline';

const ACCENT = '#F59E0B';

export default function StoryActionCard({
 slide,
 entry,
 index,
 count,
 selected,
 onSelect,
 draggableProps,
 snapBpm,
}: {
 slide: StorySlide;
 entry: StoryTimelineEntry;
 index: number;
 count: number;
 selected: boolean;
 onSelect: () => void;
 draggableProps: React.HTMLAttributes<HTMLDivElement>;
 /** When set, the Duration field snaps to this BPM's beat grid instead of
 * accepting an arbitrary value — see StorySceneEditor's "Snap to beat". */
 snapBpm?: number;
}) {
 const action = entry.action;
 const assets = useEditorStore((s) => s.assets);
 const updateStoryAction = useEditorStore((s) => s.updateStoryAction);
 const removeStoryAction = useEditorStore((s) => s.removeStoryAction);
 const moveStoryAction = useEditorStore((s) => s.moveStoryAction);
 const project = useEditorStore((s) => s.project);
 const { seek } = usePlayback();

 const screenId = resolveActionScreenId(slide, action.id);
 const screen = slide.screens.find((s) => s.id === screenId);
 const previewImg = screen ? (assets.images[screen.assetId] ?? null) : null;

 const patch = <A extends Action>(p: Partial<A>) => updateStoryAction<A>(slide.id, action.id, p);
 const seekHere = () => seek(sceneStart(project, slide.id) + entry.start + 0.02);

 return (
 <div
 {...draggableProps}
 onClick={() => {
 onSelect();
 seekHere();
 }}
 className={`mb-2 rounded-xl border p-2.5 ${selected ? 'border-indigo-500 bg-[#5b4bff]/[.14]' : 'border-white/[.12] bg-white/[.03] '}`}
 >
 <div className="mb-2 flex items-center justify-between gap-2">
 <span className="cursor-grab text-[13px] font-extrabold" title="Drag to reorder">
 ⠿ {index + 1}. {ACTION_LABELS[action.type]}
 </span>
 <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
 <button disabled={index === 0} onClick={() => moveStoryAction(slide.id, action.id, -1)} aria-label="Move up" className="rounded-lg border border-white/[.12] bg-white/[.03] px-1.5 py-0.5 text-[11.5px] font-semibold disabled:opacity-35 ">
 ↑
 </button>
 <button disabled={index === count - 1} onClick={() => moveStoryAction(slide.id, action.id, 1)} aria-label="Move down" className="rounded-lg border border-white/[.12] bg-white/[.03] px-1.5 py-0.5 text-[11.5px] font-semibold disabled:opacity-35 ">
 ↓
 </button>
 <button onClick={() => removeStoryAction(slide.id, action.id)} className="rounded-lg border border-white/[.12] bg-white/[.03] px-1.5 py-0.5 text-[11.5px] font-semibold text-[#ff8f76] ">
 Delete
 </button>
 </div>
 </div>

 <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
 <NumField
 label={snapBpm ? `Duration (s, snapped to ${snapBpm} BPM)` : 'Duration (s)'}
 value={action.duration}
 min={0.1}
 step={0.1}
 onChange={(v) => patch({ duration: Math.max(0.1, snapBpm ? Math.max(60 / snapBpm, snapToBeat(v, snapBpm)) : v) })}
 />
 <SelectField label="Start" value={action.startMode} options={START_MODES} onChange={(v) => patch({ startMode: v })} />
 <SelectField label="Easing" value={action.easing} options={EASINGS} onChange={(v) => patch({ easing: v })} />
 <SelectField label="Sound" value={action.sfx} options={sfxOptionsFor(action)} onChange={(v) => patch({ sfx: v })} />
 </div>

 <div className="mt-2.5">
 <ActionFields slide={slide} action={action} previewImg={previewImg} patch={patch} />
 </div>
 </div>
 );
}

function ActionFields({ slide, action, previewImg, patch }: { slide: StorySlide; action: Action; previewImg: ImageAsset | null; patch: <A extends Action>(p: Partial<A>) => void }) {
 switch (action.type) {
 case 'launchApp':
 return (
 <div className="grid grid-cols-1 gap-2.5">
 <div className="flex flex-wrap items-start gap-3">
 <ScreenPlacementPicker
 image={null}
 emptyLabel="Tap to position the app icon"
 points={[{ x: action.iconPosition.x, y: action.iconPosition.y, color: ACCENT, label: 'App icon' }]}
 onPick={(x, y) => patch<typeof action>({ iconPosition: { x, y } })}
 />
 <div className="grid min-w-0 flex-1 gap-2">
 <IconAssetField label="app icon" assetId={action.iconAssetId} onChange={(id) => patch<typeof action>({ iconAssetId: id })} />
 <div className="flex items-center gap-2">
 <SelectField
 label="Wallpaper"
 value={action.wallpaper.kind}
 options={[
 ['color', 'Solid color'],
 ['gradient', 'Gradient'],
 ]}
 onChange={(kind) => patch<typeof action>({ wallpaper: kind === 'color' ? { kind: 'color', color: '#1F2A44' } : { kind: 'gradient', from: '#2B2F77', to: '#171A3D' } })}
 />
 </div>
 {action.wallpaper.kind === 'color' ? (
 <ColorField label="Color" value={action.wallpaper.color} onChange={(color) => patch<typeof action>({ wallpaper: { kind: 'color', color } })} />
 ) : (
 <div className="flex gap-2">
 <ColorField label="From" value={action.wallpaper.from} onChange={(from) => patch<typeof action>({ wallpaper: { ...action.wallpaper as { kind: 'gradient'; from: string; to: string }, from } })} />
 <ColorField label="To" value={action.wallpaper.to} onChange={(to) => patch<typeof action>({ wallpaper: { ...action.wallpaper as { kind: 'gradient'; from: string; to: string }, to } })} />
 </div>
 )}
 </div>
 </div>
 </div>
 );

 case 'showScreen':
 return (
 <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
 <SelectField
 label="Screen"
 value={action.screenId}
 options={slide.screens.map((s, i) => [s.id, `Screen ${i + 1}`] as [string, string])}
 placeholder="Choose a screen…"
 onChange={(screenId) => patch<typeof action>({ screenId })}
 />
 <SelectField label="Transition" value={action.transition} options={SCREEN_TRANSITIONS} onChange={(transition) => patch<typeof action>({ transition })} />
 </div>
 );

 case 'loading':
 return (
 <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
 <SelectField label="Style" value={action.style} options={LOADING_STYLES} onChange={(style) => patch<typeof action>({ style })} />
 {action.style === 'splash' && <IconAssetField label="logo" assetId={action.logoAssetId} onChange={(id) => patch<typeof action>({ logoAssetId: id })} />}
 </div>
 );

 case 'scroll':
 return (
 <div className="grid grid-cols-1 items-end gap-2.5 sm:grid-cols-3">
 <NumField label="From (0-1)" value={action.from} min={0} max={1} step={0.05} onChange={(from) => patch<typeof action>({ from })} />
 <NumField label="To (0-1)" value={action.to} min={0} max={1} step={0.05} onChange={(to) => patch<typeof action>({ to })} />
 <label className="mb-2 flex items-center gap-1.5 text-[12.5px] font-semibold">
 <input type="checkbox" checked={!!action.overshoot} onChange={(e) => patch<typeof action>({ overshoot: e.target.checked })} className="h-[16px] w-[16px] accent-indigo-600" />
 Overshoot
 </label>
 </div>
 );

 case 'tap':
 return (
 <div className="flex flex-wrap items-start gap-3">
 <ScreenPlacementPicker image={previewImg} points={[{ x: action.x, y: action.y, color: ACCENT }]} onPick={(x, y) => patch<typeof action>({ x, y })} />
 <div className="grid min-w-0 flex-1 gap-2">
 <SelectField label="Press style" value={action.press} options={TAP_PRESSES} onChange={(press) => patch<typeof action>({ press })} />
 </div>
 </div>
 );

 case 'longPress':
 case 'successCheck':
 return <ScreenPlacementPicker image={previewImg} points={[{ x: action.x, y: action.y, color: ACCENT }]} onPick={(x, y) => patch<typeof action>({ x, y })} />;

 case 'swipe':
 return (
 <ScreenPlacementPicker
 image={previewImg}
 points={[
 { x: action.from.x, y: action.from.y, color: '#22C55E', label: 'From' },
 { x: action.to.x, y: action.to.y, color: '#EF4444', label: 'To' },
 ]}
 onPick={(x, y) => patch<typeof action>({ to: { x, y } })}
 />
 );

 case 'typeText':
 return (
 <div className="flex flex-wrap items-start gap-3">
 <ScreenPlacementPicker image={previewImg} points={[{ x: action.x, y: action.y, color: ACCENT }]} onPick={(x, y) => patch<typeof action>({ x, y })} />
 <div className="grid min-w-0 flex-1 gap-2">
 <TextField label="Text" value={action.text} onChange={(text) => patch<typeof action>({ text })} />
 <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
 <NumField label="Field width" value={action.width} min={0.1} max={1} step={0.05} onChange={(width) => patch<typeof action>({ width })} />
 <NumField label="Chars/sec" value={action.charsPerSecond} min={1} max={60} step={1} onChange={(charsPerSecond) => patch<typeof action>({ charsPerSecond })} />
 </div>
 </div>
 </div>
 );

 case 'highlight':
 return (
 <div className="flex flex-wrap items-start gap-3">
 <ScreenPlacementPicker image={previewImg} rect={{ x: action.x, y: action.y, w: action.w, h: action.h, color: ACCENT }} onPick={(x, y) => patch<typeof action>({ x, y })} />
 <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
 <NumField label="Width" value={action.w} min={0.05} max={1} step={0.02} onChange={(w) => patch<typeof action>({ w })} />
 <NumField label="Height" value={action.h} min={0.05} max={1} step={0.02} onChange={(h) => patch<typeof action>({ h })} />
 </div>
 </div>
 );

 case 'notification':
 return (
 <div className="grid grid-cols-1 gap-2.5">
 <TextField label="Title" value={action.title} onChange={(title) => patch<typeof action>({ title })} />
 <TextField label="Body" value={action.body} onChange={(body) => patch<typeof action>({ body })} />
 <IconAssetField label="notification icon" assetId={action.iconAssetId} onChange={(id) => patch<typeof action>({ iconAssetId: id })} />
 </div>
 );

 case 'iconAnim':
 return (
 <div className="flex flex-wrap items-start gap-3">
 <ScreenPlacementPicker image={previewImg} points={[{ x: action.x, y: action.y, color: ACCENT }]} onPick={(x, y) => patch<typeof action>({ x, y })} />
 <div className="grid min-w-0 flex-1 gap-2">
 <SelectField label="Icon" value={action.builtIn} options={BUILTIN_ICONS} onChange={(builtIn) => patch<typeof action>({ builtIn })} />
 <SelectField label="Animation" value={action.anim} options={ICON_ANIMS} onChange={(anim) => patch<typeof action>({ anim })} />
 </div>
 </div>
 );

 case 'sprite':
 return (
 <SelectField
 label="Sprite"
 value={action.spriteId}
 placeholder="Choose a sprite…"
 options={slide.sprites.map((sp, i) => {
 const source = sp.source;
 const label = source.kind === 'builtin' ? (BUILTIN_SPRITES.find(([n]) => n === source.name)?.[1] ?? source.name) : `Sprite ${i + 1}`;
 return [sp.id, label] as [string, string];
 })}
 onChange={(spriteId) => patch<typeof action>({ spriteId })}
 />
 );

 case 'wait':
 return <p className="text-[12.5px] text-[#767e8d] ">A pause — nothing else to configure.</p>;

 default:
 return null;
 }
}

/* ---------- shared field primitives ---------- */

function NumField({ label, value, onChange, step = 0.01, min, max }: { label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number }) {
 return (
 <label className="block text-[11.5px] font-semibold text-[#767e8d] ">
 {label}
 <input
 type="number"
 step={step}
 min={min}
 max={max}
 value={value}
 onChange={(e) => onChange(Number(e.target.value))}
 onClick={(e) => e.stopPropagation()}
 className="mt-0.5 block w-full rounded-lg border border-white/[.12] bg-white/[.03] px-2 py-1.5 text-[13.5px] "
 />
 </label>
 );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
 return (
 <label className="block text-[11.5px] font-semibold text-[#767e8d] ">
 {label}
 <input
 type="text"
 value={value}
 onChange={(e) => onChange(e.target.value)}
 onClick={(e) => e.stopPropagation()}
 className="mt-0.5 block w-full rounded-lg border border-white/[.12] bg-white/[.03] px-2 py-1.5 text-[13.5px] "
 />
 </label>
 );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
 return (
 <label className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[#767e8d] ">
 {label}
 <input type="color" value={value} onChange={(e) => onChange(e.target.value)} onClick={(e) => e.stopPropagation()} className="h-7 w-9 rounded border border-white/[.12] " />
 </label>
 );
}

function SelectField<T extends string>({
 label,
 value,
 options,
 onChange,
 placeholder,
}: {
 label: string;
 value: T;
 options: Array<[T, string]>;
 onChange: (v: T) => void;
 placeholder?: string;
}) {
 return (
 <label className="block text-[11.5px] font-semibold text-[#767e8d] ">
 {label}
 <select
 value={value}
 onChange={(e) => onChange(e.target.value as T)}
 onClick={(e) => e.stopPropagation()}
 className="mt-0.5 block w-full rounded-lg border border-white/[.12] bg-white/[.03] px-2 py-1.5 text-[13.5px] "
 >
 {placeholder && <option value="">{placeholder}</option>}
 {options.map(([v, l]) => (
 <option key={v} value={v}>
 {l}
 </option>
 ))}
 </select>
 </label>
 );
}

function IconAssetField({ label, assetId, onChange }: { label: string; assetId?: string; onChange: (assetId: string, image: ImageAsset) => void }) {
 const assets = useEditorStore((s) => s.assets);
 const projectId = useEditorStore((s) => s.projectId);
 const registerImage = useEditorStore((s) => s.registerImage);
 const inputRef = useRef<HTMLInputElement>(null);
 const img = assetId ? assets.images[assetId] : null;

 const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 e.target.value = '';
 if (!file) return;
 const { image } = await loadImageFile(file);
 const id = newAssetId('icon');
 registerImage(id, image);
 onChange(id, image);
 if (projectId) uploadAsset(projectId, id, file).catch((err) => console.error('[assets] upload failed', err));
 };

 return (
 <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
 <button type="button" onClick={() => inputRef.current?.click()} className="rounded-lg border border-white/[.12] bg-white/[.03] px-2.5 py-1.5 text-[12.5px] font-semibold ">
 {assetId ? 'Change' : 'Upload'} {label}
 </button>
 {img && (
 // eslint-disable-next-line @next/next/no-img-element -- in-memory/data-URL asset
 <img src={assetSrc(img)} alt="" className="h-7 w-7 rounded-lg object-cover" />
 )}
 <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
 </div>
 );
}
