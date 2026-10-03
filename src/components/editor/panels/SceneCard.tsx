'use client';

import { useRef } from 'react';

import { ANIMS, CAMERAS, DEFAULT_COUNTER, DURS, EFFECTS, GESTURES, LAYOUTS, MOTION3D, POSE_PRESETS, PRESETS } from '@/engine/constants';
import type { ClassicSlide, CounterConfig, CounterFormat, Effect, ImageSlide, Pose3D, PosePresetKey, Slide } from '@/engine/types';
import { assetSrc, loadImageFile, newAssetId } from '@/lib/assetSrc';
import { isPro, PRO_ONLY_EFFECTS } from '@/lib/plan';
import { rejectUpload, uploadAsset } from '@/lib/storage/assets';
import { useEditorStore } from '@/store/editorStore';
import { usePlayback } from '../PlaybackContext';
import StyleEditor from '../StyleEditor';
import { KEYS_IMAGE, KEYS_TEXT } from '../styleFields';
import { sceneStart } from '../timelineHelpers';
import Details from '../ui/Details';
import RangeInput from '../ui/RangeInput';
import SectionLabel from '../ui/SectionLabel';
import SegmentedControl from '../ui/SegmentedControl';
import SwatchGrid from '../ui/SwatchGrid';
import ToggleRow from '../ui/ToggleRow';
import CutoutsEditor from './CutoutsEditor';
import StorySceneEditor from './story/StorySceneEditor';
import VideoClipEditor from './VideoClipEditor';

const GHOST_BTN = 'grid h-9 w-9 place-items-center rounded-[10px] border border-white/[.12] bg-white/[.03] text-[13px] font-semibold text-[#c9cdd8] transition-colors duration-[.16s] hover:bg-white/[.08] disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]';
const DESTRUCTIVE_BTN = 'w-full rounded-[10px] border border-[#ff7a59]/[.28] bg-[#ff7a59]/[.07] px-4 py-2.5 text-[13.5px] font-semibold text-[#ff8f76] transition-colors duration-[.16s] hover:bg-[#ff7a59]/[.16] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]';

const DUR_OPTIONS: Array<[string, string]> = DURS.map((d) => [String(d), `${d}s`]);
const BG_SWATCHES = PRESETS.map((p, i) => ({ id: String(i), background: `linear-gradient(150deg, ${p.a}, ${p.b})`, label: p.name }));

