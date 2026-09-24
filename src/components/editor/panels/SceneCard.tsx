'use client';

import { useRef } from 'react';

import { ANIMS, CAMERAS, DEFAULT_COUNTER, DURS, EFFECTS, GESTURES, LAYOUTS } from '@/engine/constants';
import { resolveStyle } from '@/engine/render';
import type { ClassicSlide, CounterConfig, CounterFormat, Effect, ImageSlide, Slide } from '@/engine/types';
import { assetSrc, loadImageFile, newAssetId } from '@/lib/assetSrc';
import { isPro, PRO_ONLY_EFFECTS } from '@/lib/plan';
import { createClient } from '@/lib/supabase/client';
import { uploadAsset } from '@/lib/supabase/storage';
import { useEditorStore } from '@/store/editorStore';
import { usePlayback } from '../PlaybackContext';
import StyleEditor from '../StyleEditor';
import { KEYS_IMAGE, KEYS_TEXT } from '../styleFields';
import { sceneStart } from '../timelineHelpers';
import Details from '../ui/Details';
import CutoutsEditor from './CutoutsEditor';
import StorySceneEditor from './story/StorySceneEditor';

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

  if (slide.kind === 'story') {
    return (
      <div className="mb-2.5 rounded-2xl bg-neutral-100 p-3 dark:bg-neutral-800/60">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <span className="text-[15px] font-extrabold whitespace-nowrap">Story slide {index + 1}</span>
          <div className="flex flex-wrap justify-end gap-1">
            <button disabled={index === 0} onClick={() => moveSlide(slide.id, -1)} aria-label="Move slide up" className="rounded-lg border border-black/10 bg-white px-2 py-1 text-[12.5px] font-semibold disabled:opacity-35 dark:border-white/10 dark:bg-neutral-800">
              ↑
            </button>
            <button disabled={index === count - 1} onClick={() => moveSlide(slide.id, 1)} aria-label="Move slide down" className="rounded-lg border border-black/10 bg-white px-2 py-1 text-[12.5px] font-semibold disabled:opacity-35 dark:border-white/10 dark:bg-neutral-800">
              ↓
            </button>
            <button onClick={() => duplicateSlide(slide.id)} className="rounded-lg border border-black/10 bg-white px-2 py-1 text-[12.5px] font-semibold dark:border-white/10 dark:bg-neutral-800">
              Duplicate
            </button>
            <button onClick={() => removeSlide(slide.id)} className="rounded-lg border border-black/10 bg-white px-2 py-1 text-[12.5px] font-semibold text-red-600 dark:border-white/10 dark:bg-neutral-800">
              Delete
            </button>
          </div>
        </div>
        <StorySceneEditor slide={slide} />
      </div>
    );
  }

  const isText = slide.kind === 'text';
  const image = slide.kind === 'image' ? slide : null;
  const img = image?.imgAssetId ? assets.images[image.imgAssetId] : null;
  const pick = !isText && !!image && (image.anim === 'spotlight' || image.gesture !== 'none' || !!image.callout);
  const style = resolveStyle(project, slide);
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
    if (!file || !image) return;
    const { image: newImage } = await loadImageFile(file);
    const assetId = newAssetId('img');
    replaceSlideImage(slide.id, assetId, newImage);
    if (projectId) uploadAsset(createClient(), projectId, assetId, file).catch((err) => console.error('[assets] upload failed', err));
    seek(start + 1.4);
  };

  return (
    <div className="mb-2.5 rounded-2xl bg-neutral-100 p-3 dark:bg-neutral-800/60">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="font-[family-name:var(--font-display,inherit)] text-[15px] font-extrabold whitespace-nowrap">
          {isText ? 'Text slide' : 'Slide'} {index + 1}
        </span>
        <div className="flex flex-wrap justify-end gap-1">
          <button disabled={index === 0} onClick={() => moveSlide(slide.id, -1)} aria-label="Move slide up" className="rounded-lg border border-black/10 bg-white px-2 py-1 text-[12.5px] font-semibold disabled:opacity-35 dark:border-white/10 dark:bg-neutral-800">
            ↑
          </button>
          <button disabled={index === count - 1} onClick={() => moveSlide(slide.id, 1)} aria-label="Move slide down" className="rounded-lg border border-black/10 bg-white px-2 py-1 text-[12.5px] font-semibold disabled:opacity-35 dark:border-white/10 dark:bg-neutral-800">
            ↓
          </button>
          <button onClick={() => duplicateSlide(slide.id)} className="rounded-lg border border-black/10 bg-white px-2 py-1 text-[12.5px] font-semibold dark:border-white/10 dark:bg-neutral-800">
            Duplicate
          </button>
          <button onClick={() => removeSlide(slide.id)} className="rounded-lg border border-black/10 bg-white px-2 py-1 text-[12.5px] font-semibold text-red-600 dark:border-white/10 dark:bg-neutral-800">
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[auto_1fr] items-start gap-3.5">
        {isText ? (
          <div
            onClick={onThumbClick}
            style={{ background: `linear-gradient(150deg, ${style.colors.a}, ${style.colors.b})`, color: style.colors.text }}
            className="grid h-[150px] w-[84px] cursor-pointer place-items-center rounded-xl text-3xl font-extrabold"
          >
            Aa
          </div>
        ) : (
          <div onClick={onThumbClick} className={`relative inline-block overflow-hidden rounded-xl bg-black leading-none ${pick ? 'cursor-crosshair' : 'cursor-pointer'}`}>
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element -- in-memory/data-URL asset, not a static/remote file Next's Image optimizer can handle
              <img src={assetSrc(img)} alt={`Screenshot for slide ${index + 1}`} className="h-[150px] w-auto max-w-[90px] object-contain" />
            ) : (
              <div className="grid h-[150px] w-[84px] place-items-center text-xs text-neutral-400">No image</div>
            )}
            {pick && image && (
              <span
                style={{ left: `${image.focus.x * 100}%`, top: `${image.focus.y * 100}%` }}
                className="pointer-events-none absolute h-[22px] w-[22px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[#FFD23F] shadow-[0_0_0_2px_rgba(0,0,0,.45)]"
              />
            )}
          </div>
        )}

        <div className="grid min-w-0 gap-2.5">
          <label className="block text-[12.5px] font-semibold text-neutral-500 dark:text-neutral-400">
            Headline
            <input
              type="text"
              value={slide.headline}
              onChange={(e) => setF('headline', e.target.value)}
              onFocus={() => seek(start + Math.min(2, slide.dur - 0.5))}
              className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-[14.5px] dark:border-white/10 dark:bg-neutral-800"
            />
          </label>
          <label className="block text-[12.5px] font-semibold text-neutral-500 dark:text-neutral-400">
            Subtitle
            <input
              type="text"
              value={slide.sub}
              placeholder="Optional"
              onChange={(e) => setF('sub', e.target.value)}
              onFocus={() => seek(start + Math.min(2, slide.dur - 0.5))}
              className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-[14.5px] dark:border-white/10 dark:bg-neutral-800"
            />
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <label className="block text-[12.5px] font-semibold text-neutral-500 dark:text-neutral-400">
              Length
              <select
                value={slide.dur}
                onChange={(e) => setF('dur', Number(e.target.value))}
                className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-[14.5px] dark:border-white/10 dark:bg-neutral-800"
              >
                {DURS.map((d) => (
                  <option key={d} value={d}>
                    {d}s
                  </option>
                ))}
              </select>
            </label>
            {!isText && (
              <button onClick={() => replaceInputRef.current?.click()} className="self-end pb-2.5 text-left text-[13px] font-bold text-indigo-600 dark:text-indigo-400">
                Replace screenshot
              </button>
            )}
            <input ref={replaceInputRef} type="file" accept="image/*" className="hidden" onChange={onReplace} />
          </div>
        </div>
      </div>

      <Details summary="Motion and effects">
        {isText ? (
          <TextEffectsFields slide={slide} setF={setF} lockedEffects={lockedEffects} />
        ) : (
          image && <ImageEffectsFields slide={image} pick={pick} setF={setF} lockedEffects={lockedEffects} />
        )}
      </Details>

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
      <div className="grid grid-cols-2 gap-2.5">
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
            <input
              type="text"
              value={slide.stickers}
              onChange={(e) => setF('stickers', e.target.value)}
              placeholder="Up to 5 emoji"
              className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-[14.5px] dark:border-white/10 dark:bg-neutral-800"
            />
          </Field>
        ) : (
          <span />
        )}
        <Field label="Callout">
          <input
            type="text"
            value={slide.callout}
            maxLength={28}
            onChange={(e) => setF('callout', e.target.value)}
            placeholder="Arrow label, e.g. Tap here"
            className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-[14.5px] dark:border-white/10 dark:bg-neutral-800"
          />
        </Field>
        <Field label="Badge">
          <input
            type="text"
            value={slide.badge}
            maxLength={18}
            onChange={(e) => setF('badge', e.target.value)}
            placeholder="New, 4.9 ★, Free"
            className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-[14.5px] dark:border-white/10 dark:bg-neutral-800"
          />
        </Field>
      </div>
      <label className="mt-2.5 flex items-center gap-2 text-[13.5px] font-semibold">
        <input type="checkbox" checked={slide.scroll} onChange={(e) => setF('scroll', e.target.checked)} className="h-[18px] w-[18px] accent-indigo-600" />
        Scroll through a tall screenshot
      </label>
      {pick && <p className="mt-1.5 text-[12.5px] text-neutral-500 dark:text-neutral-400">Tap the screenshot to set where the zoom, gesture or callout points.</p>}
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
    <div className="grid grid-cols-2 gap-2.5">
      <Field label="Camera">
        <Select value={slide.camera} onChange={(v) => setF('camera', v as ClassicSlide['camera'])} options={CAMERAS} />
      </Field>
      <Field label="Effect">
        <Select value={slide.effect} onChange={(v) => setF('effect', v as ClassicSlide['effect'])} options={EFFECTS} disabledValues={lockedEffects} />
      </Field>
      {slide.effect === 'stickers' && (
        <Field label="Stickers">
          <input
            type="text"
            value={slide.stickers}
            onChange={(e) => setF('stickers', e.target.value)}
            placeholder="Up to 5 emoji"
            className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-[14.5px] dark:border-white/10 dark:bg-neutral-800"
          />
        </Field>
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
      <label className="flex items-center gap-2 text-[13.5px] font-semibold">
        <input type="checkbox" checked={!!counter} onChange={(e) => setF('counter', e.target.checked ? DEFAULT_COUNTER : null)} className="h-[18px] w-[18px] accent-indigo-600" />
        Add an animated count-up number
      </label>
      {counter && (
        <>
          <div className="grid grid-cols-2 gap-2.5">
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
                <input
                  type="text"
                  value={counter.currencySymbol}
                  maxLength={3}
                  onChange={(e) => patch({ currencySymbol: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-[14.5px] dark:border-white/10 dark:bg-neutral-800"
                />
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
          <p className="text-[12.5px] text-neutral-500 dark:text-neutral-400">
            Preview: <b>{formatPreview(counter)}</b>
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
      className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-[14.5px] dark:border-white/10 dark:bg-neutral-800"
    />
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-[12.5px] font-semibold text-neutral-500 dark:text-neutral-400">
      {label}
      {children}
    </label>
  );
}

function Select<T extends string>({ value, onChange, options, disabledValues }: { value: T; onChange: (v: T) => void; options: Array<[T, string]>; disabledValues?: Set<T> }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-[14.5px] dark:border-white/10 dark:bg-neutral-800"
    >
      {options.map(([v, label]) => {
        const locked = disabledValues?.has(v);
        return (
          <option key={v} value={v} disabled={locked}>
            {label}
            {locked ? ' (Pro)' : ''}
          </option>
        );
      })}
    </select>
  );
}
