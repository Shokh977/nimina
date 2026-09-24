'use client';

import { useState } from 'react';

import { getStoryTimeline } from '@/engine/story';
import type { StorySlide } from '@/engine/types';
import { useEditorStore } from '@/store/editorStore';
import StyleEditor from '../../StyleEditor';
import { KEYS_STORY } from '../../styleFields';
import { ACTION_TYPES } from '../../storyFields';
import StoryActionCard from './StoryActionCard';
import StoryTimelineView from './StoryTimelineView';
import ScreensStrip from './ScreensStrip';
import SpritesEditor from './SpritesEditor';
import CameraEditor from './CameraEditor';

export default function StorySceneEditor({ slide }: { slide: StorySlide }) {
  const setSlideStyle = useEditorStore((s) => s.setSlideStyle);
  const resetSlideStyle = useEditorStore((s) => s.resetSlideStyle);
  const applyStyleToAll = useEditorStore((s) => s.applyStyleToAll);
  const addStoryAction = useEditorStore((s) => s.addStoryAction);
  const reorderStoryActions = useEditorStore((s) => s.reorderStoryActions);
  const musicBpm = useEditorStore((s) => s.project.music?.bpm);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(slide.actions[0]?.id ?? null);
  const [addType, setAddType] = useState(ACTION_TYPES[0][0]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(false);
  const snapBpm = snapEnabled && musicBpm ? musicBpm : undefined;

  const timeline = getStoryTimeline(slide);

  const draggableProps = (index: number): React.HTMLAttributes<HTMLDivElement> => ({
    draggable: true,
    onDragStart: (e) => {
      // Some browsers won't complete a native HTML5 drag unless dragstart
      // sets data on the DataTransfer — an empty string is fine, we track
      // the actual source index in React state.
      e.dataTransfer.setData('text/plain', String(index));
      e.dataTransfer.effectAllowed = 'move';
      setDragIndex(index);
    },
    onDragOver: (e) => e.preventDefault(),
    onDrop: (e) => {
      e.preventDefault();
      const from = dragIndex ?? Number(e.dataTransfer.getData('text/plain'));
      if (!Number.isNaN(from) && from !== index) reorderStoryActions(slide.id, from, index);
      setDragIndex(null);
    },
  });

  return (
    <div className="grid gap-3">
      <ScreensStrip slide={slide} />

      <CameraEditor slide={slide} />

      <div>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-[12.5px] font-bold text-neutral-500 dark:text-neutral-400">Timeline ({timeline.total.toFixed(1)}s)</h4>
          {musicBpm && (
            <label className="flex items-center gap-1.5 text-[12px] font-semibold">
              <input type="checkbox" checked={snapEnabled} onChange={(e) => setSnapEnabled(e.target.checked)} className="h-[15px] w-[15px] accent-indigo-600" />
              Snap durations to {musicBpm} BPM beat
            </label>
          )}
        </div>
        <div className="hidden sm:block">
          <StoryTimelineView slide={slide} selectedId={selectedActionId} onSelect={setSelectedActionId} bpm={musicBpm} />
        </div>
        <p className="text-[12px] text-neutral-500 sm:hidden dark:text-neutral-400">{slide.actions.length} actions, {timeline.total.toFixed(1)}s total — widen your window to see the visual timeline.</p>
      </div>

      <div>
        <h4 className="mb-1.5 text-[12.5px] font-bold text-neutral-500 dark:text-neutral-400">Actions</h4>
        {timeline.entries.map((entry, i) => (
          <StoryActionCard
            key={entry.action.id}
            slide={slide}
            entry={entry}
            index={i}
            count={slide.actions.length}
            selected={selectedActionId === entry.action.id}
            onSelect={() => setSelectedActionId(entry.action.id)}
            draggableProps={draggableProps(i)}
            snapBpm={snapBpm}
          />
        ))}
        {slide.actions.length === 0 && <p className="text-[12.5px] text-neutral-500 dark:text-neutral-400">No actions yet — add one below to start building the shot.</p>}

        <div className="mt-2 flex gap-2">
          <select
            aria-label="New action type"
            value={addType}
            onChange={(e) => setAddType(e.target.value as (typeof ACTION_TYPES)[number][0])}
            className="min-w-0 flex-1 rounded-lg border border-black/10 bg-white px-2.5 py-2 text-[13.5px] dark:border-white/10 dark:bg-neutral-800"
          >
            {ACTION_TYPES.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setSelectedActionId(addStoryAction(slide.id, addType))}
            className="rounded-lg border border-dashed border-black/15 bg-white px-3.5 py-2 text-[13.5px] font-bold whitespace-nowrap hover:border-indigo-500 dark:border-white/15 dark:bg-neutral-800"
          >
            + Add action
          </button>
        </div>
      </div>

      <SpritesEditor slide={slide} />

      <StyleEditor
        title="Style for this slide"
        keys={KEYS_STORY}
        style={slide.style}
        onChange={(key, value) => setSlideStyle(slide.id, key, value)}
        onReset={() => resetSlideStyle(slide.id)}
        onApplyAll={() => applyStyleToAll(slide.id)}
      />
    </div>
  );
}