export default function SceneCard({ slide, index, count }: { slide: Slide; index: number; count: number }) {
  const project = useEditorStore((s) => s.project);
  const assets = useEditorStore((s) => s.assets);
  const projectId = useEditorStore((s) => s.projectId);
  const plan = useEditorStore((s) => s.plan);
  const lockedEffects: Set<Effect> | undefined = isPro(plan) ? undefined : new Set(PRO_ONLY_EFFECTS);
  const updateSlide = useEditorStore((s) => s.updateSlide);
  const removeSlide = useEditorStore((s) => s.removeSlide);
  const duplicateSlide = useEditorStore((s) => s.duplicateSlide);
  const moveSlide = useEditorStore((s) => s.moveSlide);
  const setSlideStyle = useEditorStore((s) => s.setSlideStyle);
  const resetSlideStyle = useEditorStore((s) => s.resetSlideStyle);
  const applyStyleToAll = useEditorStore((s) => s.applyStyleToAll);
  const replaceSlideImage = useEditorStore((s) => s.replaceSlideImage);
  const { seek, playFrom } = usePlayback();
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const moveRow = (
    <div className="flex justify-end gap-1.5">
      <button disabled={index === 0} onClick={() => moveSlide(slide.id, -1)} aria-label="Move slide up" className={GHOST_BTN}>
        ↑
      </button>
      <button disabled={index === count - 1} onClick={() => moveSlide(slide.id, 1)} aria-label="Move slide down" className={GHOST_BTN}>
        ↓
      </button>
      <button onClick={() => duplicateSlide(slide.id)} aria-label="Duplicate slide" title="Duplicate" className={GHOST_BTN}>
        ⧉
      </button>
    </div>
  );

  if (slide.kind === 'story') {
    return (
      <div className="grid grid-cols-1 gap-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13.5px] font-semibold text-[#f4f5f8]">Story slide {index + 1}</span>
          {moveRow}
        </div>
        <StorySceneEditor slide={slide} />
        <button onClick={() => removeSlide(slide.id)} className={DESTRUCTIVE_BTN}>
          Delete slide
        </button>
      </div>
    );
  }

  const isText = slide.kind === 'text';
  const isVideo = slide.kind === 'video';
  const image = slide.kind === 'image' ? slide : null;
  // A video slide shares the image slide's device/motion settings.
  const deviceSlide = slide.kind === 'image' ? slide : slide.kind === 'video' ? (slide as unknown as ImageSlide) : null;
  const img = image?.imgAssetId ? assets.images[image.imgAssetId] : null;
  const pick = !isText && !!image && (image.anim === 'spotlight' || image.gesture !== 'none' || !!image.callout);
  const start = sceneStart(project, slide.id);

  const setF = <K extends keyof ClassicSlide>(key: K, value: ClassicSlide[K]) => updateSlide(slide.id, { [key]: value } as Partial<ClassicSlide>);

  const onThumbClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!pick || !image) {
      if (!isText) seek(start + Math.min(1.6, slide.dur - 0.5));
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    setF('focus', { x, y });
    if (image.gesture !== 'none') playFrom(start + slide.dur * 0.42 - 0.6);
    else seek(start + (image.anim === 'spotlight' ? slide.dur - 0.6 : Math.min(2.2, slide.dur - 0.4)));
  };

  const onReplace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !image || rejectUpload(file, projectId)) return;
    const { image: newImage } = await loadImageFile(file);
    const assetId = newAssetId('img');
    replaceSlideImage(slide.id, assetId, newImage);
    if (projectId) uploadAsset(projectId, assetId, file).catch((err) => console.error('[assets] upload failed', err));
    seek(start + 1.4);
  };

  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13.5px] font-semibold text-[#f4f5f8]">
          {isText ? 'Text slide' : isVideo ? 'Recording' : 'Slide'} {index + 1}
        </span>
        {moveRow}
      </div>

      {slide.kind === 'video' && <VideoClipEditor slide={slide} />}

      {!isText && !isVideo && (
        <div onClick={onThumbClick} className={`relative inline-block w-full overflow-hidden rounded-xl bg-black/40 leading-none ${pick ? 'cursor-crosshair' : 'cursor-pointer'}`}>
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element -- in-memory/data-URL asset, not a static/remote file Next's Image optimizer can handle
            <img src={assetSrc(img)} alt={`Screenshot for slide ${index + 1}`} className="mx-auto h-[140px] w-auto max-w-full object-contain" />
          ) : (
            <div className="grid h-[140px] place-items-center text-[12.5px] text-[#6d7484]">No image</div>
          )}
          {pick && image && (
            <span
              style={{ left: `${image.focus.x * 100}%`, top: `${image.focus.y * 100}%` }}
              className="pointer-events-none absolute h-[22px] w-[22px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[#ffd166] shadow-[0_0_0_2px_rgba(0,0,0,.45)]"
            />
          )}
        </div>
      )}

      <label className="block">
        <SectionLabel trailing={<span className="text-[11.5px] font-normal text-[#5f6675]">{index + 1} / 42</span>}>Headline</SectionLabel>
        <input
          type="text"
          value={slide.headline}
          onChange={(e) => setF('headline', e.target.value)}
          onFocus={() => seek(start + Math.min(2, slide.dur - 0.5))}
          className="block h-10 w-full rounded-[10px] border border-white/[.12] bg-white/[.03] px-3 text-[13.5px] text-[#f4f5f8] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]"
        />
      </label>

      <label className="block">
        <SectionLabel>Supporting line</SectionLabel>
        <textarea
          value={slide.sub}
          placeholder="Optional"
          rows={2}
          onChange={(e) => setF('sub', e.target.value)}
          onFocus={() => seek(start + Math.min(2, slide.dur - 0.5))}
          className="block w-full resize-none rounded-[10px] border border-white/[.12] bg-white/[.03] px-3 py-2 text-[13.5px] text-[#f4f5f8] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]"
        />
      </label>

      {!isVideo && (
        <div>
          <SectionLabel>Length</SectionLabel>
          <SegmentedControl scroll options={DUR_OPTIONS} value={String(slide.dur)} onChange={(v) => setF('dur', Number(v))} />
        </div>
      )}

      {!isText && (
        <div>
          <SectionLabel
            trailing={
              isVideo ? undefined : (
                <button onClick={() => replaceInputRef.current?.click()} className="text-[12px] font-semibold text-[#8b7dff] hover:text-[#a89bff]">
                  Replace screenshot
                </button>
              )
            }
          >
            Background
          </SectionLabel>
          <SwatchGrid items={BG_SWATCHES} value={slide.style.theme ?? ''} onChange={(id) => setSlideStyle(slide.id, 'theme', id)} size={42} shape="rounded" />
          <input ref={replaceInputRef} type="file" accept="image/*" className="hidden" onChange={onReplace} />
        </div>
      )}
      {isText && (
        <div>
          <SectionLabel>Background</SectionLabel>
          <SwatchGrid items={BG_SWATCHES} value={slide.style.theme ?? ''} onChange={(id) => setSlideStyle(slide.id, 'theme', id)} size={42} shape="rounded" />
        </div>
      )}

      {!isText && (
        <ToggleRow title="Show phone frame" checked={slide.style.model !== 'card'} onChange={(v) => setSlideStyle(slide.id, 'model', v ? undefined : 'card')} />
      )}

      <Details summary="Motion and effects">
        {isText ? <TextEffectsFields slide={slide} setF={setF} lockedEffects={lockedEffects} /> : deviceSlide && <ImageEffectsFields slide={deviceSlide} pick={pick} setF={setF} lockedEffects={lockedEffects} />}
      </Details>

      {deviceSlide && (
        <Details summary={`3D pose${deviceSlide.pose3d ? ' (on)' : ''}`}>
          <Pose3DFields slide={deviceSlide} setF={setF} />
        </Details>
      )}

      {image && (
        <Details summary={`Cutouts${image.cutouts.length ? ` (${image.cutouts.length})` : ''}`}>
          <CutoutsEditor slide={image} img={img} />
        </Details>
      )}

      {image && (
        <Details summary={`Counter${image.counter ? ' (on)' : ''}`}>
          <CounterEditor slide={image} setF={setF} />
        </Details>
      )}

      <StyleEditor
        title="Style for this slide"
        keys={isText ? KEYS_TEXT : KEYS_IMAGE}
        style={slide.style}
        onChange={(key, value) => {
          setSlideStyle(slide.id, key, value);
          playFrom(key === 'transition' ? Math.max(0, start - 0.7) : start);
        }}
        onReset={() => resetSlideStyle(slide.id)}
        onApplyAll={() => applyStyleToAll(slide.id)}
      />

      <button onClick={() => removeSlide(slide.id)} className={DESTRUCTIVE_BTN}>
        Delete slide
      </button>
    </div>
  );
}

