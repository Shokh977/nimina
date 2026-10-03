'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { FORMATS } from '@/engine/constants';
import type { Format } from '@/engine/types';
import StorageMeter from '@/components/storage/StorageMeter';
import { createClient } from '@/lib/supabase/client';
import { useEditorStore } from '@/store/editorStore';
import type { EditorTab } from '../EditorShell';
import SaveStatusBadge from '../SaveStatusBadge';
import Stage from '../Stage';
import type { SaveStatus } from '../usePersistence';
import type { PlaybackEngine } from '../usePlaybackEngine';
import { useAddSlides, useSlideEntries, type SlideEntry } from '../useSlideList';
import { useVisualViewport } from './useVisualViewport';

/**
 * The phone editor (below 768px, or a short landscape touch screen): one
 * thing at a time instead of the desktop's three columns.
 *
 * Portrait: header · canvas · transport · slide strip · tab bar, with the
 * tab bar opening a bottom sheet (peek ↔ nearly full, drag down to close).
 * Landscape: canvas + transport on the left, the strip / section / tab bar
 * docked on the right — a sheet over a 390px-tall canvas would hide it.
 *
 * The root is pinned to the visual viewport, so when the on-screen
 * keyboard opens everything above it — the sheet and the focused field —
 * stays visible (the strip and tab bar step aside while typing).
 */

const HEADER_H = 56;
const TABBAR_H = 56;

type Section = 'slides' | string;
type Snap = 'peek' | 'full';

