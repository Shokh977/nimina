'use client';

import { createContext, useContext } from 'react';

export interface PlaybackApi {
  seek: (t: number) => void;
  playFrom: (t: number) => void;
}

const PlaybackContext = createContext<PlaybackApi | null>(null);

export const PlaybackProvider = PlaybackContext.Provider;

/** Lets any panel (e.g. a scene card) nudge the preview to a given time,
 * without needing to know about the render loop that owns it. */
export function usePlayback(): PlaybackApi {
  const ctx = useContext(PlaybackContext);
  if (!ctx) throw new Error('usePlayback() must be used within PlaybackProvider');
  return ctx;
}