function ImageEffectsFields({
  slide,
  pick,
  setF,
  lockedEffects,
}: {
  slide: ImageSlide;
  pick: boolean;
  setF: <K extends keyof ClassicSlide>(key: K, value: ClassicSlide[K]) => void;
  lockedEffects?: Set<Effect>;
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        <Field label="Device motion">
          <Select value={slide.anim} onChange={(v) => setF('anim', v as ImageSlide['anim'])} options={ANIMS} />
        </Field>
        <Field label="Camera">
          <Select value={slide.camera} onChange={(v) => setF('camera', v as ImageSlide['camera'])} options={CAMERAS} />
        </Field>
        <Field label="Gesture">
          <Select value={slide.gesture} onChange={(v) => setF('gesture', v as ImageSlide['gesture'])} options={GESTURES} />
        </Field>
        <Field label="Layout">
          <Select value={slide.layout} onChange={(v) => setF('layout', v as ImageSlide['layout'])} options={LAYOUTS} />
        </Field>
        <Field label="Effect">
          <Select value={slide.effect} onChange={(v) => setF('effect', v as ImageSlide['effect'])} options={EFFECTS} disabledValues={lockedEffects} />
        </Field>
        {slide.effect === 'stickers' ? (
          <Field label="Stickers">
            <input type="text" value={slide.stickers} onChange={(e) => setF('stickers', e.target.value)} placeholder="Up to 5 emoji" className={INPUT_CLASS} />
          </Field>
        ) : (
          <span />
        )}
        <Field label="Callout">
          <input type="text" value={slide.callout} maxLength={28} onChange={(e) => setF('callout', e.target.value)} placeholder="Arrow label, e.g. Tap here" className={INPUT_CLASS} />
        </Field>
        <Field label="Badge">
          <input type="text" value={slide.badge} maxLength={18} onChange={(e) => setF('badge', e.target.value)} placeholder="New, 4.9 ★, Free" className={INPUT_CLASS} />
        </Field>
      </div>
      <div className="mt-2.5">
        <ToggleRow title="Scroll through a tall screenshot" checked={slide.scroll} onChange={(v) => setF('scroll', v)} />
      </div>
      {pick && <p className="mt-1.5 text-[12px] text-[#767e8d]">Tap the screenshot to set where the zoom, gesture or callout points.</p>}
    </>
  );
}