export default function MobileEditor({
  userEmail,
  projectName,
  saveStatus,
  engine,
  tabs,
  activeTab,
  onTabChange,
  panel,
}: {
  userEmail: string;
  projectName: string;
  saveStatus: SaveStatus;
  engine: PlaybackEngine;
  tabs: readonly EditorTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  panel: React.ReactNode;
}) {
  const vv = useVisualViewport();
  const [landscape, setLandscape] = useState(false);
  const [section, setSection] = useState<Section | null>(null);
  const [snap, setSnap] = useState<Snap>('peek');

  useEffect(() => {
    const mq = window.matchMedia('(orientation: landscape)');
    const update = () => setLandscape(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const primary = tabs.filter((t) => !t.secondary);
  const secondary = tabs.filter((t) => t.secondary);

  const open = (s: Section) => {
    if (s !== 'slides') onTabChange(s);
    setSection(s);
  };
  const onTabBar = (s: Section) => {
    // Portrait: tapping the open section's tab closes the sheet.
    if (!landscape && section === s) setSection(null);
    else open(s);
  };
  // Landscape always shows a section.
  const shown: Section | null = landscape ? (section ?? activeTab) : section;
  const sectionLabel = shown === 'slides' ? 'Slides' : (tabs.find((t) => t.id === shown)?.label ?? '');
  const sectionBody = shown === 'slides' ? <MobileSlideList /> : <div className="p-4">{panel}</div>;

  const height = vv.height || undefined;
  const typing = vv.keyboardOpen;

  return (
    <div
      data-touch-ui
      className="fixed inset-x-0 top-0 flex flex-col overflow-hidden overscroll-none bg-[#08090c] text-[#f4f5f8]"
      style={{ height: height ? `${height}px` : '100dvh', transform: vv.offsetTop ? `translateY(${vv.offsetTop}px)` : undefined, paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}
    >
      <MobileHeader userEmail={userEmail} projectName={projectName} saveStatus={saveStatus} engine={engine} secondary={secondary} onOpen={open} />

      {landscape ? (
        <div className="flex min-h-0 flex-1">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <Stage engine={engine} touch />
            <MobileTransport engine={engine} compact />
          </div>
          <div className="flex min-h-0 w-[46%] max-w-[440px] min-w-[280px] flex-col border-l border-white/[.07] bg-[#0b0c11]">
            {!typing && <SlideStrip />}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{sectionBody}</div>
            {!typing && <TabBar tabs={primary} active={shown} onSelect={onTabBar} />}
          </div>
        </div>
      ) : (
        <>
          <Stage engine={engine} touch />
          <MobileTransport engine={engine} />
          {!typing && <SlideStrip />}
          {!typing && <TabBar tabs={primary} active={shown} onSelect={onTabBar} />}
          {shown && (
            <BottomSheet
              title={sectionLabel}
              rootHeight={vv.height || 640}
              bottomOffset={typing ? 0 : TABBAR_H}
              snap={typing ? 'full' : snap}
              onSnap={setSnap}
              onClose={() => setSection(null)}
            >
              {sectionBody}
            </BottomSheet>
          )}
        </>
      )}
    </div>
  );
}

const ICON_BTN =
  'grid h-11 w-11 shrink-0 place-items-center rounded-[12px] text-[18px] text-[#c9cdd8] transition-colors active:bg-white/[.1] disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b7dff]';

function MobileHeader({
  userEmail,
  projectName,
  saveStatus,
  engine,
  secondary,
  onOpen,
}: {
  userEmail: string;
  projectName: string;
  saveStatus: SaveStatus;
  engine: PlaybackEngine;
  secondary: readonly EditorTab[];
  onOpen: (s: Section) => void;
}) {
  const router = useRouter();
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.canUndo);
  const canRedo = useEditorStore((s) => s.canRedo);
  const [menuOpen, setMenuOpen] = useState(false);

  const signOut = async () => {
    await createClient().auth.signOut();
    router.push('/login');
    router.refresh();
  };
  const pick = (fn: () => void) => () => {
    setMenuOpen(false);
    fn();
  };

  return (
    <header className="relative flex shrink-0 items-center gap-1 border-b border-white/[.07] bg-[#08090c] px-1.5" style={{ height: HEADER_H }}>
      <Link href="/projects" aria-label="All projects" className={ICON_BTN}>
        {/* eslint-disable-next-line @next/next/no-img-element -- static SVG logo mark */}
        <img src="/brand/logo-mark-light.svg" alt="" className="h-6 w-6" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col justify-center leading-tight">
        <span className="truncate text-[14px] font-semibold text-[#e4e6ec]" title={projectName}>
          {projectName || 'Untitled promo'}
        </span>
        <div className="mt-0.5 flex min-w-0 overflow-hidden [&>span]:max-w-full [&>span]:py-0.5 [&>span]:text-[11px]">
          <SaveStatusBadge status={saveStatus} />
        </div>
      </div>
      <button onClick={undo} disabled={!canUndo} aria-label="Undo" className={ICON_BTN}>
        ↺
      </button>
      <button onClick={redo} disabled={!canRedo} aria-label="Redo" className={ICON_BTN}>
        ↻
      </button>
      <button onClick={() => setMenuOpen((v) => !v)} aria-label="Menu" aria-expanded={menuOpen} aria-haspopup="menu" className={ICON_BTN}>
        ⋯
      </button>

      {menuOpen && (
        <>
          <button aria-label="Close menu" className="fixed inset-0 z-40 cursor-default" onClick={() => setMenuOpen(false)} />
          <div role="menu" className="absolute top-[52px] right-1.5 z-50 w-[min(280px,calc(100vw-12px))] overflow-hidden rounded-[14px] border border-white/[.1] bg-[#12141b] py-1.5 shadow-[0_24px_60px_rgba(0,0,0,.6)]">
            <MenuItem onClick={pick(engine.togglePreviewWatermark)} checked={engine.previewNoWatermark}>
              Preview without watermark
            </MenuItem>
            <MenuItem onClick={pick(() => onOpen('export'))}>Export</MenuItem>
            {secondary.map((t) => (
              <MenuItem key={t.id} onClick={pick(() => onOpen(t.id))}>
                {t.label}
              </MenuItem>
            ))}
            <div className="my-1.5 h-px bg-white/[.08]" />
            {userEmail && <p className="truncate px-4 py-1.5 text-[12px] text-[#767e8d]">{userEmail}</p>}
            <MenuLink href="/api/paddle/portal">Manage subscription</MenuLink>
            <MenuLink href="/account">Account</MenuLink>
            <MenuItem onClick={pick(signOut)}>Sign out</MenuItem>
          </div>
        </>
      )}
    </header>
  );
}

const MENU_ITEM = 'flex min-h-11 w-full items-center justify-between gap-3 px-4 text-left text-[14.5px] font-medium text-[#e4e6ec] active:bg-white/[.08]';

function MenuItem({ onClick, checked, children }: { onClick: () => void; checked?: boolean; children: React.ReactNode }) {
  return (
    <button role={checked === undefined ? 'menuitem' : 'menuitemcheckbox'} aria-checked={checked} onClick={onClick} className={MENU_ITEM}>
      <span className="min-w-0">{children}</span>
      {checked !== undefined && <span className={`h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors ${checked ? 'bg-[#5b4bff]' : 'bg-white/[.15]'}`}><span className={`block h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : ''}`} /></span>}
    </button>
  );
}

function MenuLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a role="menuitem" href={href} className={MENU_ITEM}>
      {children}
    </a>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}`;
}

const FORMAT_KEYS: Format[] = ['9:16', '1:1', '16:9'];

function MobileTransport({ engine, compact = false }: { engine: PlaybackEngine; compact?: boolean }) {
  const format = useEditorStore((s) => s.project.format);
  const setFormat = useEditorStore((s) => s.setFormat);
  const { playing, displayT, total, togglePlay, seek } = engine;

  const playButton = (
    <button
      onClick={togglePlay}
      aria-label={playing ? 'Pause' : 'Play'}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#5b4bff] text-white active:bg-[#6d5eff]"
    >
      {playing ? (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
          <rect x="5" y="4" width="5" height="16" rx="1.5" />
          <rect x="14" y="4" width="5" height="16" rx="1.5" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-4 w-4" aria-hidden>
          <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" />
        </svg>
      )}
    </button>
  );
  const time = (
    <span className="shrink-0 font-[family-name:var(--font-space-grotesk)] text-[12.5px] text-[#9aa1af] tabular-nums">
      {formatTime(displayT)} / {formatTime(total)}
    </span>
  );
  const formats = (
    <div role="radiogroup" aria-label="Format" className="flex shrink-0 gap-0.5 rounded-[12px] border border-white/[.12] p-0.5">
      {FORMAT_KEYS.map((f) => (
        <button
          key={f}
          role="radio"
          aria-checked={format === f}
          aria-label={`${f} ${FORMATS[f].name}`}
          onClick={() => setFormat(f)}
          className="min-h-11 min-w-11 rounded-[10px] px-2 text-[12.5px] font-semibold text-[#9aa1af] aria-checked:bg-[#5b4bff]/[.24] aria-checked:text-[#cfc8ff]"
        >
          {f}
        </button>
      ))}
    </div>
  );
  const scrubber = (
    <input
      type="range"
      aria-label="Playhead"
      min={0}
      max={Math.max(0.01, total)}
      step={0.01}
      value={Math.min(displayT, total)}
      onChange={(e) => seek(Number(e.target.value))}
      className="block h-9 w-full min-w-0 flex-1 accent-[#8b7dff]"
    />
  );

  // Landscape: everything on one row, so the canvas keeps the height.
  if (compact) {
    return (
      <div className="flex shrink-0 items-center gap-2 border-t border-white/[.07] bg-[#0a0b10] px-2 py-1">
        {playButton}
        {time}
        {scrubber}
        {formats}
      </div>
    );
  }
  return (
    <div className="shrink-0 border-t border-white/[.07] bg-[#0a0b10] px-3 pt-1.5 pb-1">
      <div className="flex items-center gap-2">
        {playButton}
        {time}
        <div className="ml-auto">{formats}</div>
      </div>
      {scrubber}
    </div>
  );
}

function SlideStrip() {
  const entries = useSlideEntries();
  const { inputRef, onAddFiles, pickScreenshots, addTextSlide, addStorySlide } = useAddSlides();
  const [addOpen, setAddOpen] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);
  const selectedKey = entries.find((e) => e.selected)?.key;

  useEffect(() => {
    stripRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
  }, [selectedKey]);

  return (
    <div className="relative shrink-0 border-t border-white/[.07] bg-[#0a0b10]">
      <div ref={stripRef} className="flex items-center gap-2 overflow-x-auto overscroll-x-contain px-3 py-2 [scrollbar-width:none]">
        {entries.map((e) => (
          <StripThumb key={e.key} entry={e} />
        ))}
        <button
          onClick={() => setAddOpen((v) => !v)}
          aria-label="Add a slide"
          aria-expanded={addOpen}
          className="grid h-[60px] w-11 shrink-0 place-items-center rounded-[10px] border border-dashed border-white/[.25] text-[22px] text-[#c9cdd8] active:bg-white/[.08]"
        >
          +
        </button>
      </div>
      {addOpen && (
        <>
          <button aria-label="Close" className="fixed inset-0 z-40 cursor-default" onClick={() => setAddOpen(false)} />
          <div role="menu" className="absolute right-2 bottom-full z-50 mb-2 w-[min(260px,calc(100vw-16px))] overflow-hidden rounded-[14px] border border-white/[.1] bg-[#12141b] py-1.5 shadow-[0_24px_60px_rgba(0,0,0,.6)]">
            {[
              ['Add screenshot', pickScreenshots],
              ['Add text slide', addTextSlide],
              ['Add story slide', addStorySlide],
            ].map(([label, fn]) => (
              <button
                key={label as string}
                role="menuitem"
                onClick={() => {
                  setAddOpen(false);
                  (fn as () => void)();
                }}
                className={MENU_ITEM}
              >
                {label as string}
              </button>
            ))}
          </div>
        </>
      )}
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={onAddFiles} />
    </div>
  );
}

function StripThumb({ entry }: { entry: SlideEntry }) {
  return (
    <button
      onClick={entry.onSelect}
      aria-label={`${entry.name}${entry.hidden ? ' (hidden)' : ''}`}
      aria-current={entry.selected}
      className={`relative h-[60px] w-11 shrink-0 overflow-hidden rounded-[10px] border-2 ${entry.selected ? 'border-[#8b7dff]' : 'border-transparent'} ${entry.hidden ? 'opacity-40' : ''}`}
      style={{ background: `linear-gradient(150deg, ${entry.colorA}, ${entry.colorB})` }}
    >
      {entry.thumb ? (
        // eslint-disable-next-line @next/next/no-img-element -- in-memory asset
        <img src={entry.thumb} alt="" className="absolute inset-[5px] h-[calc(100%-10px)] w-[calc(100%-10px)] rounded-[4px] object-cover" draggable={false} />
      ) : (
        <span className="absolute inset-x-0 bottom-1 truncate px-0.5 text-center text-[9px] font-bold text-white/90">{entry.name}</span>
      )}
    </button>
  );
}

function TabBar({ tabs, active, onSelect }: { tabs: readonly EditorTab[]; active: Section | null; onSelect: (s: Section) => void }) {
  const items = [{ id: 'slides', label: 'Slides' }, ...tabs];
  return (
    <nav role="tablist" aria-label="Editor sections" className="grid shrink-0 border-t border-white/[.07] bg-[#08090c]" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`, height: TABBAR_H, paddingBottom: 'env(safe-area-inset-bottom)', boxSizing: 'content-box' }}>
      {items.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          onClick={() => onSelect(t.id)}
          className="relative min-w-0 truncate px-1 text-[12.5px] font-semibold text-[#9aa1af] aria-selected:text-[#cfc8ff]"
        >
          {t.label}
          {active === t.id && <span className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-[#8b7dff]" />}
        </button>
      ))}
    </nav>
  );
}

