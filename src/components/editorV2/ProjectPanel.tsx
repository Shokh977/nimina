'use client';

import { useRef, useState, type ChangeEvent } from 'react';

import { listCameraPresets } from '@/engine2/cameraPresets';
import { FCOLORS, MODELS, type ModelKey } from '@/engine2/deviceFrame';
import { applyExtractedTheme, PALS, type PaletteId } from '@/engine2/palettes';
import { generateVariations } from '@/engine2/remix';
import { listRecipes, type RecipeContent } from '@/engine2/recipes';
import { STYLES, type StyleId } from '@/engine2/styles';
import { extractPalette } from '@/engine2/ui-kit/paletteExtractor';
import { newAssetId } from '@/lib/assetSrc';
import { createClient } from '@/lib/supabase/client';
import { uploadAsset } from '@/lib/supabase/storage';
import { useEditorV2Store } from '@/store/editorV2Store';
import { buttonStyle, color, inputStyle, sectionHeadingStyle } from './tokens';

const STYLE_IDS = Object.keys(STYLES) as StyleId[];
const PALETTE_IDS = (Object.keys(PALS) as PaletteId[]).filter((id) => id !== 'custom');
const MODEL_IDS = Object.keys(MODELS) as ModelKey[];
const CAMERA_PRESETS = listCameraPresets();

const btn = buttonStyle();
const btnActive = buttonStyle(true);
const heading = sectionHeadingStyle;
const textarea = { ...inputStyle, resize: 'vertical' as const, minHeight: 44 };

/** Project-level settings (Tier 1): output format, motion style, color
 * palette (+ extract-from-screenshot), the three text slots (two headline
 * beats + the CTA label, with a hint about the *stars* highlight syntax
 * every headline already supports — see text.ts's parseHeadline), music,
 * and Remix. Distinct from AddMenu (which adds individual layers) and
 * LayerInspector/PresetsPanel (which edit the selected layer's motion) —
 * everything here edits the project as a whole. */
