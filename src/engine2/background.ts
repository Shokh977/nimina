/**
 * Animated mesh-gradient background — four soft color blobs blended over a
 * base color, slowly drifting. A real fragment shader (not a canvas
 * texture) so it costs nothing to keep large and stays crisp at any
 * resolution. Per docs/MOTION_GUIDE.md: "mesh or multi-stop gradients,
 * never flat," plus the idle-drift rule ("nothing is fully static").
 */
import * as THREE from 'three';

const VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAGMENT_SHADER = `
precision highp float;
varying vec2 vUv;
uniform vec3 uBase;
uniform vec3 uColor0;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uPos0;
uniform vec2 uPos1;
uniform vec2 uPos2;
uniform vec2 uPos3;

float blobField(vec2 uv, vec2 center, float radius) {
  float d = distance(uv, center);
  return smoothstep(radius, 0.0, d);
}

void main() {
  vec2 uv = vUv;
  vec3 col = uBase;
  col = mix(col, uColor0, blobField(uv, uPos0, 0.62) * 0.95);
  col = mix(col, uColor1, blobField(uv, uPos1, 0.58) * 0.9);
  col = mix(col, uColor2, blobField(uv, uPos2, 0.6) * 0.9);
  col = mix(col, uColor3, blobField(uv, uPos3, 0.55) * 0.85);
  gl_FragColor = vec4(col, 1.0);
}`;

export interface MeshGradientBackground {
  mesh: THREE.Mesh;
  update(t: number, seed: number): void;
  /** In-place palette swap (latency fix: palette switching must not rebuild
   * the scene) — mutates the existing uniforms' THREE.Color objects rather
   * than replacing them, so no new GPU objects are created. */
  updateColors(colors: { base: string; b: [string, string, string, string] }): void;
  /** In-place resize (latency fix: format switching must not rebuild the
   * scene) — swaps just this mesh's geometry for one sized to the new
   * format's stage dims; everything else about the mesh is untouched. */
  resize(width: number, height: number): void;
  dispose(): void;
}

export function createMeshGradientBackground(width: number, height: number, colors: { base: string; b: [string, string, string, string] }): MeshGradientBackground {
  const c = (hex: string) => new THREE.Color(hex);
  const uniforms = {
    uBase: { value: c(colors.base) },
    uColor0: { value: c(colors.b[0]) },
    uColor1: { value: c(colors.b[1]) },
    uColor2: { value: c(colors.b[2]) },
    uColor3: { value: c(colors.b[3]) },
    uPos0: { value: new THREE.Vector2(0.22, 0.28) },
    uPos1: { value: new THREE.Vector2(0.78, 0.22) },
    uPos2: { value: new THREE.Vector2(0.74, 0.78) },
    uPos3: { value: new THREE.Vector2(0.18, 0.74) },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: VERTEX_SHADER, fragmentShader: FRAGMENT_SHADER, depthWrite: false, depthTest: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  // Marks this as the full-frame background plane for camera.ts's
  // non-surface coverage mask (see nonSurfaceMaskTarget's doc comment) —
  // that pass hides every surface mesh to see what non-surface content
  // remains, but the background sits behind *everything* and would flood
  // the mask with full coverage the instant anything in front of it is
  // hidden, defeating the mask entirely. Excluded from that pass, not from
  // bloom/tone-mapping (unrelated — this flag is mask-specific).
  mesh.userData.isBackgroundPlane = true;

  function update(t: number, seed: number): void {
    const wobble = (v: THREE.Vector2, cx: number, cy: number, phase: number) => {
      v.set(cx + Math.sin(t * 0.15 + phase) * 0.07, cy + Math.cos(t * 0.12 + phase * 1.37) * 0.07);
    };
    wobble(uniforms.uPos0.value, 0.22, 0.28, seed * 1.7);
    wobble(uniforms.uPos1.value, 0.78, 0.22, seed * 2.9 + 1);
    wobble(uniforms.uPos2.value, 0.74, 0.78, seed * 3.4 + 2);
    wobble(uniforms.uPos3.value, 0.18, 0.74, seed * 4.6 + 3);
  }

  function updateColors(colors: { base: string; b: [string, string, string, string] }): void {
    (uniforms.uBase.value as THREE.Color).set(colors.base);
    (uniforms.uColor0.value as THREE.Color).set(colors.b[0]);
    (uniforms.uColor1.value as THREE.Color).set(colors.b[1]);
    (uniforms.uColor2.value as THREE.Color).set(colors.b[2]);
    (uniforms.uColor3.value as THREE.Color).set(colors.b[3]);
  }

  function resize(w: number, h: number): void {
    const old = mesh.geometry;
    mesh.geometry = new THREE.PlaneGeometry(w, h);
    old.dispose();
  }

  function dispose(): void {
    mesh.geometry.dispose();
    material.dispose();
  }

  return { mesh, update, updateColors, resize, dispose };
}
