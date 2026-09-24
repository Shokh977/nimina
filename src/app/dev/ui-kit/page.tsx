'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';

import { PALS, type PaletteId } from '@/engine2/palettes';
import { deriveTheme, extractPalette, listElements, type AnyProps, type ExtractedTheme } from '@/engine2/ui-kit';

const PALETTE_IDS = Object.keys(PALS) as PaletteId[];

/**
 * /dev/ui-kit — the animated UI element kit's gallery (Prompt 4): every
 * registered element (src/engine2/ui-kit/elements/*.ts) animating live, a
 * theme switcher (any project Palette), a generic props panel driven by
 * each element's own propsSchema (this IS "editable in the inspector" —
 * a real Manual-level inspector would render the same schema), and a
 * screenshot palette-extractor demo.
 */
export default function UiKitGalleryPage() {
  const elements = useMemo(() => listElements(), []);
  const [paletteId, setPaletteId] = useState<PaletteId>('aurora');
  const theme = useMemo(() => deriveTheme(PALS[paletteId]), [paletteId]);
  const [propsByElement, setPropsByElement] = useState<Record<string, AnyProps>>(() => Object.fromEntries(elements.map((d) => [d.id, { ...d.defaultProps }])));
  const startRef = useRef(0);
  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});
  // The RAF loop below reads these refs every frame instead of closing over
  // `propsByElement`/`theme` state directly, so editing a prop or switching
  // the palette never needs to tear down and restart the loop. Refs are
  // written from an effect (never during render, which must stay pure) and
  // this one has no deps array so it re-syncs after every render.
  const propsRef = useRef(propsByElement);
  const themeRef = useRef(theme);
  useEffect(() => {
    propsRef.current = propsByElement;
    themeRef.current = theme;
  });

  useEffect(() => {
    startRef.current = performance.now();
    let raf = 0;
    const loop = () => {
      const t = (performance.now() - startRef.current) / 1000;
      for (const def of elements) {
        const canvas = canvasRefs.current[def.id];
        if (!canvas) continue;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const scale = canvas.width / def.naturalSize.w;
        ctx.save();
        ctx.scale(scale, scale);
        def.draw(ctx, def.naturalSize.w, def.naturalSize.h, t, propsRef.current[def.id] ?? def.defaultProps, themeRef.current);
        ctx.restore();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [elements]);

  const setProp = (id: string, key: string, value: unknown) => setPropsByElement((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }));

  const replay = () => {
    startRef.current = performance.now();
  };

  const categories = useMemo(() => {
    const groups = new Map<string, typeof elements>();
    for (const def of elements) {
      if (!groups.has(def.category)) groups.set(def.category, []);
      groups.get(def.category)!.push(def);
    }
    return groups;
  }, [elements]);

  return (
    <div style={{ minHeight: '100vh', background: '#0B0B10', color: '#fff', fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>UI Kit — Element Gallery</h1>
          <p style={{ fontSize: 13, color: '#9BA1B0', margin: '4px 0 0' }}>{elements.length} animated elements, themed from a project palette. Adjust props below each one.</p>
        </div>
        <select value={paletteId} onChange={(e) => setPaletteId(e.target.value as PaletteId)} style={{ background: '#1A1A22', color: '#fff', border: '1px solid #33333f', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}>
          {PALETTE_IDS.map((id) => (
            <option key={id} value={id}>
              {PALS[id].label}
            </option>
          ))}
        </select>
        <button onClick={replay} style={{ border: 0, borderRadius: 8, padding: '8px 16px', fontWeight: 700, background: '#6D5BFF', color: '#fff' }}>
          ↻ Replay all
        </button>
      </div>

      <PaletteExtractorDemo />

      {[...categories.entries()].map(([category, defs]) => (
        <section key={category} style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9BA1B0', marginBottom: 12 }}>{category}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {defs.map((def) => {
              const displayW = 280;
              const displayH = Math.round((def.naturalSize.h / def.naturalSize.w) * displayW);
              return (
                <div key={def.id} style={{ background: '#15151C', borderRadius: 14, padding: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{def.label}</div>
                  {/* Most elements here (cards, counters, charts, progress) assume
                      they sit on a light app background, matching every existing
                      template (see insights.ts's stat cards) — a dark preview
                      wrapper would make their theme.text (near-black) unreadable. */}
                  <div style={{ background: '#E9E9F0', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
                    <canvas
                      ref={(el) => {
                        canvasRefs.current[def.id] = el;
                      }}
                      width={displayW}
                      height={displayH}
                      style={{ display: 'block', maxWidth: '100%' }}
                    />
                  </div>
                  <PropsPanel def={def} props={propsByElement[def.id] ?? def.defaultProps} onChange={(key, value) => setProp(def.id, key, value)} />
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function PropsPanel({ def, props, onChange }: { def: ReturnType<typeof listElements>[number]; props: AnyProps; onChange: (key: string, value: unknown) => void }) {
  if (!def.propsSchema.length) return null;
  return (
    <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
      {def.propsSchema.map((field) => {
        const value = props[field.key];
        return (
          <label key={field.key} style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', alignItems: 'center', gap: 6, fontSize: 11, color: '#9BA1B0' }}>
            <span>{field.label}</span>
            {field.kind === 'string' && <input type="text" value={value ?? ''} maxLength={field.maxLength} onChange={(e) => onChange(field.key, e.target.value)} style={inputStyle} />}
            {field.kind === 'emoji' && <input type="text" value={value ?? ''} maxLength={4} onChange={(e) => onChange(field.key, e.target.value)} style={inputStyle} />}
            {field.kind === 'number' && (
              <input type="number" value={value ?? 0} min={field.min} max={field.max} step={field.step} onChange={(e) => onChange(field.key, Number(e.target.value))} style={inputStyle} />
            )}
            {field.kind === 'boolean' && <input type="checkbox" checked={!!value} onChange={(e) => onChange(field.key, e.target.checked)} style={{ justifySelf: 'start' }} />}
            {field.kind === 'color' && <input type="color" value={value || '#ffffff'} onChange={(e) => onChange(field.key, e.target.value)} style={{ ...inputStyle, padding: 0, height: 26 }} />}
            {field.kind === 'select' && (
              <select value={value} onChange={(e) => onChange(field.key, e.target.value)} style={inputStyle}>
                {field.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
          </label>
        );
      })}
    </div>
  );
}

const inputStyle: CSSProperties = { background: '#1A1A22', color: '#fff', border: '1px solid #33333f', borderRadius: 6, padding: '4px 6px', fontSize: 11, width: '100%' };

function PaletteExtractorDemo() {
  const [extracted, setExtracted] = useState<ExtractedTheme | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    const img = new Image();
    img.src = url;
    await img.decode();
    setExtracted(extractPalette(img));
  };

  return (
    <section style={{ marginBottom: 28, background: '#15151C', borderRadius: 14, padding: 16 }}>
      <h2 style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>Palette extractor</h2>
      <p style={{ fontSize: 12.5, color: '#9BA1B0', marginBottom: 10 }}>Upload a screenshot — proposes primary/accent/surface/text from its actual pixels.</p>
      <input type="file" accept="image/*" onChange={onFile} style={{ fontSize: 12, color: '#9BA1B0' }} />
      {previewUrl && extracted && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
          <img src={previewUrl} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 10 }} />
          {(Object.keys(extracted) as Array<keyof ExtractedTheme>).map((key) => (
            <div key={key} style={{ textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: 10, background: extracted[key], border: '1px solid rgba(255,255,255,0.15)' }} />
              <div style={{ fontSize: 10, color: '#9BA1B0', marginTop: 4 }}>{key}</div>
              <div style={{ fontSize: 10, color: '#fff' }}>{extracted[key]}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
