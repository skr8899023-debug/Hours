// KKRC scene prototype — entry point.
// Two scene variants behind a feature toggle (?variant=legacy|v2, default v2):
//   legacy — the original V1 scene, kept intact for comparison
//   v2     — the reference-calibrated reconstruction
// Both variants render through the SAME V2 camera rig so before/after
// screenshots share identical angles. No gameplay / mobile-controller logic.

import * as THREE from 'three';
import { createCameraRig } from './cameras.js';
import { setupEnvironment } from './environment.js';
import { CAMERA_ANCHORS as V2_ANCHORS } from './kkrc_reference_definition.js';
import { createReferenceOverlay } from './reference_overlay.js';

const params = new URLSearchParams(location.search);
const variant = params.get('variant') === 'legacy' ? 'legacy' : 'v2';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();

if (variant === 'legacy') {
  const { createMaterials } = await import('./materials.js');
  const { buildTrackGroup } = await import('./geometry.js');
  const { buildProps } = await import('./props.js');
  const materials = createMaterials();
  scene.add(buildTrackGroup(materials));
  scene.add(buildProps(materials));
  setupEnvironment(scene);
} else {
  const { createMaterialsV2 } = await import('./materials_v2.js');
  const { buildSurfaces } = await import('./geometry_v2.js');
  const { buildPropsV2 } = await import('./props_v2.js');
  const materials = createMaterialsV2();
  scene.add(buildSurfaces(materials));
  scene.add(buildPropsV2(materials));
  // bright but slightly hazy Taif daylight, neutral-warm white balance
  setupEnvironment(scene, {
    fogColor: 0xd9d5c9, fogNear: 1600, fogFar: 6200,
    hemiSky: 0xc3d6e6, hemiGround: 0xc8b28c, hemiIntensity: 1.0,
    sunColor: 0xfff6e8, sunIntensity: 2.3,
  });
}

const rig = createCameraRig(renderer, window.innerWidth / window.innerHeight, V2_ANCHORS);
const overlay = await createReferenceOverlay(scene);

// HUD
const buttons = document.querySelectorAll('#hud button[data-camera]');
function activate(name) {
  rig.setActive(name);
  buttons.forEach((b) => b.classList.toggle('active', b.dataset.camera === name));
}
buttons.forEach((b) => b.addEventListener('click', () => activate(b.dataset.camera)));

const keyMap = {
  1: 'referenceMatch', 2: 'topOrthographic', 3: 'aerialHero',
  4: 'trackside', 5: 'grandstand', 6: 'integrationOverview',
};
window.addEventListener('keydown', (e) => {
  if (keyMap[e.key]) activate(keyMap[e.key]);
  if (e.key === 'r' || e.key === 'R') toggleReferenceMode();
});

// REFERENCE ALIGNMENT MODE toggle (also on the HUD)
let refMode = false;
function toggleReferenceMode(force) {
  refMode = force !== undefined ? force : !refMode;
  overlay.setEnabled(refMode);
  if (refMode) activate('topOrthographic');
  document.getElementById('refBtn').classList.toggle('active', refMode);
}
document.getElementById('refBtn').addEventListener('click', () => toggleReferenceMode());

// variant switch link
const variantBtn = document.getElementById('variantBtn');
variantBtn.textContent = variant === 'v2' ? 'V2 · switch to legacy' : 'legacy · switch to V2';
variantBtn.addEventListener('click', () => {
  const p = new URLSearchParams(location.search);
  p.set('variant', variant === 'v2' ? 'legacy' : 'v2');
  location.search = p.toString();
});
document.getElementById('title').textContent =
  `King Khalid Racecourse — scene prototype [${variant}] (no gameplay wiring)`;

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  rig.setAspect(window.innerWidth / window.innerHeight);
});

renderer.setAnimationLoop(() => {
  rig.controls.update();
  renderer.render(scene, rig.activeCamera());
});

// hooks for automated capture / smoke tests (not gameplay)
window.KKRC = {
  variant,
  setCamera: activate,
  setReferenceMode: (on, opacity) => {
    toggleReferenceMode(on);
    if (opacity !== undefined) overlay.setOpacity(opacity);
  },
  setDiffMode: (mode) => overlay.setDiffMode(mode),
  setBoundaries: (on) => overlay.setBoundaries(on),
  overlayState: () => ({ ...overlay.state }),
  exportAlignment: () => overlay.exportAlignment(rig.activeCamera()),
  renderOnce: () => renderer.render(scene, rig.activeCamera()),
  stats: () => ({
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    geometries: renderer.info.memory.geometries,
    textures: renderer.info.memory.textures,
  }),
  ready: true,
};
