/**
 * Free-plan watermark for Engine v2 — infrastructure merge (Tier 1's
 * "same plan gating and watermark that classic has today"). Classic draws
 * this as a plain 2D overlay in the bottom-right corner (src/engine/
 * overlays.ts's drawWatermark) because its "camera" is a 2D drift
 * simulation, not a real perspective camera, so a fixed screen position is
 * just a fixed canvas position. Engine v2's camera is a genuine 3D
 * THREE.PerspectiveCamera that dollies/pans/zooms per template — parenting
 * a watermark mesh to scene content would make it drift or change size
 * with every camera move, so this is a *separate orthographic overlay*,
 * rendered as one extra pass after the main scene, sized to exactly match
 * pixel dimensions so "bottom-right corner" means the same thing at every
 * resolution and every format.
 */
import * as THREE from 'three';

export interface WatermarkOverlay {
  render(renderer: THREE.WebGLRenderer): void;
  setSize(w: number, h: number): void;
  dispose(): void;
}

const LABEL = 'Made with Promo Studio';

function drawTexture(w: number, h: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);
  const fontPx = Math.round(h * 0.42);
  ctx.font = `600 ${fontPx}px system-ui, sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const pad = w * 0.08;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillText(LABEL, w - pad + 1, h / 2 + 1);
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.fillText(LABEL, w - pad, h / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createWatermarkOverlay(width: number, height: number): WatermarkOverlay {
  const scene = new THREE.Scene();
  // Symmetric frustum centered at the origin (Y-up) — near/far are
  // positive distances from the camera (at z=1) along its viewing
  // direction, comfortably bracketing content at z=0. Real bug caught
  // while verifying this: an *asymmetric* frustum (left=0, right=width,
  // rather than left=-width/2, right=width/2) rendered nothing at all —
  // no WebGL error, no thrown exception, every logged value (viewport,
  // render target, mesh position/visibility, material opacity) looked
  // exactly correct, and even an opaque full-viewport quad using that
  // camera was invisible. Switching to a symmetric, origin-centered
  // frustum (this version) fixed it immediately with no other change.
  const camera = new THREE.OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, 0.1, 10);
  camera.position.z = 1;

  // A fixed-pixel-height strip in the bottom-right corner, independent of
  // output resolution (same spirit as grain.ts's cellPx scaling — a
  // watermark that's a constant *fraction* of frame height, not a
  // constant pixel count, so it reads the same at 720p and 4K).
  let stripH = 0;
  let stripW = 0;
  let mesh: THREE.Mesh | null = null;
  let texture: THREE.CanvasTexture | null = null;

  function build(w: number, h: number): void {
    if (mesh) {
      scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      texture?.dispose();
    }
    stripH = Math.max(14, Math.round(h * 0.024));
    stripW = Math.round(stripH * 9); // wide enough for the label at this height
    texture = drawTexture(stripW, stripH);
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
    const geo = new THREE.PlaneGeometry(stripW, stripH);
    mesh = new THREE.Mesh(geo, material);
    const margin = stripH * 0.5;
    // Right edge is +w/2, bottom edge is -h/2 in this symmetric, Y-up frustum.
    mesh.position.set(w / 2 - stripW / 2 - margin, -(h / 2 - stripH / 2 - margin), 0);
    scene.add(mesh);
  }

  function setSize(w: number, h: number): void {
    camera.left = -w / 2;
    camera.right = w / 2;
    camera.top = h / 2;
    camera.bottom = -h / 2;
    camera.updateProjectionMatrix();
    build(w, h);
  }
  setSize(width, height);

  function render(renderer: THREE.WebGLRenderer): void {
    // autoClear=false preserves the main scene (color buffer) this draws
    // on top of. Second real bug caught while verifying this: that alone
    // made the draw completely invisible (not a positioning/size/contrast
    // issue — a genuine no-op) because the *depth* buffer is also left
    // uncleared, still holding whatever the composer's own last pass wrote
    // there, and this mesh's fragments lost the depth test against it even
    // with depthTest:false on the material (that only controls this
    // mesh's own state, not what's already in the buffer). Fix: clear
    // only the depth buffer (clearDepth()), not color.
    const prevAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(scene, camera);
    renderer.autoClear = prevAutoClear;
  }

  function dispose(): void {
    if (mesh) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    texture?.dispose();
  }

  return { render, setSize, dispose };
}
