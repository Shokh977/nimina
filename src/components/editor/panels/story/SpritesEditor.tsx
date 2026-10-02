'use client';

import { useRef } from 'react';

import type { BuiltInSprite, Sprite, StorySlide } from '@/engine/types';
import { assetSrc, loadImageFile, newAssetId } from '@/lib/assetSrc';
import { uploadAsset } from '@/lib/storage/assets';
import { useEditorStore } from '@/store/editorStore';
import { BUILTIN_SPRITES, EASINGS } from '../../storyFields';
import Details from '../../ui/Details';

/** Sprites (e.g. a delivery scooter driving a path) are defined here and
 * played over the current screen by a `sprite` action, which just
 * references one by id — see StoryActionCard's `sprite` case. */
export default function SpritesEditor({ slide }: { slide: StorySlide }) {
 const addSprite = useEditorStore((s) => s.addSprite);
 const removeSprite = useEditorStore((s) => s.removeSprite);

 return (
 <div>
 <h4 className="mb-1.5 text-[12.5px] font-bold text-[#767e8d] ">Sprites</h4>
 {slide.sprites.map((sprite) => (
 <SpriteRow key={sprite.id} slide={slide} sprite={sprite} onRemove={() => removeSprite(slide.id, sprite.id)} />
 ))}
 <button
 onClick={() => addSprite(slide.id)}
 className="rounded-lg border border-dashed border-white/[.18] bg-white/[.03] px-3 py-1.5 text-[12.5px] font-bold hover:border-indigo-500 "
 >
 + Add sprite
 </button>
 </div>
 );
}

function SpriteRow({ slide, sprite, onRemove }: { slide: StorySlide; sprite: Sprite; onRemove: () => void }) {
 const assets = useEditorStore((s) => s.assets);
 const projectId = useEditorStore((s) => s.projectId);
 const registerImage = useEditorStore((s) => s.registerImage);
 const updateSprite = useEditorStore((s) => s.updateSprite);
 const addSpritePathPoint = useEditorStore((s) => s.addSpritePathPoint);
 const updateSpritePathPoint = useEditorStore((s) => s.updateSpritePathPoint);
 const removeSpritePathPoint = useEditorStore((s) => s.removeSpritePathPoint);
 const fileInputRef = useRef<HTMLInputElement>(null);

 const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 e.target.value = '';
 if (!file) return;
 const { image } = await loadImageFile(file);
 const assetId = newAssetId('sprite');
 registerImage(assetId, image);
 if (projectId) uploadAsset(projectId, assetId, file).catch((err) => console.error('[assets] upload failed', err));
 updateSprite(slide.id, sprite.id, { source: { kind: 'asset', assetId } });
 };

 const assetImg = sprite.source.kind === 'asset' ? assets.images[sprite.source.assetId] : null;

 return (
 <Details summary={`Sprite — ${sprite.source.kind === 'builtin' ? sprite.source.name : 'custom image'}`}>
 <div className="grid gap-2.5 rounded-lg bg-white/[.03] p-2.5 ">
 <div className="flex flex-wrap items-center gap-2">
 <label className="text-[11.5px] font-semibold text-[#767e8d] ">
 Source
 <select
 value={sprite.source.kind === 'builtin' ? sprite.source.name : '__custom__'}
 onChange={(e) => {
 if (e.target.value === '__custom__') fileInputRef.current?.click();
 else updateSprite(slide.id, sprite.id, { source: { kind: 'builtin', name: e.target.value as BuiltInSprite } });
 }}
 className="mt-0.5 block w-full rounded-md border border-white/[.12] bg-white/[.03] px-2 py-1.5 text-[13px] "
 >
 {BUILTIN_SPRITES.map(([v, l]) => (
 <option key={v} value={v}>
 {l}
 </option>
 ))}
 <option value="__custom__">Upload image…</option>
 </select>
 </label>
 {assetImg && (
 // eslint-disable-next-line @next/next/no-img-element -- in-memory/data-URL asset
 <img src={assetSrc(assetImg)} alt="" className="h-8 w-8 rounded-md object-cover" />
 )}
 <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onUpload} />
 </div>

 <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
 <label className="text-[11.5px] font-semibold text-[#767e8d] ">
 Size
 <input
 type="number"
 step={0.01}
 min={0.02}
 max={1}
 value={sprite.size}
 onChange={(e) => updateSprite(slide.id, sprite.id, { size: Number(e.target.value) })}
 className="mt-0.5 block w-full rounded-md border border-white/[.12] bg-white/[.03] px-2 py-1.5 text-[13px] "
 />
 </label>
 <label className="text-[11.5px] font-semibold text-[#767e8d] ">
 Easing
 <select
 value={sprite.easing}
 onChange={(e) => updateSprite(slide.id, sprite.id, { easing: e.target.value as Sprite['easing'] })}
 className="mt-0.5 block w-full rounded-md border border-white/[.12] bg-white/[.03] px-2 py-1.5 text-[13px] "
 >
 {EASINGS.map(([v, l]) => (
 <option key={v} value={v}>
 {l}
 </option>
 ))}
 </select>
 </label>
 <label className="flex items-center gap-1.5 text-[12px] font-semibold sm:mt-4.5">
 <input type="checkbox" checked={sprite.rotateAlongPath} onChange={(e) => updateSprite(slide.id, sprite.id, { rotateAlongPath: e.target.checked })} className="h-[15px] w-[15px] accent-indigo-600" />
 Face travel direction
 </label>
 </div>

 <div>
 <p className="mb-1 text-[11.5px] font-semibold text-[#767e8d] ">
 Path (normalized 0-1 within the phone screen; start to end)
 </p>
 {sprite.path.map((pt, i) => (
 <div key={i} className="mb-1 flex items-center gap-1.5">
 <input
 type="number"
 step={0.02}
 min={0}
 max={1}
 value={pt.x}
 onChange={(e) => updateSpritePathPoint(slide.id, sprite.id, i, { x: Number(e.target.value), y: pt.y })}
 className="w-16 rounded-md border border-white/[.12] bg-white/[.03] px-2 py-1 text-[12.5px] "
 />
 <input
 type="number"
 step={0.02}
 min={0}
 max={1}
 value={pt.y}
 onChange={(e) => updateSpritePathPoint(slide.id, sprite.id, i, { x: pt.x, y: Number(e.target.value) })}
 className="w-16 rounded-md border border-white/[.12] bg-white/[.03] px-2 py-1 text-[12.5px] "
 />
 <button onClick={() => removeSpritePathPoint(slide.id, sprite.id, i)} className="rounded-md border border-white/[.12] bg-white/[.03] px-2 py-1 text-[11px] font-semibold text-[#ff8f76] ">
 ✕
 </button>
 </div>
 ))}
 <button
 onClick={() => addSpritePathPoint(slide.id, sprite.id, { x: 0.5, y: 0.5 })}
 className="rounded-md border border-dashed border-white/[.18] bg-white/[.03] px-2.5 py-1 text-[12px] font-bold hover:border-indigo-500 "
 >
 + Add point
 </button>
 </div>

 <button onClick={onRemove} className="justify-self-start text-[12.5px] font-bold text-[#ff8f76]">
 Delete sprite
 </button>
 </div>
 </Details>
 );
}
