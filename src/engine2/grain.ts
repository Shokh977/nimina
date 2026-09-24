/**
 * Film grain, as a custom pass instead of three.js's stock FilmPass.
 *
 * FilmShader's noise is one independent random value per output *texel*
 * (`rand(fract(vUv + time))`), so at 4K each grain speck is one physical
 * pixel — effectively invisible — while at 720p the same speck covers 8x
 * the area. docs/MOTION_GUIDE.md requires post-processing to look the same
 * at every export resolution, so grain here is quantized into cells whose
 * *physical* pixel size scales with the render resolution, keeping the
 * speck size a constant fraction of the frame regardless of output size.
 */
import * as THREE from 'three';
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass.js';

const GRAIN_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const GRAIN_FRAGMENT = /* glsl */ `
precision highp float;
#include <common>
uniform sampler2D tDiffuse;
uniform float time;
uniform float intensity;
uniform float cellPx;
varying vec2 vUv;
void main() {
  vec4 base = texture2D(tDiffuse, vUv);
  vec2 cell = floor(gl_FragCoord.xy / max(1.0, cellPx));
  // rand() returns [0,1) — remapped to [-1,1) so grain is genuinely
  // symmetric noise (real film grain darkens roughly as often as it
  // lightens). The previous clamp(0.1 + noise, 0.0, 1.0) never went
  // negative, so every speck only ever brightened the pixel beneath it —
  // found while chasing a separate render regression (an unrelated
  // washed-out/blown-highlights bug in the bloom pass) and fixed here too
  // since a one-sided "grain" was quietly skewing every frame brighter,
  // which also works against "must look exactly as... correctly coloured
  // as the source image" for anything grain touches.
  float noise = rand(fract(cell * 0.0173 + time)) * 2.0 - 1.0;
  vec3 color = base.rgb + base.rgb * noise;
  color = mix(base.rgb, color, intensity);
  gl_FragColor = vec4(color, base.a);
}`;

export class ScaledGrainPass extends Pass {
  uniforms: { tDiffuse: { value: THREE.Texture | null }; time: { value: number }; intensity: { value: number }; cellPx: { value: number } };
  material: THREE.ShaderMaterial;
  private fsQuad: FullScreenQuad;
  private referenceHeight: number;

  constructor(intensity: number, referenceHeight: number) {
    super();
    this.referenceHeight = referenceHeight;
    this.uniforms = {
      tDiffuse: { value: null },
      time: { value: 0 },
      intensity: { value: intensity },
      cellPx: { value: 1.6 },
    };
    this.material = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: GRAIN_VERTEX, fragmentShader: GRAIN_FRAGMENT });
    this.fsQuad = new FullScreenQuad(this.material);
  }

  setSize(w: number, h: number): void {
    // ~1.6px grain speck at the 1080p reference (STAGE_H=1920) — scaled
    // linearly with output height so the same fraction of frame is grainy
    // at 720p/1080p/4K alike.
    this.uniforms.cellPx.value = Math.max(1, 1.6 * (h / this.referenceHeight));
  }

  /** Tier 2 item 14 — project-level slider. */
  setIntensity(v: number): void {
    this.uniforms.intensity.value = v;
  }

  /** Latency fix: a format switch changes the world-space stage height
   * (FORMAT_STAGE_DIMS[format].h), which this pass needs to know about
   * *before* the next setSize() call — otherwise grain speck size would
   * stay pinned to whatever format the scene originally built with. */
  setReferenceHeight(h: number): void {
    this.referenceHeight = h;
  }

  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget, deltaTime: number): void {
    this.uniforms.tDiffuse.value = readBuffer.texture;
    this.uniforms.time.value += deltaTime;
    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
      this.fsQuad.render(renderer);
    } else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear) renderer.clear();
      this.fsQuad.render(renderer);
    }
  }

  dispose(): void {
    this.material.dispose();
    this.fsQuad.dispose();
  }
}