/** The full slide list in the sheet: rename via the Slide tab, hide/show
 * here, plus adding slides and the storage meter (the desktop rail's job). */
function MobileSlideList() {
  const entries = useSlideEntries();
  const { inputRef, onAddFiles, pickScreenshots, addTextSlide, addStorySlide } = useAddSlides();
  const projectId = useEditorStore((s) => s.projectId);
  return (
    <div className="grid gap-2 p-3">
      {entries.map((e) => (
        <div key={e.key} className={`flex min-h-14 items-stretch overflow-hidden rounded-[12px] border ${e.selected ? 'border-[#8b7dff]/55 bg-[#5b4bff]/[.14]' : 'border-white/10 bg-white/[.03]'}`}>
          <button onClick={e.onSelect} className="flex min-w-0 flex-1 items-center gap-3 py-2 pl-2 text-left">
            <span className="h-10 w-[6px] shrink-0 rounded-full" style={{ background: `linear-gradient(150deg, ${e.colorA}, ${e.colorB})` }} />
            <span className="min-w-0 flex-1">
              <span className={`block truncate text-[14px] font-semibold ${e.hidden ? 'text-[#6d7484]' : 'text-[#f4f5f8]'}`}>{e.name}</span>
              <span className="block text-[12px] text-[#767e8d]">
                {e.duration.toFixed(1)}s{e.hidden ? ' · hidden' : ''}
              </span>
            </span>
          </button>
          <button onClick={e.onToggleVisible} aria-label={e.visibleTitle} className="grid w-12 shrink-0 place-items-center text-[15px] text-[#9aa1af] active:bg-white/[.08]">
            {e.hidden ? '◌' : '👁'}
          </button>
        </div>
      ))}
      <div className="mt-1 grid gap-2">
        {[
          ['＋ Add screenshot', pickScreenshots],
          ['＋ Add text slide', addTextSlide],
          ['＋ Add story slide', addStorySlide],
        ].map(([label, fn]) => (
          <button key={label as string} onClick={fn as () => void} className="min-h-11 rounded-[12px] border border-dashed border-white/[.2] px-3 text-[14px] font-semibold text-[#c9cdd8] active:bg-white/[.06]">
            {label as string}
          </button>
        ))}
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={onAddFiles} />
      </div>
      {projectId && (
        <div className="mt-2 rounded-xl border border-white/[.07] bg-white/[.03] p-3">
          <StorageMeter compact />
        </div>
      )}
      <p className="mt-1 text-[12.5px] leading-snug text-[#767e8d]">
        Wrap words in <span className="text-[#cfc8ff]">*stars*</span> to highlight them.
      </p>
    </div>
  );
}

