'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';

import { BUILT_IN_LOTTIE_ICONS, parseLottieFile } from '@/engine2/lottieAssets';
import type { ParticleBurstDef, StickerIdle } from '@/engine2/types';
import { newAssetId } from '@/lib/assetSrc';
import { createClient } from '@/lib/supabase/client';
import { uploadAsset } from '@/lib/supabase/storage';
import { useEditorV2Store } from '@/store/editorV2Store';
import { buttonStyle, color, font, inputStyle, radius, sectionHeadingStyle, shadow, space } from './tokens';

const PARTICLE_KINDS: ParticleBurstDef['kind'][] = ['confetti', 'sparkles', 'hearts', 'stars', 'coins'];
const IDLE_OPTIONS: StickerIdle[] = ['none', 'bob', 'spin', 'wobble'];
/** Content kinds a cutout can crop from directly (its own live texture —
 * see sceneBuilder.ts's resolveCutoutSourceTexture). */
const CUTOUT_SOURCE_KINDS = new Set(['screenshot', 'video', 'lottie', 'ui-element']);

/**
 * Layout rebuild: every "create a new layer" action (screenshot, video,
 * lottie, sticker, cutout, particle burst) lives in one popover behind a
 * single "+ Add" button instead of MediaPanel's old permanent full-height
 * column — this is what used to be that panel, minus the parts that are
 * about the *selected* layer's own content (screenshot swap-in-place,
 * video trim/speed/freeze — those moved to Inspector.tsx's Layer tab,
 * "Content" section) and minus the *existing* particle bursts list (also
 * moved to Inspector.tsx, "Effects" section — this menu only ever adds a
 * new one). Cutout/particle buttons stay context-sensitive to the current
 * selection exactly as they were in MediaPanel.
 */