export default function ProjectPanel() {
  const project = useEditorV2Store((s) => s.project);
  const projectId = useEditorV2Store((s) => s.projectId);
  const assets = useEditorV2Store((s) => s.assets);
  const setStyle = useEditorV2Store((s) => s.setStyle);
  const setPalette = useEditorV2Store((s) => s.setPalette);
  const setGrainIntensity = useEditorV2Store((s) => s.setGrainIntensity);
  const setBloomStrength = useEditorV2Store((s) => s.setBloomStrength);
  const setVignetteIntensity = useEditorV2Store((s) => s.setVignetteIntensity);
  const setDevice = useEditorV2Store((s) => s.setDevice);
  const setAppName = useEditorV2Store((s) => s.setAppName);
  const setText = useEditorV2Store((s) => s.setText);
  const playheadT = useEditorV2Store((s) => s.playheadT);
  const applyCameraPreset = useEditorV2Store((s) => s.applyCameraPreset);
  const [cameraTargetId, setCameraTargetId] = useState<string>('');
  const music = useEditorV2Store((s) => s.music);
  const musicVolume = useEditorV2Store((s) => s.musicVolume);
  const setMusic = useEditorV2Store((s) => s.setMusic);
  const setMusicVolume = useEditorV2Store((s) => s.setMusicVolume);
  const setMusicAssetId = useEditorV2Store((s) => s.setMusicAssetId);
  const applyRemix = useEditorV2Store((s) => s.applyRemix);

  const [extracting, setExtracting] = useState(false);
  const [remixing, setRemixing] = useState(false);
  const [remixError, setRemixError] = useState('');
  const extractInputRef = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);

  if (!project) return null;

  const onExtractFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setExtracting(true);
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      await img.decode();
      const theme = extractPalette(img);
      applyExtractedTheme(theme);
      setPalette('custom');
    } finally {
      setExtracting(false);
    }
  };

  const onMusicFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const buf = await file.arrayBuffer();
    const ctx = new AudioContext();
    const buffer = await ctx.decodeAudioData(buf);
    setMusic({ buffer, name: file.name });
    const assetId = newAssetId('music');
    setMusicAssetId(assetId);
    if (projectId) uploadAsset(createClient(), projectId, assetId, file).catch((err) => console.error('[assets] upload failed', err));
  };

  // Harvests real screenshot content already in the project (uploaded via
  // the + Add menu's Screenshot section) into the RecipeContent recipes need —
  // Remix has nothing to compose from without at least one of these, since
  // recipes always build from `ctx.content.screenshots`, never their own
  // placeholder pixels (recipes.ts's header comment).
  const screenshotContent = (): RecipeContent => {
    const shots = project.layers
      .filter((l) => l.content.kind === 'screenshot')
      .map((l) => (l.content.kind === 'screenshot' ? { id: l.content.slotId, image: assets[l.content.slotId] } : null))
      .filter((s): s is { id: string; image: NonNullable<(typeof assets)[string]> } => !!s?.image);
    return { screenshots: shots, texts: project.texts, appName: undefined };
  };

  const eligibleRecipes = listRecipes().filter((r) => screenshotContent().screenshots.length >= r.minScreenshots);

  const runRemix = (recipeId: string) => {
    setRemixError('');
    const content = screenshotContent();
    const recipe = listRecipes().find((r) => r.id === recipeId);
    if (!recipe || content.screenshots.length < recipe.minScreenshots) {
      setRemixError(`This recipe needs at least ${recipe?.minScreenshots ?? 1} screenshot(s) — upload one first (+ Add → Screenshot).`);
      return;
    }
    setRemixing(true);
    try {
      const [variant] = generateVariations({ recipeId, content, seed: project.seed + 1, paletteId: project.paletteId, styleId: project.styleId, locks: {} }, 1);
      applyRemix({ ...variant, format: project.format });
    } catch (err) {
      setRemixError(err instanceof Error ? err.message : 'Remix failed.');
    } finally {
      setRemixing(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section>
        <h3 style={heading}>Motion style</h3>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STYLE_IDS.map((id) => (
            <button key={id} style={project.styleId === id ? btnActive : btn} onClick={() => setStyle(id)}>
              {STYLES[id].label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 style={heading}>Palette</h3>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {PALETTE_IDS.map((id) => (
            <button key={id} style={{ ...(project.paletteId === id ? btnActive : btn), display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setPalette(id)}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: PALS[id].accent, display: 'inline-block', border: '1px solid rgba(255,255,255,0.3)' }} />
              {PALS[id].label}
            </button>
          ))}
          {project.paletteId === 'custom' && (
            <button style={btnActive}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: PALS.custom.accent, display: 'inline-block', border: '1px solid rgba(255,255,255,0.3)', marginRight: 6 }} />
              Custom
            </button>
          )}
        </div>
        <button style={btn} onClick={() => extractInputRef.current?.click()} disabled={extracting}>
          {extracting ? 'Extracting…' : 'Extract palette from screenshot'}
        </button>
        <input ref={extractInputRef} type="file" accept="image/*" hidden onChange={onExtractFile} />
      </section>

      <section>
        <h3 style={heading}>Device frame</h3>
        <p style={{ fontSize: 10.5, opacity: 0.5, margin: '0 0 6px' }}>Default for every screenshot — override a single one from its layer row in the Layers panel.</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          <button style={!project.device ? btnActive : btn} onClick={() => setDevice(null)}>
            No frame
          </button>
          {MODEL_IDS.map((id) => (
            <button
              key={id}
              style={project.device?.model === id ? btnActive : btn}
              onClick={() => setDevice({ model: id, frameColor: project.device?.frameColor ?? 'graphite' })}
            >
              {MODELS[id].label}
            </button>
          ))}
        </div>
        {project.device && (
          <>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {FCOLORS.map((c) => (
                <button
                  key={c.id}
                  title={c.label}
                  onClick={() => setDevice({ model: project.device!.model, frameColor: c.id })}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    padding: 0,
                    cursor: 'pointer',
                    background: c.id === 'theme' ? PALS[project.paletteId].accent : c.body,
                    border: project.device?.frameColor === c.id ? `2px solid ${color.accent}` : '1px solid rgba(255,255,255,0.25)',
                  }}
                />
              ))}
            </div>
            {project.device.model === 'browser' && (
              <label style={{ fontSize: 10.5, opacity: 0.6, display: 'block' }}>
                App name (shown in the url bar)
                <input
                  value={project.appName ?? ''}
                  onChange={(e) => setAppName(e.target.value)}
                  placeholder="app"
                  style={{ ...textarea, minHeight: 'auto' }}
                />
              </label>
            )}
          </>
        )}
      </section>

      <section>
        <h3 style={heading}>Camera</h3>
        <label style={{ fontSize: 10.5, opacity: 0.6, display: 'block', marginBottom: 8 }}>
          Target (which layer a preset moves toward)
          <select value={cameraTargetId} onChange={(e) => setCameraTargetId(e.target.value)} style={{ ...textarea, minHeight: 'auto', marginTop: 4 }}>
            <option value="">No target — aim at current rest point</option>
            {project.layers.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CAMERA_PRESETS.map((p) => {
            const disabled = p.needsTarget && !cameraTargetId;
            return (
              <button
                key={p.id}
                title={disabled ? 'Pick a target above first.' : p.description}
                disabled={disabled}
                onClick={() => applyCameraPreset(p.id, cameraTargetId || null, playheadT)}
                style={{ ...btn, opacity: disabled ? 0.4 : 1, cursor: disabled ? 'default' : 'pointer' }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h3 style={heading}>Text</h3>
        <div style={{ display: 'grid', gap: 8 }}>
          <label style={{ fontSize: 10.5, opacity: 0.6 }}>
            Headline 1
            <textarea style={textarea} value={project.texts[0]} onChange={(e) => setText(0, e.target.value)} />
          </label>
          <label style={{ fontSize: 10.5, opacity: 0.6 }}>
            Headline 2
            <textarea style={textarea} value={project.texts[1]} onChange={(e) => setText(1, e.target.value)} />
          </label>
          <label style={{ fontSize: 10.5, opacity: 0.6 }}>
            CTA button
            <textarea style={{ ...textarea, minHeight: 32 }} value={project.texts[2]} onChange={(e) => setText(2, e.target.value)} />
          </label>
        </div>
        <p style={{ fontSize: 10.5, opacity: 0.5, margin: '6px 0 0' }}>
          Wrap words in *stars* to highlight them, e.g. <code>Meet *YourApp*</code>.
        </p>
      </section>

      <section>
        <h3 style={heading}>Music</h3>
        <button style={btn} onClick={() => musicInputRef.current?.click()}>
          {music ? `Replace "${music.name}"` : 'Upload music'}
        </button>
        <input ref={musicInputRef} type="file" accept="audio/*" hidden onChange={onMusicFile} />
        {music && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 11, opacity: 0.7, display: 'flex', justifyContent: 'space-between' }}>
              <span>{music.name}</span>
              <button
                onClick={() => {
                  setMusic(null);
                  setMusicAssetId(null);
                }}
                style={{ background: 'none', border: 0, color: '#ff8a8a', cursor: 'pointer', fontSize: 11 }}
              >
                Remove
              </button>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
              Volume
              <input type="range" min={0} max={1} step={0.01} value={musicVolume} onChange={(e) => setMusicVolume(Number(e.target.value))} style={{ flex: 1 }} />
              <span style={{ width: 32, textAlign: 'right' }}>{Math.round(musicVolume * 100)}%</span>
            </label>
          </div>
        )}
      </section>

      <section>
        <h3 style={heading}>Effects</h3>
        {(
          [
            ['grainIntensity', 'Grain', 0, 0.15, 0.04, setGrainIntensity],
            ['bloomStrength', 'Bloom', 0, 0.6, 0.22, setBloomStrength],
            ['vignetteIntensity', 'Vignette', 0, 1, 0, setVignetteIntensity],
          ] as const
        ).map(([key, label, min, max, def, setter]) => {
          const value = project[key] ?? def;
          return (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, marginBottom: 6 }}>
              <span style={{ width: 56, flex: 'none', opacity: 0.75 }}>{label}</span>
              <input type="range" min={min} max={max} step={max / 100} value={value} onChange={(e) => setter(Number(e.target.value))} style={{ flex: 1 }} />
              <span style={{ width: 34, textAlign: 'right', fontVariantNumeric: 'tabular-nums', opacity: 0.75 }}>{Math.round((value / max) * 100)}%</span>
            </label>
          );
        })}
      </section>

      <section>
        <h3 style={heading}>Remix</h3>
        {eligibleRecipes.length === 0 ? (
          <p style={{ fontSize: 11, opacity: 0.5 }}>Upload at least one screenshot (+ Add → Screenshot) to generate a fresh layout/palette/motion variation from it.</p>
        ) : (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {eligibleRecipes.map((r) => (
              <button key={r.id} style={btn} title={r.description} onClick={() => runRemix(r.id)} disabled={remixing}>
                {remixing ? 'Remixing…' : r.label}
              </button>
            ))}
          </div>
        )}
        {remixError && <p style={{ fontSize: 11, color: '#ff8a8a', margin: '6px 0 0' }}>{remixError}</p>}
      </section>
    </div>
  );
}
