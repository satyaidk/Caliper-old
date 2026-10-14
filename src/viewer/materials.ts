import * as THREE from 'three';
import { overhangThreshold } from './printability';

/**
 * The surfaces the Engine can swap onto a model. Each one is shared by every
 * mesh it is applied to, so switching mode on a ten-thousand-part assembly
 * allocates one material, not ten thousand.
 */

/** A neutral plastic. Metalness stays low: printed parts are not chrome. */
export function filamentMaterial(colour: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: colour, metalness: 0.05, roughness: 0.55 });
}

export function wireMaterial(colour: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color: colour, wireframe: true, transparent: true, opacity: 0.7 });
}

export interface OverhangMaterial extends THREE.MeshStandardMaterial {
  setThreshold(degrees: number): void;
  setOverhangColour(hex: number): void;
}

/**
 * Bambu Studio's "show overhang": the model in its filament colour, with every
 * face that points down past the overhang limit painted red.
 *
 * The test runs per fragment on the world-space normal, so it follows the part
 * through every reorientation and explode with nothing to recompute. The view
 * matrix is orthonormal, so multiplying the view-space normal by it from the
 * left is the inverse rotation and lands back in world space. Fragments within
 * a hair of the plate are left alone: a face lying on the bed is the one face
 * that needs no support at all.
 */
export function overhangMaterial(colour: string, degrees: number, overhang: number): OverhangMaterial {
  const uniforms = {
    caliperThreshold: { value: overhangThreshold(degrees) },
    caliperOverhang: { value: new THREE.Color(overhang) },
    caliperBed: { value: 0.002 },
  };

  const material = filamentMaterial(colour) as OverhangMaterial;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCaliperWorld;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec4 caliperWorld = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          caliperWorld = instanceMatrix * caliperWorld;
        #endif
        vCaliperWorld = (modelMatrix * caliperWorld).xyz;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vCaliperWorld;
        uniform float caliperThreshold;
        uniform vec3 caliperOverhang;
        uniform float caliperBed;`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        vec3 caliperNormal = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
        if (-caliperNormal.y > caliperThreshold && vCaliperWorld.y > caliperBed) {
          diffuseColor.rgb = mix(diffuseColor.rgb, caliperOverhang, 0.82);
        }`,
      );
  };
  // One program for every overhang material, whatever its colour.
  material.customProgramCacheKey = () => 'caliper-overhang';

  material.setThreshold = (value: number) => {
    uniforms.caliperThreshold.value = overhangThreshold(value);
  };
  material.setOverhangColour = (hex: number) => {
    uniforms.caliperOverhang.value.setHex(hex);
  };
  return material;
}

/**
 * The colour a section cap is filled with: the filament, darker, so the cut
 * reads as the inside of the same material. Very dark filaments go lighter
 * instead, or the hatching would vanish into black.
 */
export function capColour(filament: string, fallback: number): number {
  const colour = new THREE.Color(filament);
  if (!Number.isFinite(colour.r)) return fallback;
  const hsl = { h: 0, s: 0, l: 0 };
  colour.getHSL(hsl);
  const lightness = hsl.l < 0.3 ? Math.min(0.55, hsl.l + 0.25) : hsl.l * 0.62;
  colour.setHSL(hsl.h, hsl.s * 0.85, lightness);
  return colour.getHex();
}