/**
 * Draggable bottom sheet. Two resting heights — peek (about half the
 * screen, canvas still visible above) and full (just under the header) —
 * dragging the grip/title bar moves it, a downward fling or dragging below
 * the peek closes it. The content scrolls inside; while a text field is
 * focused it stays fully above the keyboard (the root follows the visual
 * viewport) and the focused field is scrolled into view.
 */
function BottomSheet({
  title,
  rootHeight,
  bottomOffset,
  snap,
  onSnap,
  onClose,
  children,
}: {
  title: string;
  rootHeight: number;
  bottomOffset: number;
  snap: Snap;
  onSnap: (s: Snap) => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const fullH = Math.max(200, rootHeight - HEADER_H - bottomOffset - 6);
  const peekH = Math.min(fullH, Math.round(rootHeight * 0.48));
  const restH = snap === 'full' ? fullH : peekH;
  const [dragH, setDragH] = useState<number | null>(null);
  const drag = useRef<{ y0: number; h0: number; lastY: number; lastT: number; v: number } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y0: e.clientY, h0: restH, lastY: e.clientY, lastT: e.timeStamp, v: 0 };
    setDragH(restH);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dt = Math.max(1, e.timeStamp - d.lastT);
    d.v = (e.clientY - d.lastY) / dt; // px/ms, positive = downward
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    setDragH(Math.max(0, Math.min(fullH, d.h0 - (e.clientY - d.y0))));
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    const h = dragH ?? restH;
    setDragH(null);
    if (!d) return;
    if (d.v > 0.9 && snap === 'peek') return onClose(); // fling down from peek
    if (d.v > 0.9) return onSnap('peek');
    if (d.v < -0.9) return onSnap('full');
    if (h < peekH * 0.6) return onClose();
    onSnap(Math.abs(h - fullH) < Math.abs(h - peekH) ? 'full' : 'peek');
  };

  // Keep a focused field in view when the keyboard (or a resize) shrinks the sheet.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const onFocus = (e: FocusEvent) => {
      const el = e.target as HTMLElement;
      if (el.matches('input,textarea,select')) setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 380);
    };
    body.addEventListener('focusin', onFocus);
    return () => body.removeEventListener('focusin', onFocus);
  }, []);

  const height = dragH ?? restH;
  return (
    <section
      aria-label={title}
      className="absolute inset-x-0 z-30 flex flex-col rounded-t-[20px] border-t border-white/[.1] bg-[#0f1117] shadow-[0_-20px_50px_rgba(0,0,0,.55)]"
      style={{ bottom: bottomOffset ? `calc(${bottomOffset}px + env(safe-area-inset-bottom))` : 0, height, transition: dragH === null ? 'height .22s cubic-bezier(.2,.8,.2,1)' : 'none' }}
    >
      <div className="shrink-0 touch-none select-none" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-white/[.22]" aria-hidden />
        <div className="flex items-center gap-2 pr-1 pl-4">
          <h2 className="min-w-0 flex-1 truncate font-[family-name:var(--font-space-grotesk)] text-[16px] font-bold">{title}</h2>
          <button onClick={() => onSnap(snap === 'full' ? 'peek' : 'full')} aria-label={snap === 'full' ? 'Shrink panel' : 'Expand panel'} className={ICON_BTN}>
            {snap === 'full' ? '⌄' : '⌃'}
          </button>
          <button onClick={onClose} aria-label="Close panel" className={ICON_BTN}>
            ✕
          </button>
        </div>
      </div>
      <div ref={bodyRef} className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
        {children}
      </div>
    </section>
  );
}
