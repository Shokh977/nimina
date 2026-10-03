'use client';

import { useRef, useState } from 'react';

import { UnplayableVideoError } from '@/engine/export/videoPlayback';
import { resolveStyle } from '@/engine/render';
import { getStoryTimeline } from '@/engine/story';
import type { ImageAsset, Slide } from '@/engine/types';
import { assetSrc, loadImageFile, newAssetId } from '@/lib/assetSrc';
import { rejectUpload, uploadAsset } from '@/lib/storage/assets';
import { useEditorStore } from '@/store/editorStore';
import { usePlayback } from './PlaybackContext';
import { MAX_RECORDING_SECONDS, openRecording } from './video/recordings';
import { newVideoClip } from '@/engine/video';

/** One row of the slide list — intro, each slide, outro — shared by the
 * desktop SlideRail and the phone's SlideStrip. */
export interface SlideEntry {
  key: string;
  kind: 'intro' | 'slide' | 'outro';
  name: string;
  duration: number;
  hidden: boolean;
  selected: boolean;
  colorA: string;
  colorB: string;
  /** A screenshot to show as the thumbnail, when the slide has one. */
  thumb: string | null;
  onSelect: () => void;
  onToggleVisible: () => void;
  visibleTitle: string;
}

function rawDuration(s: Slide): number {
  return s.kind === 'story' ? getStoryTimeline(s).total : s.dur;
}

function slideName(s: Slide, i: number): string {
  if (s.kind === 'story') return `Story ${i + 1}`;
  return s.headline.replace(/\*/g, '') || (s.kind === 'text' ? `Text ${i + 1}` : s.kind === 'video' ? `Recording ${i + 1}` : `Slide ${i + 1}`);
}

// Sample screenshots are canvases; encoding one to a data URL is costly, so
// do it once per asset.
const thumbCache = new WeakMap<object, string>();
function thumbOf(asset: ImageAsset | undefined): string | null {
  if (!asset) return null;
  let src = thumbCache.get(asset);
  if (!src) {
    src = assetSrc(asset);
    thumbCache.set(asset, src);
  }
  return src;
}

export function useSlideEntries(): SlideEntry[] {
  const project = useEditorStore((s) => s.project);
  const images = useEditorStore((s) => s.assets.images);
  const videos = useEditorStore((s) => s.assets.videos);
  const selectedSceneId = useEditorStore((s) => s.selectedSceneId);
  const selectScene = useEditorStore((s) => s.selectScene);
  const updateSlide = useEditorStore((s) => s.updateSlide);
  const setIntro = useEditorStore((s) => s.setIntro);
  const setOutro = useEditorStore((s) => s.setOutro);
  const { seek } = usePlayback();

  const introStyle = resolveStyle(project, project.intro);
  const outroStyle = resolveStyle(project, project.outro);
  const entries: SlideEntry[] = [
    {
      key: 'intro',
      kind: 'intro',
      name: 'Intro',
      duration: project.intro.dur,
      hidden: !project.intro.on,
      selected: selectedSceneId === 'intro',
      colorA: introStyle.colors.a,
      colorB: introStyle.colors.b,
      thumb: null,
      onSelect: () => {
        selectScene('intro');
        seek(0);
      },
      onToggleVisible: () => setIntro({ on: !project.intro.on }),
      visibleTitle: project.intro.on ? 'Hide intro' : 'Show intro',
    },
  ];

  // Each slide's start time, for seeking on select (hidden slides take no time).
  let cursor = project.intro.on ? project.intro.dur : 0;
  project.scenes.forEach((slide, index) => {
    const startAt = cursor;
    if (!slide.hidden) cursor += rawDuration(slide);
    const style = resolveStyle(project, slide);
    const thumbId = slide.kind === 'image' ? slide.imgAssetId : slide.kind === 'story' ? slide.screens[0]?.assetId : undefined;
    entries.push({
      key: String(slide.id),
      kind: 'slide',
      name: slideName(slide, index),
      duration: rawDuration(slide),
      hidden: slide.hidden,
      selected: selectedSceneId === slide.id,
      colorA: style.colors.a,
      colorB: style.colors.b,
      thumb: slide.kind === 'video' ? (slide.video.assetId ? thumbOf(videos[slide.video.assetId]?.poster) : null) : thumbId ? thumbOf(images[thumbId]) : null,
      onSelect: () => {
        selectScene(slide.id);
        if (!slide.hidden) seek(startAt);
      },
      onToggleVisible: () => updateSlide(slide.id, { hidden: !slide.hidden }),
      visibleTitle: slide.hidden ? 'Show slide' : 'Hide slide',
    });
  });

  const outroStartAt = cursor;
  entries.push({
    key: 'outro',
    kind: 'outro',
    name: 'Outro',
    duration: project.outro.dur,
    hidden: !project.outro.on,
    selected: selectedSceneId === 'outro',
    colorA: outroStyle.colors.a,
    colorB: outroStyle.colors.b,
    thumb: null,
    onSelect: () => {
      selectScene('outro');
      seek(Math.max(0, outroStartAt));
    },
    onToggleVisible: () => setOutro({ on: !project.outro.on }),
    visibleTitle: project.outro.on ? 'Hide outro' : 'Show outro',
  });
  return entries;
}

