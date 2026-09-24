/**
 * The "cutout" layer type: crops a rounded-corner rectangle out of another
 * texture (e.g. one chat bubble cut from a full conversation screenshot)
 * via a shader — UV offset/scale selects the crop region, a signed-distance
 * rounded-box function masks the corners with real anti-aliasing (cheaper
 * and crisper than baking the crop into its own canvas per layer).
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
uniform sampler2D uMap;
uniform vec2 uUvOffset;
uniform vec2 uUvScale;
uniform vec2 uSize;
uniform float uRadius;
uniform float uOpacity;

float roundedBoxSDF(vec2 p, vec2 halfSize, float r) {
  vec2 q = abs(p) - halfSize + r;
  return length(max(q, 0.0)) - r + min(max(q.x, q.y), 0.0);
}

void main() {
  vec2 local = (vUv - 0.5) * uSize;
  float d = roundedBoxSDF(local, uSize * 0.5, uRadius);
  float alpha = 1.0 - smoothstep(-1.5, 1.5, d);
  vec2 srcUv = uUvOffset + vUv * uUvScale;
  vec4 texColor = texture2D(uMap, srcUv);
  gl_FragColor = vec4(texColor.rgb, texColor.a * alpha * uOpacity);
}`;

export function isCutoutMaterial(mat: THREE.Material): mat is THREE.ShaderMaterial {
  return mat instanceof THREE.ShaderMaterial && 'uOpacity' in mat.uniforms;
}

export function setCutoutOpacity(mat: THREE.ShaderMaterial, value: number): void {
  (mat.uniforms.uOpacity as { value: number }).value = value;
}

export function createCutoutMaterial(sourceTexture: THREE.Texture, rectUv: [number, number, number, number], width: number, height: number, radiusPx: number): THREE.ShaderMaterial {
  const [x, y, w, h] = rectUv;
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: sourceTexture },
      // Texture Y is flipped relative to canvas-drawn rect coordinates
      // (flipY defaults true), so the V origin needs the same flip.
      uUvOffset: { value: new THREE.Vector2(x, 1 - y - h) },
      uUvScale: { value: new THREE.Vector2(w, h) },
      uSize: { value: new THREE.Vector2(width, height) },
      uRadius: { value: radiusPx },
      uOpacity: { value: 1 },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
  });
}
