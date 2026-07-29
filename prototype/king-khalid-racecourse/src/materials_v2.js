// KKRC V2 material library.
// Multi-scale procedural textures (canvas, no external files): large-scale
// color mottling + fine grain + longitudinal grooming streaks for the dirt.
// Contrast is kept low and mipmaps enabled to avoid moiré / speckling from
// the aerial cameras.

import * as THREE from 'three';

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Generic multi-scale ground texture: soft large blotches over a base color
// plus very low amplitude per-pixel grain.
function groundTexture({ base, blotches = [], grain = 0.02, streaks = 0, edgeWear = 0, size = 512, seed = 7 }) {
  const rng = mulberry32(seed);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  // large-scale variation: soft radial gradients in related hues
  for (const b of blotches) {
    for (let i = 0; i < b.count; i++) {
      const x = rng() * size, y = rng() * size;
      const r = (b.rMin + rng() * (b.rMax - b.rMin)) * size;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const a = b.alpha * (0.6 + rng() * 0.8);
      g.addColorStop(0, hexA(b.color, a));
      g.addColorStop(1, hexA(b.color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }

  // longitudinal grooming / hoof-traffic streaks (texture x runs along the
  // track, y across it) — very faint horizontal bands
  if (streaks > 0) {
    for (let i = 0; i < streaks; i++) {
      const y = rng() * size;
      const h = 1 + rng() * 2.5;
      const light = rng() > 0.5;
      ctx.fillStyle = light ? 'rgba(255,240,220,0.035)' : 'rgba(60,35,20,0.04)';
      ctx.fillRect(0, y, size, h);
    }
  }

  // edge wear: slightly darker, churned dirt near both edges of the band
  if (edgeWear > 0) {
    const g1 = ctx.createLinearGradient(0, 0, 0, size * 0.12);
    g1.addColorStop(0, `rgba(70,40,22,${edgeWear})`);
    g1.addColorStop(1, 'rgba(70,40,22,0)');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, size, size * 0.12);
    const g2 = ctx.createLinearGradient(0, size, 0, size * 0.88);
    g2.addColorStop(0, `rgba(70,40,22,${edgeWear})`);
    g2.addColorStop(1, 'rgba(70,40,22,0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, size * 0.88, size, size * 0.12);
  }

  // fine grain, low amplitude
  if (grain > 0) {
    const img = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < size * size; i++) {
      const n = (rng() - 0.5) * 2 * grain * 255;
      img.data[i * 4] += n;
      img.data[i * 4 + 1] += n;
      img.data[i * 4 + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function hexA(hex, a) {
  const c = new THREE.Color(hex);
  return `rgba(${(c.r * 255) | 0},${(c.g * 255) | 0},${(c.b * 255) | 0},${a})`;
}

export function createMaterialsV2() {
  // main dirt: warm clay / terracotta, NOT saturated burgundy
  const dirtTex = groundTexture({
    base: '#b3835c',
    blotches: [
      { color: '#c69a6d', count: 26, rMin: 0.08, rMax: 0.30, alpha: 0.10 },
      { color: '#9a6a44', count: 26, rMin: 0.06, rMax: 0.22, alpha: 0.10 },
      { color: '#c07a4d', count: 12, rMin: 0.10, rMax: 0.35, alpha: 0.06 },
    ],
    grain: 0.014,
    streaks: 70,
    edgeWear: 0.09,
    seed: 11,
  });
  dirtTex.repeat.set(26, 1);
  dirtTex.wrapT = THREE.ClampToEdgeWrapping; // v spans the band width exactly once

  const sandTex = groundTexture({
    base: '#d2a878',
    blotches: [
      { color: '#e0c194', count: 20, rMin: 0.08, rMax: 0.28, alpha: 0.09 },
      { color: '#bf9a6b', count: 20, rMin: 0.06, rMax: 0.2, alpha: 0.08 },
    ],
    grain: 0.015,
    streaks: 50,
    edgeWear: 0.06,
    seed: 23,
  });
  sandTex.repeat.set(26, 1);
  sandTex.wrapT = THREE.ClampToEdgeWrapping;

  const infieldTex = groundTexture({
    base: '#d6bd92',
    blotches: [
      { color: '#e2cea4', count: 20, rMin: 0.1, rMax: 0.3, alpha: 0.05 },
      { color: '#c2a375', count: 20, rMin: 0.08, rMax: 0.26, alpha: 0.05 },
    ],
    grain: 0.010,
    seed: 31,
  });
  infieldTex.repeat.set(12, 12);

  const desertTex = groundTexture({
    base: '#cbb188',
    blotches: [
      { color: '#d9c093', count: 20, rMin: 0.1, rMax: 0.3, alpha: 0.05 },
      { color: '#b79b72', count: 20, rMin: 0.08, rMax: 0.26, alpha: 0.05 },
    ],
    grain: 0.010,
    seed: 47,
  });
  desertTex.repeat.set(64, 64);

  const asphaltTex = groundTexture({
    base: '#7a7876',
    blotches: [
      { color: '#8b8987', count: 18, rMin: 0.1, rMax: 0.3, alpha: 0.07 },
      { color: '#686664', count: 18, rMin: 0.08, rMax: 0.24, alpha: 0.07 },
    ],
    grain: 0.010,
    seed: 53,
  });
  asphaltTex.repeat.set(30, 1);
  asphaltTex.wrapT = THREE.ClampToEdgeWrapping;

  return {
    dirtMain: new THREE.MeshStandardMaterial({ map: dirtTex, roughness: 0.97 }),
    sandTraining: new THREE.MeshStandardMaterial({ map: sandTex, roughness: 0.97 }),
    infieldSand: new THREE.MeshStandardMaterial({ map: infieldTex, roughness: 1 }),
    desert: new THREE.MeshStandardMaterial({ map: desertTex, roughness: 1 }),
    asphalt: new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 0.92 }),
    asphaltFlat: new THREE.MeshStandardMaterial({ color: 0x8b8987, roughness: 0.92 }),
    verge: new THREE.MeshStandardMaterial({ color: 0xc4a97c, roughness: 1 }),
    servicePath: new THREE.MeshStandardMaterial({ color: 0xcfc2a6, roughness: 0.95 }),
    path: new THREE.MeshStandardMaterial({ color: 0xd8cbab, roughness: 0.95 }),
    pathMinor: new THREE.MeshStandardMaterial({ color: 0xccbf9e, roughness: 0.95 }),

    green: new THREE.MeshStandardMaterial({ color: 0x6a7a48, roughness: 1 }),
    greenDark: new THREE.MeshStandardMaterial({ color: 0x55643c, roughness: 1 }),
    paddockGreen: new THREE.MeshStandardMaterial({ color: 0x5f7a44, roughness: 1 }),

    railWhite: new THREE.MeshStandardMaterial({ color: 0xf2f1ec, roughness: 0.55, side: THREE.DoubleSide }),
    fenceGrey: new THREE.MeshStandardMaterial({ color: 0xb9b7b2, roughness: 0.7, side: THREE.DoubleSide }),
    stone: new THREE.MeshStandardMaterial({ color: 0xd6ccb6, roughness: 0.85 }),
    finishLine: new THREE.MeshStandardMaterial({ color: 0xf5f4f0, roughness: 0.75 }),

    buildingBeige: new THREE.MeshStandardMaterial({ color: 0xd8ccb4, roughness: 0.85 }),
    buildingWhite: new THREE.MeshStandardMaterial({ color: 0xece9e1, roughness: 0.75 }),
    roofDark: new THREE.MeshStandardMaterial({ color: 0x7a6a55, roughness: 0.85 }),
    canopyWhite: new THREE.MeshStandardMaterial({ color: 0xf5f4f0, roughness: 0.8, side: THREE.DoubleSide }),
    glass: new THREE.MeshStandardMaterial({ color: 0x8ba7b8, roughness: 0.25, metalness: 0.5 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x9c9c9a, roughness: 0.55, metalness: 0.35 }),
    lightHead: new THREE.MeshStandardMaterial({ color: 0xe8e8e6, emissive: 0xb8c2ca, emissiveIntensity: 0.3 }),

    palmTrunk: new THREE.MeshStandardMaterial({ color: 0x8f7454, roughness: 1 }),
    palmFrond: new THREE.MeshStandardMaterial({ color: 0x5d6b3d, roughness: 1, side: THREE.DoubleSide }),
    shrub: new THREE.MeshStandardMaterial({ color: 0x60703f, roughness: 1 }),

    ridge: new THREE.MeshStandardMaterial({ color: 0xa89b83, roughness: 1 }),
    town: new THREE.MeshStandardMaterial({ color: 0xd2c7b0, roughness: 0.95 }),
    townDark: new THREE.MeshStandardMaterial({ color: 0xbfb29a, roughness: 0.95 }),
  };
}