function TextEffectsFields({
  slide,
  setF,
  lockedEffects,
}: {
  slide: ClassicSlide;
  setF: <K extends keyof ClassicSlide>(key: K, value: ClassicSlide[K]) => void;
  lockedEffects?: Set<Effect>;
}) {
  return (
    <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
      <Field label="Camera">
        <Select value={slide.camera} onChange={(v) => setF('camera', v as ClassicSlide['camera'])} options={CAMERAS} />
      </Field>
      <Field label="Effect">
        <Select value={slide.effect} onChange={(v) => setF('effect', v as ClassicSlide['effect'])} options={EFFECTS} disabledValues={lockedEffects} />
      </Field>
      {slide.effect === 'stickers' && (
        <Field label="Stickers">
          <input type="text" value={slide.stickers} onChange={(e) => setF('stickers', e.target.value)} placeholder="Up to 5 emoji" className={INPUT_CLASS} />
        </Field>
      )}
    </div>
  );
}

const POSE_PRESET_ENTRIES = Object.entries(POSE_PRESETS) as Array<[PosePresetKey, (typeof POSE_PRESETS)[PosePresetKey]]>;

/** 3D device pose — see src/engine/pose3d.ts and drawDevice3D in
 * src/engine/devices.ts. `pose3d: null` (the default) means "flat, exactly
 * like every other slide" — picking any preset here is what turns the 3D
 * renderer on for this slide; "Reset to flat" turns it back off entirely,
 * rather than just resetting to the Front preset's numbers. */
