'use client';

import { useRef, useState } from 'react';

import { useEditorStore } from '@/store/editorStore';
import { usePlayback } from './PlaybackContext';
import { sceneStart } from './timelineHelpers';
import type { PlaybackEngine } from './usePlaybackEngine';
import { droppedImages, missingScreens, useScreenshots, type ScreenTarget } from './useScreenshots';

/**
 * Over the stage: when the slide on screen has an empty phone (a template
 * slot nobody filled, or a new slide), a button right on the device to add
 * its screenshot. Dropping an image anywhere on the stage puts it into the
 * slide on screen too — replacing what's there. Hidden during playback.
 */
export default function ScreenPrompt({ engine, cssScale, children }: { engine: PlaybackEngine; cssScale: number; children: React.ReactNode }) {
  const project = useEditorStore((s) => s.project);
  const images = useEditorStore((s) => s.assets.images);
  const ready = useEditorStore((s) => s.assetsReady);
  const { put: putFile } = useScreenshots();
  const { seek } = usePlayback();
  // After a screenshot goes in, show the slide settled so the result is visible.
  const put = async (t: ScreenTarget, file: File) => {
    await putFile(t, file);
    if (slide && slide.kind !== 'story') seek(sceneStart(useEditorStore.getState().project, slide.id) + Math.min(1.4, slide.dur / 2));
  };
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const owner = engine.elements.owner;
  const slide = typeof owner === 'number' ? project.scenes.find((s) => s.id === owner) : undefined;
  const missing = slide ? missingScreens({ ...project, scenes: [slide] }, images, ready) : [];
  // Where a dropped/picked file goes: the empty screen, else (image slide) its screenshot.
  const target: ScreenTarget | null = missing[0] ?? (slide?.kind === 'image' ? { slideId: slide.id } : null);
  const device = engine.elements.list.find((e) => e.key === 'device');
  const at = device && slide?.kind === 'image' ? { left: device.box.cx * cssScale, top: device.box.cy * cssScale } : { left: '50%', top: '50%' };
  const storyIndex = slide?.kind === 'story' && missing[0]?.screenId ? slide.screens.findIndex((s) => s.id === missing[0].screenId) : -1;

  return (
    <div
      className="contents"
      onDragOver={(e) => {
        if (!target || !e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => {
        setDragging(false);
        const file = droppedImages(e)[0];
        if (!file || !target) return;
        e.preventDefault();
        void put(target, file);
      }}
    >
      {children}
      {dragging && target && (
        <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center rounded-[22px] border-2 border-dashed border-[#8b7dff] bg-[#5b4bff]/[.18] text-[15px] font-semibold text-white">
          Drop to {missing.length ? 'add' : 'replace'} this slide&apos;s screenshot
        </div>
      )}
      {!engine.playing && missing.length > 0 && (
        <div className="absolute z-20 -translate-x-1/2 -translate-y-1/2 text-center" style={at}>
          <button
            type="button"
            data-screen-prompt
            onClick={() => inputRef.current?.click()}
            className="rounded-[12px] bg-[#5b4bff] px-4 py-2.5 text-[13.5px] font-semibold whitespace-nowrap text-white shadow-[0_12px_30px_rgba(0,0,0,.5)] hover:bg-[#6d5eff]"
          >
            ＋ Add screenshot{storyIndex >= 0 ? ` (screen ${storyIndex + 1})` : ''}
          </button>
          <p className="mt-1.5 text-[11.5px] whitespace-nowrap text-white/80" style={{ textShadow: '0 1px 3px rgba(0,0,0,.7)' }}>
            or drop an image here
          </p>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file && target) void put(target, file);
        }}
      />
    </div>
  );
}
