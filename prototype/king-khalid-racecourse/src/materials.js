// Material library for the KKRC scene prototype.
// All materials are created once and shared. Subtle procedural noise textures
// (canvas-generated, no external files) break up the flat ground colors.

import * as THREE from 'three';

function noiseTexture(base, variation, size = 256, scale = 8) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const b = new THREE.Color(base);
  const img = ctx.createImageData(size, size);
  let seed = 1234;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < size * size; i++) {
    const n = (rand() - 0.5) * 2 * variation;
    img.data[i * 4 + 0] = Math.min(255, Math.max(0, b.r * 255 + n * 255));
    img.data[i * 4 + 1] = Math.min(255, Math.max(0, b.g * 255 + n * 255));
    img.data[i * 4 + 2] = Math.min(255, Math.max(0, b.b * 255 + n * 255));
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(scale, scale);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createMaterials() {
  return {
    // ground surfaces
    dirtMain: new THREE.MeshStandardMaterial({
      map: noiseTexture('#b06a3e', 0.045, 256, 24),
      roughness: 0.95,
    }),
    sandTraining: new THREE.MeshStandardMaterial({
      map: noiseTexture('#d8b47c', 0.04, 256, 24),
      roughness: 0.95,
    }),
    infieldSand: new THREE.MeshStandardMaterial({
      map: noiseTexture('#dcc79b', 0.035, 256, 16),
      roughness: 1.0,
    }),
    desert: new THREE.MeshStandardMaterial({
      map: noiseTexture('#cdb287', 0.05, 256, 48),
      roughness: 1.0,
    }),
    verge: new THREE.MeshStandardMaterial({ color: 0xbfa270, roughness: 1 }),
    path: new THREE.MeshStandardMaterial({ color: 0xe2d5b0, roughness: 0.9 }),
    asphalt: new THREE.MeshStandardMaterial({ color: 0x4a4a4c, roughness: 0.9 }),
    green: new THREE.MeshStandardMaterial({
      map: noiseTexture('#587a36', 0.05, 128, 6),
      roughness: 1.0,
    }),
    greenDark: new THREE.MeshStandardMaterial({ color: 0x44622c, roughness: 1 }),
    water: new THREE.MeshStandardMaterial({
      color: 0x3d7fa6, roughness: 0.15, metalness: 0.1,
    }),

    // rails / structures
    railWhite: new THREE.MeshStandardMaterial({
      color: 0xf4f4f0, roughness: 0.5, side: THREE.DoubleSide,
    }),
    finishLine: new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.7 }),
    stone: new THREE.MeshStandardMaterial({ color: 0xd8cdb4, roughness: 0.8 }),
    buildingBeige: new THREE.MeshStandardMaterial({ color: 0xd9cbb0, roughness: 0.85 }),
    buildingWhite: new THREE.MeshStandardMaterial({ color: 0xefece4, roughness: 0.7 }),
    roofDark: new THREE.MeshStandardMaterial({ color: 0x6d5b46, roughness: 0.8 }),
    canopyWhite: new THREE.MeshStandardMaterial({
      color: 0xf8f8f6, roughness: 0.8, side: THREE.DoubleSide,
    }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x7fa3b8, roughness: 0.2, metalness: 0.6,
    }),
    steel: new THREE.MeshStandardMaterial({ color: 0x9a9a98, roughness: 0.5, metalness: 0.4 }),
    lightHead: new THREE.MeshStandardMaterial({
      color: 0xeeeeee, emissive: 0xbfc8d0, emissiveIntensity: 0.35,
    }),

    // vegetation
    palmTrunk: new THREE.MeshStandardMaterial({ color: 0x8a6f4d, roughness: 1 }),
    palmFrond: new THREE.MeshStandardMaterial({
      color: 0x3f6b2a, roughness: 1, side: THREE.DoubleSide,
    }),
    shrub: new THREE.MeshStandardMaterial({ color: 0x4f7031, roughness: 1 }),

    // far surroundings
    hills: new THREE.MeshStandardMaterial({ color: 0xa89a86, roughness: 1, flatShading: true }),
    town: new THREE.MeshStandardMaterial({ color: 0xcfc3ab, roughness: 0.95 }),
  };
}
