/**
 * Vignette post-process — darkens frame corners, intensity-controlled.
 * Tier 2 item 14: exposed as a project-level slider (0 = off, matching
 * every existing project/template, which predates this field and has no
 * vignette applied by default — this is purely additive).
 */
import * as THREE from 'three';
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass.js';

const VIGNETTE_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const VIGNETTE_FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D tDiffuse;
uniform float intensity;
varying vec2 vUv;
void main() {
  vec4 base = texture2D(tDiffuse, vUv);
  float dist = length(vUv - 0.5) * 1.4142136;
  float vig = 1.0 - intensity * smoothstep(0.3, 0.9, dist);
  gl_FragColor = vec4(base.rgb * vig, base.a);
}`;

export class VignettePass extends Pass {
  uniforms: { tDiffuse: { value: THREE.Texture | null }; intensity: { value: number } };
  material: THREE.ShaderMaterial;
  private fsQuad: FullScreenQuad;

  constructor(intensity: number) {
    super();
    this.uniforms = { tDiffuse: { value: null }, intensity: { value: intensity } };
    this.material = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: VIGNETTE_VERTEX, fragmentShader: VIGNETTE_FRAGMENT });
    this.fsQuad = new FullScreenQuad(this.material);
  }

  setIntensity(v: number): void {
    this.uniforms.intensity.value = v;
  }

  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget): void {
    this.uniforms.tDiffuse.value = readBuffer.texture;
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
