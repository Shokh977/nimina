'use client';

import { useEffect, useState } from 'react';

export interface VisualViewportState {
  /** Height actually visible — shrinks when the on-screen keyboard opens. */
  height: number;
  /** How far the browser has scrolled the visible area down (iOS does this
   * while the keyboard is open). */
  offsetTop: number;
  /** The on-screen keyboard (or another overlay) is covering part of the page. */
  keyboardOpen: boolean;
}

/**
 * Tracks window.visualViewport so the mobile editor can size itself to what
 * is really visible. Pinning the editor's root to this height keeps
 * everything — in particular the bottom sheet and a focused text field —
 * above the on-screen keyboard on both iOS Safari (which overlays the
 * keyboard without resizing the page) and Android Chrome.
 */
export function useVisualViewport(): VisualViewportState {
  const [state, setState] = useState<VisualViewportState>(() =>
    typeof window === 'undefined' ? { height: 0, offsetTop: 0, keyboardOpen: false } : read(),
  );

  useEffect(() => {
    const vv = window.visualViewport;
    const update = () => setState(read());
    update();
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    // Focus changes alone don't resize anything until the keyboard animates
    // in/out — re-read once it has.
    const later = () => setTimeout(update, 350);
    document.addEventListener('focusin', later);
    document.addEventListener('focusout', later);
    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      document.removeEventListener('focusin', later);
      document.removeEventListener('focusout', later);
    };
  }, []);

  return state;
}

function read(): VisualViewportState {
  const vv = window.visualViewport;
  const height = vv?.height ?? window.innerHeight;
  const offsetTop = vv?.offsetTop ?? 0;
  // A keyboard takes well over 120px; smaller differences are browser
  // toolbars sliding in and out.
  const focusedField = document.activeElement?.matches('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]),textarea,select,[contenteditable=true]') ?? false;
  const keyboardOpen = focusedField && window.innerHeight - height > 120;
  return { height, offsetTop, keyboardOpen };
}