export default function AddMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const project = useEditorV2Store((s) => s.project);
  const projectId = useEditorV2Store((s) => s.projectId);
  const selectedIds = useEditorV2Store((s) => s.selectedIds);
  const playheadT = useEditorV2Store((s) => s.playheadT);
  const addLottieLayer = useEditorV2Store((s) => s.addLottieLayer);
  const addVideoLayer = useEditorV2Store((s) => s.addVideoLayer);
  const setVideoAssetId = useEditorV2Store((s) => s.setVideoAssetId);
  const addEmojiStickerLayer = useEditorV2Store((s) => s.addEmojiStickerLayer);
  const addImageStickerLayer = useEditorV2Store((s) => s.addImageStickerLayer);
  const addParticleBurstOnLayer = useEditorV2Store((s) => s.addParticleBurstOnLayer);
  const addCutoutFromLayer = useEditorV2Store((s) => s.addCutoutFromLayer);
  const addScreenshotLayer = useEditorV2Store((s) => s.addScreenshotLayer);

  const uploadInBackground = (assetId: string, file: File | Blob) => {
    if (!projectId) return;
    uploadAsset(createClient(), projectId, assetId, file).catch((err) => console.error('[assets] upload failed', err));
  };

  const [emoji, setEmoji] = useState('✨');
  const [idle, setIdle] = useState<StickerIdle>('bob');
  const [lottieError, setLottieError] = useState('');
  const lottieInputRef = useRef<HTMLInputElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const pngInputRef = useRef<HTMLInputElement>(null);

  const onLottieFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLottieError('');
    try {
      const data = await parseLottieFile(file);
      addLottieLayer(data, file.name.replace(/\.(json|lottie)$/i, ''));
    } catch (err) {
      setLottieError(err instanceof Error ? err.message : 'Could not read that file.');
    }
  };

  const onVideoFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const url = URL.createObjectURL(file);
    const layerId = addVideoLayer(url, file.name.replace(/\.\w+$/, ''));
    const assetId = newAssetId('video');
    uploadInBackground(assetId, file);
    setVideoAssetId(layerId, assetId);
  };

  const onPngFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    await img.decode();
    const slotId = newAssetId('sticker-img');
    addImageStickerLayer(slotId, img, file.name.replace(/\.\w+$/, ''), idle);
    uploadInBackground(slotId, file);
  };

  const onScreenshotFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    await img.decode();
    const { slotId } = addScreenshotLayer(img, file.name.replace(/\.\w+$/, ''));
    uploadInBackground(slotId, file);
  };

  const selectedLayer = project?.layers.find((l) => selectedIds.length === 1 && l.id === selectedIds[0]);
  const canCutoutFromSelection = !!selectedLayer && CUTOUT_SOURCE_KINDS.has(selectedLayer.content.kind);

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button onClick={() => setOpen((v) => !v)} style={buttonStyle(open)}>
        + Add
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: space.sm,
            width: 280,
            maxHeight: 480,
            overflowY: 'auto',
            background: color.surface,
            border: `1px solid ${color.border}`,
            borderRadius: radius.md,
            boxShadow: shadow.panel,
            padding: space.md,
            display: 'grid',
            gap: space.lg,
            zIndex: 50,
          }}
        >
          <section>
            <h3 style={sectionHeadingStyle}>Screenshot</h3>
            <button style={buttonStyle()} onClick={() => screenshotInputRef.current?.click()}>
              Upload screenshot
            </button>
            <input ref={screenshotInputRef} type="file" accept="image/*" hidden onChange={onScreenshotFile} />
          </section>

          <section>
            <h3 style={sectionHeadingStyle}>Lottie</h3>
            <div style={{ display: 'flex', gap: space.sm, flexWrap: 'wrap', marginBottom: space.sm }}>
              <button style={buttonStyle()} onClick={() => lottieInputRef.current?.click()}>
                Upload .json / .lottie
              </button>
              <input ref={lottieInputRef} type="file" accept=".json,.lottie,application/json,application/zip" hidden onChange={onLottieFile} />
            </div>
            {lottieError && (
              <p style={{ fontSize: font.sm, color: color.danger, margin: '0 0 6px' }}>{lottieError}</p>
            )}
            <div style={{ fontSize: font.xs, opacity: 0.55, marginBottom: 4 }}>Built-in icons</div>
            <div style={{ display: 'flex', gap: space.sm, flexWrap: 'wrap' }}>
              {BUILT_IN_LOTTIE_ICONS.map((icon) => (
                <button key={icon.id} style={buttonStyle()} title={`License: ${icon.license.kind}`} onClick={() => addLottieLayer(icon.data, icon.label)}>
                  {icon.label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 style={sectionHeadingStyle}>Video</h3>
            <button style={buttonStyle()} onClick={() => videoInputRef.current?.click()}>
              Upload a screen recording
            </button>
            <input ref={videoInputRef} type="file" accept="video/*" hidden onChange={onVideoFile} />
          </section>

          <section>
            <h3 style={sectionHeadingStyle}>Sticker</h3>
            <div style={{ display: 'flex', gap: space.sm, alignItems: 'center', marginBottom: space.sm }}>
              <input type="text" value={emoji} maxLength={4} onChange={(e) => setEmoji(e.target.value)} style={{ ...inputStyle, width: 50 }} />
              <select value={idle} onChange={(e) => setIdle(e.target.value as StickerIdle)} style={inputStyle}>
                {IDLE_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              <button style={buttonStyle()} onClick={() => addEmojiStickerLayer(emoji, idle)}>
                Add
              </button>
            </div>
            <button style={buttonStyle()} onClick={() => pngInputRef.current?.click()}>
              Upload PNG sticker
            </button>
            <input ref={pngInputRef} type="file" accept="image/png,image/webp" hidden onChange={onPngFile} />
          </section>

          <section>
            <h3 style={sectionHeadingStyle}>Cutout</h3>
            {canCutoutFromSelection ? (
              <button style={buttonStyle()} onClick={() => addCutoutFromLayer(selectedLayer!.id)}>
                Cut out &ldquo;{selectedLayer!.label}&rdquo;
              </button>
            ) : (
              <p style={{ fontSize: font.sm, opacity: 0.5 }}>Select a screenshot, video, Lottie or UI layer to lift a crop of it out.</p>
            )}
          </section>

          <section>
            <h3 style={sectionHeadingStyle}>Particles</h3>
            {selectedIds.length !== 1 ? (
              <p style={{ fontSize: font.sm, opacity: 0.5 }}>Select one layer to anchor a burst to it.</p>
            ) : (
              <div style={{ display: 'flex', gap: space.sm, flexWrap: 'wrap' }}>
                {PARTICLE_KINDS.map((k) => (
                  <button key={k} style={buttonStyle()} onClick={() => addParticleBurstOnLayer(selectedIds[0], k, playheadT, Math.floor(Math.random() * 999))}>
                    {k}
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