/** "Add screenshot / text slide / story slide". Render `<input ref={inputRef}
 * type="file" accept="image/*" multiple hidden onChange={onAddFiles}>`
 * somewhere and call `pickScreenshots()` to open it. */
export function useAddSlides() {
  const registerImage = useEditorStore((s) => s.registerImage);
  const addImageSlide = useEditorStore((s) => s.addImageSlide);
  const addTextSlide = useEditorStore((s) => s.addTextSlide);
  const addStorySlide = useEditorStore((s) => s.addStorySlide);
  const projectId = useEditorStore((s) => s.projectId);
  const inputRef = useRef<HTMLInputElement>(null);

  const onAddFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])];
    e.target.value = '';
    for (const file of files) {
      if (rejectUpload(file, projectId)) continue;
      try {
        const { image } = await loadImageFile(file);
        const assetId = newAssetId('img');
        registerImage(assetId, image);
        addImageSlide(assetId);
        if (projectId) uploadAsset(projectId, assetId, file).catch((err) => console.error('[assets] upload failed', err));
      } catch {
        // skip files that fail to decode
      }
    }
  };

  const videoInputRef = useRef<HTMLInputElement>(null);
  const addVideoSlide = useEditorStore((s) => s.addVideoSlide);
  const [videoStatus, setVideoStatus] = useState('');
  const onAddRecording = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || rejectUpload(file, projectId, 'video')) return;
    setVideoStatus('Opening the recording…');
    const assetId = newAssetId('video');
    try {
      const source = await openRecording(assetId, file);
      if (source.duration > MAX_RECORDING_SECONDS + 0.5) {
        setVideoStatus(`Recordings can be up to ${MAX_RECORDING_SECONDS} seconds — this one is ${Math.round(source.duration)}. Shorten it on your phone or computer first.`);
        return;
      }
      addVideoSlide(newVideoClip(assetId, Math.round(source.duration * 1000) / 1000, source.width, source.height));
      if (projectId) uploadAsset(projectId, assetId, file, 'video').catch((err) => console.error('[assets] upload failed', err));
      setVideoStatus('');
    } catch (err) {
      setVideoStatus(err instanceof UnplayableVideoError ? err.message : "That recording couldn't be opened.");
    }
  };

  return {
    inputRef,
    onAddFiles,
    pickScreenshots: () => inputRef.current?.click(),
    addTextSlide: () => addTextSlide(),
    addStorySlide: () => addStorySlide(),
    videoInputRef,
    onAddRecording,
    pickRecording: () => videoInputRef.current?.click(),
    videoStatus,
  };
}
