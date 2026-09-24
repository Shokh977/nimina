'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

import { DEFAULT_FORMAT, FORMAT_STAGE_DIMS, STAGE_H, STAGE_W } from '@/engine2/camera';
// Side-effect import — registers every template/recipe's 'ui-element'
// content before any scene can actually build one. See that file's doc
// comment for the real bug this fixes.
import '@/engine2/registerAllContent';
import { buildEngineV2Scene, type EngineV2Scene } from '@/engine2/sceneBuilder';
import type { Axis } from '@/engine2/types';
import { useEditorV2Store } from '@/store/editorV2Store';

// Bounding box the preview canvas fits within, whatever the project's
// format — chosen so the pre-existing 9:16 case comes out pixel-identical
// to before this budget existed (420x747, matching WIDTH*STAGE_H/STAGE_W),
// while 1:1 and 16:9 scale down to fit the same box without distortion.
const PREVIEW_MAX_W = 420;
const PREVIEW_MAX_H = Math.round((PREVIEW_MAX_W * STAGE_H) / STAGE_W);

function previewDims(format: keyof typeof FORMAT_STAGE_DIMS): { width: number; height: number } {
  const { w, h } = FORMAT_STAGE_DIMS[format];
  const scale = Math.min(PREVIEW_MAX_W / w, PREVIEW_MAX_H / h);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

export type GizmoMode = 'translate' | 'scale' | 'rotate';

/**
 * The canvas: renders the live SceneProjectV2, and layers direct
 * manipulation on top (Prompt 5) — click a layer's mesh to select it,
 * drag it to move, use the gizmo to scale/rotate. Dragging edits the
 * layer's keyframe track *base* value (see editorV2Store's setLayerBase),
 * not the mesh directly — the mesh's transform is recomputed from that
 * track every frame by engineScene.update(), so writing to the store is
 * the only edit that sticks past the next frame (this component skips
 * calling update() for the one frame span of an active drag so the gizmo
 * isn't fighting it).
 */
export default function Stage2({ mode }: { mode: GizmoMode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const project = useEditorV2Store((s) => s.project);
  const assets = useEditorV2Store((s) => s.assets);
  const selectedIds = useEditorV2Store((s) => s.selectedIds);
  const select = useEditorV2Store((s) => s.select);
  const setLayerBase = useEditorV2Store((s) => s.setLayerBase);
  const playheadT = useEditorV2Store((s) => s.playheadT);
  // Infrastructure merge: preview shows the watermark too, not just export
  // — a free-plan user should see what they're actually going to get.
  const plan = useEditorV2Store((s) => s.plan);

  const sceneRef = useRef<EngineV2Scene | null>(null);
  const tcRef = useRef<TransformControls | null>(null);
  const draggingRef = useRef(false);
  const playheadRef = useRef(playheadT);
  useEffect(() => {
    playheadRef.current = playheadT;
  });
  const [ready, setReady] = useState(false);
  const { width: WIDTH, height: HEIGHT } = previewDims(project?.format ?? DEFAULT_FORMAT);

  // Latency fix: this effect used to depend on the whole `project` object,
  // which is a *new reference on every edit* (immutable-update pattern) —
  // so it tore down and rebuilt the entire renderer/scene/composer, and
  // recreated every video/lottie decoder, on every keystroke. It now
  // depends on `project.layers`/`.particles`/`.camera` specifically —
  // still a new reference on genuinely *structural* edits (add/remove/
  // reorder a layer, undo/redo, loading a different project) but the
  // *same* reference across setText()/setPalette()/setStyle() (those
  // actions spread a new project object but never touch these three
  // fields — see editorV2Store.ts), so a text/palette/style edit no
  // longer matches this dependency list at all. Palette/text changes are
  // instead handled by the effect below via sceneRef.current.refreshContent()
  // (no rebuild); format changes by the one after that via refreshFormat()
  // (also no rebuild); style changes need nothing extra — evaluateLayer()
  // already reads project.styleId fresh every single update(t) call.
  // `project.device` (Tier 1 must-have #1's project-wide default device
  // frame) is included too: changing it doesn't touch `layers` itself
  // (editorV2Store's setDevice only spreads `device`), but it changes what
  // sceneBuilder.ts draws for every screenshot layer that has no
  // per-layer override, which is a build-time decision (creates/removes
  // frame companion meshes) — refreshContent() only redraws existing
  // textures in place, it can't add or remove a mesh, so this needs the
  // full rebuild path, not the lighter one below.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !project) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    const inst = buildEngineV2Scene(renderer, project, WIDTH, HEIGHT, { assets, watermark: plan === 'free' });
    sceneRef.current = inst;
    setReady(true);

    const transformControls = new TransformControls(inst.camera, canvas);
    tcRef.current = transformControls;
    const helper = transformControls.getHelper();
    inst.scene.add(helper);

    let startBase: Partial<Record<Axis, number>> = {};
    let draggedMesh: THREE.Object3D | null = null;

    transformControls.addEventListener('mouseDown', () => {
      draggingRef.current = true;
      draggedMesh = transformControls.object ?? null;
      if (draggedMesh) {
        startBase = {
          x: draggedMesh.position.x,
          y: draggedMesh.position.y,
          z: draggedMesh.position.z,
          scale: draggedMesh.scale.x,
          rx: THREE.MathUtils.radToDeg(draggedMesh.rotation.x),
          ry: THREE.MathUtils.radToDeg(draggedMesh.rotation.y),
          rz: THREE.MathUtils.radToDeg(draggedMesh.rotation.z),
        };
      }
    });
    transformControls.addEventListener('mouseUp', () => {
      draggingRef.current = false;
      const mesh = draggedMesh;
      draggedMesh = null;
      if (!mesh) return;
      const id = mesh.name;
      // mesh.position/.rotation use the engine's Three.js-native convention
      // (Y flipped from the authored, CSS-down layer.y — see sceneBuilder.ts's
      // `mesh.position.set(tr.x, -tr.y, tr.z)`), so writes back through that
      // same flip.
      if (mesh.position.x !== startBase.x) setLayerBase(id, 'x', mesh.position.x);
      if (mesh.position.y !== startBase.y) setLayerBase(id, 'y', -mesh.position.y);
      if (mesh.position.z !== startBase.z) setLayerBase(id, 'z', mesh.position.z);
      if (mesh.scale.x !== startBase.scale) setLayerBase(id, 'scale', mesh.scale.x);
      const rx = THREE.MathUtils.radToDeg(mesh.rotation.x);
      const ry = THREE.MathUtils.radToDeg(mesh.rotation.y);
      const rz = THREE.MathUtils.radToDeg(mesh.rotation.z);
      if (rx !== startBase.rx) setLayerBase(id, 'rx', rx);
      if (ry !== startBase.ry) setLayerBase(id, 'ry', ry);
      if (rz !== startBase.rz) setLayerBase(id, 'rz', rz);
    });

    const onPointerDown = (e: PointerEvent) => {
      if (draggingRef.current) return;
      const rect = canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(ndc, inst.camera);
      const hits = raycaster.intersectObjects(inst.scene.children, true).filter((h) => h.object.name && h.object.visible);
      if (hits.length) {
        select([hits[0].object.name]);
      } else {
        transformControls.detach();
        select([]);
      }
    };
    canvas.addEventListener('pointerdown', onPointerDown);

    let raf = 0;
    const loop = () => {
      if (!draggingRef.current) inst.update(playheadRef.current);
      inst.render();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onPointerDown);
      transformControls.dispose();
      tcRef.current = null;
      inst.dispose();
      sceneRef.current = null;
    };
    // `project` itself is deliberately excluded — see the comment above.
    // WIDTH/HEIGHT are the *initial* build's canvas size only; a later
    // format switch resizes the existing scene in place (next effect)
    // rather than rebuilding, so they're excluded here too. `plan` IS
    // included — it changes rarely (a subscription activating mid-session)
    // and the watermark is baked in at build time, not soft-updatable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.layers, project?.particles, project?.camera, project?.device, assets, select, setLayerBase, plan]);

  // Latency fix: palette/text edits redraw existing textures in place
  // instead of rebuilding — see refreshContent's doc comment
  // (sceneBuilder.ts). Skipped on the render right after a structural
  // rebuild (the effect above already builds with current palette/texts;
  // React guarantees that effect runs first since it's declared first).
  useEffect(() => {
    if (!project) return;
    sceneRef.current?.refreshContent(project);
    // `project` itself deliberately excluded — only paletteId/texts should
    // trigger this (see the effect above's comment for why).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.paletteId, project?.texts]);

  // Latency fix: format switches re-frame the camera and resize the
  // background in place instead of rebuilding — see refreshFormat's doc
  // comment (sceneBuilder.ts). The canvas's own pixel size still needs to
  // change, so this also calls setSize() on both the scene and (via the
  // WIDTH/HEIGHT props already bound in the JSX below) the canvas element.
  useEffect(() => {
    if (!project || !sceneRef.current) return;
    sceneRef.current.setSize(WIDTH, HEIGHT);
    sceneRef.current.refreshFormat(project);
    // `project` itself and WIDTH/HEIGHT deliberately excluded — WIDTH/
    // HEIGHT are pure functions of project.format, and only a format
    // change should trigger this (see the first effect's comment).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.format]);

  // Keeps the gizmo attached to whichever single layer is selected (from
  // either the canvas click above or the Layers panel) and in the
  // requested mode — separate from the scene-build effect so selecting a
  // layer never rebuilds the renderer.
  useEffect(() => {
    const inst = sceneRef.current;
    const tc = tcRef.current;
    if (!inst || !tc) return;
    if (selectedIds.length === 1) {
      const mesh = inst.scene.getObjectByName(selectedIds[0]);
      if (mesh) tc.attach(mesh);
      else tc.detach();
    } else {
      tc.detach();
    }
  }, [selectedIds, ready]);

  useEffect(() => {
    tcRef.current?.setMode(mode);
  }, [mode]);

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', background: '#000', display: 'inline-block' }}>
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} style={{ display: 'block' }} />
      {!ready && <div style={{ color: '#888', fontSize: 12, padding: 8 }}>Loading…</div>}
    </div>
  );
}