function Pose3DFields({ slide, setF }: { slide: ImageSlide; setF: <K extends keyof ClassicSlide>(key: K, value: ClassicSlide[K]) => void }) {
  const pose = slide.pose3d;
  const setPose = (partial: Partial<Pose3D>) => {
    if (!pose) return;
    setF('pose3d', { ...pose, ...partial });
  };

  return (
    <div className="grid gap-2.5">
      <div className="grid grid-cols-4 gap-1.5">
        {POSE_PRESET_ENTRIES.map(([key, preset]) => (
          <button
            key={key}
            type="button"
            aria-pressed={!!pose && pose.rx === preset.rx && pose.ry === preset.ry && pose.rz === preset.rz && pose.distance === preset.distance && pose.scale === preset.scale}
            onClick={() => setF('pose3d', { rx: preset.rx, ry: preset.ry, rz: preset.rz, distance: preset.distance, scale: preset.scale })}
            className="rounded-[10px] border border-white/[.12] bg-white/[.03] px-1.5 py-2 text-[11.5px] font-semibold text-[#c9cdd8] transition-colors duration-[.16s] hover:bg-white/[.08] aria-pressed:border-[#8b7dff]/60 aria-pressed:bg-[#5b4bff]/[.18] aria-pressed:text-[#cfc8ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {pose && (
        <>
          <Field label="Motion">
            <Select value={slide.motion3d} onChange={(v) => setF('motion3d', v as ImageSlide['motion3d'])} options={MOTION3D} />
          </Field>

          <Details summary="Advanced (manual pose)">
            <div className="grid gap-2.5">
              <RangeInput min={-60} max={60} step={0.5} value={pose.rx} onChange={(v) => setPose({ rx: v })} label="Rotate X" valueLabel={`${Math.round(pose.rx)}°`} />
              <RangeInput min={-180} max={180} step={0.5} value={pose.ry} onChange={(v) => setPose({ ry: v })} label="Rotate Y" valueLabel={`${Math.round(pose.ry)}°`} />
              <RangeInput min={-45} max={45} step={0.5} value={pose.rz} onChange={(v) => setPose({ rz: v })} label="Rotate Z" valueLabel={`${Math.round(pose.rz)}°`} />
              <RangeInput min={900} max={6000} step={10} value={pose.distance} onChange={(v) => setPose({ distance: v })} label="Perspective" valueLabel={Math.round(pose.distance)} />
              <RangeInput min={0.5} max={1.6} step={0.01} value={pose.scale} onChange={(v) => setPose({ scale: v })} label="Scale" valueLabel={`${pose.scale.toFixed(2)}×`} />
            </div>
          </Details>

          <button
            type="button"
            onClick={() => {
              setF('pose3d', null);
              setF('motion3d', 'none');
            }}
            className="text-left text-[12px] font-semibold text-[#8b7dff] hover:text-[#a89bff]"
          >
            Reset to flat (turn off 3D pose)
          </button>
        </>
      )}
    </div>
  );
}

const COUNTER_FORMATS: Array<[CounterFormat, string]> = [
  ['integer', 'Number'],
  ['currency', 'Currency'],
  ['percent', 'Percent'],
];
const EASING_OPTIONS: Array<[CounterConfig['easing'], string]> = [
  ['easeOutCubic', 'Ease out'],
  ['easeOutBack', 'Ease out (overshoot)'],
  ['easeInCubic', 'Ease in'],
  ['easeInOutCubic', 'Ease in-out'],
  ['linear', 'Linear'],
];

/** Animated count-up number overlay — see CounterConfig in engine/types.ts.
 * `null` (off) is the common case; enabling starts from DEFAULT_COUNTER and
 * every field below patches just that one property, same pattern as
 * StyleEditor's per-field onChange. */
function CounterEditor({ slide, setF }: { slide: ImageSlide; setF: <K extends keyof ClassicSlide>(key: K, value: ClassicSlide[K]) => void }) {
  const counter = slide.counter;
  const patch = (partial: Partial<CounterConfig>) => {
    if (!counter) return;
    setF('counter', { ...counter, ...partial });
  };

  return (
    <div className="grid gap-2.5">
      <ToggleRow title="Add an animated count-up number" checked={!!counter} onChange={(v) => setF('counter', v ? DEFAULT_COUNTER : null)} />
      {counter && (
        <>
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            <Field label="From">
              <NumberInput value={counter.from} onChange={(v) => patch({ from: v })} />
            </Field>
            <Field label="To">
              <NumberInput value={counter.to} onChange={(v) => patch({ to: v })} />
            </Field>
            <Field label="Format">
              <Select value={counter.format} onChange={(v) => patch({ format: v as CounterFormat })} options={COUNTER_FORMATS} />
            </Field>
            {counter.format === 'currency' ? (
              <Field label="Symbol">
                <input type="text" value={counter.currencySymbol} maxLength={3} onChange={(e) => patch({ currencySymbol: e.target.value })} className={INPUT_CLASS} />
              </Field>
            ) : (
              <span />
            )}
            <Field label="Decimal places">
              <NumberInput value={counter.decimals} min={0} max={4} step={1} onChange={(v) => patch({ decimals: Math.round(v) })} />
            </Field>
            <Field label="Duration (s)">
              <NumberInput value={counter.duration} min={0.1} step={0.1} onChange={(v) => patch({ duration: Math.max(0.1, v) })} />
            </Field>
            <Field label="Starts at (s into slide)">
              <NumberInput value={counter.at} min={0} step={0.1} onChange={(v) => patch({ at: Math.max(0, v) })} />
            </Field>
            <Field label="Easing">
              <Select value={counter.easing} onChange={(v) => patch({ easing: v as CounterConfig['easing'] })} options={EASING_OPTIONS} />
            </Field>
            <Field label="Position X (0-1)">
              <NumberInput value={counter.x} min={0} max={1} step={0.01} onChange={(v) => patch({ x: v })} />
            </Field>
            <Field label="Position Y (0-1)">
              <NumberInput value={counter.y} min={0} max={1} step={0.01} onChange={(v) => patch({ y: v })} />
            </Field>
          </div>
          <p className="text-[12px] text-[#767e8d]">
            Preview: <b className="text-[#c9cdd8]">{formatPreview(counter)}</b>
          </p>
        </>
      )}
    </div>
  );
}

function formatPreview(counter: CounterConfig): string {
  const decimals = counter.decimals;
  const num = counter.to.toFixed(decimals);
  if (counter.format === 'currency') return `${counter.currencySymbol}${num}`;
  if (counter.format === 'percent') return `${num}%`;
  return num;
}

const INPUT_CLASS = 'mt-1 block h-10 w-full rounded-[10px] border border-white/[.12] bg-white/[.03] px-3 text-[13.5px] text-[#f4f5f8] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]';

function NumberInput({ value, onChange, min, max, step = 1 }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const v = Number(e.target.value);
        if (!Number.isNaN(v)) onChange(v);
      }}
      className={INPUT_CLASS}
    />
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-[12px] font-semibold text-[#767e8d]">
      {label}
      {children}
    </label>
  );
}

function Select<T extends string>({ value, onChange, options, disabledValues }: { value: T; onChange: (v: T) => void; options: Array<[T, string]>; disabledValues?: Set<T> }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)} className={`${INPUT_CLASS} appearance-none`}>
      {options.map(([v, label]) => {
        const locked = disabledValues?.has(v);
        return (
          <option key={v} value={v} disabled={locked} className="bg-[#11131a] text-[#f4f5f8]">
            {label}
            {locked ? ' (Pro)' : ''}
          </option>
        );
      })}
    </select>
  );
}
