// KKRC scene prototype — entry point.
// Assembles geometry, materials, props, environment, and the camera rig.
// Deliberately contains no gameplay logic and no mobile-controller wiring:
// this is a standalone visual-fidelity prototype.

import * as THREE from 'three';
import { createMaterials } from './materials.js';
import { buildTrackGroup } from './geometry.js';
import { buildProps } from './props.js';
import { setupEnvironment } from './environment.js';
import { createCameraRig } from './cameras.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
const materials = createMaterials();
scene.add(buildTrackGroup(materials));
scene.add(buildProps(materials));
setupEnvironment(scene);

const rig = createCameraRig(renderer, window.innerWidth / window.innerHeight);

// HUD camera buttons + number keys 1-4
const buttons = document.querySelectorAll('#hud button[data-camera]');
function activate(name) {
  rig.setActive(name);
  buttons.forEach((b) => b.classList.toggle('active', b.dataset.camera === name));
}
buttons.forEach((b) => b.addEventListener('click', () => activate(b.dataset.camera)));
const keyMap = { 1: 'aerial', 2: 'trackside', 3: 'grandstand', 4: 'overview' };
window.addEventListener('keydown', (e) => {
  if (keyMap[e.key]) activate(keyMap[e.key]);
});

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  rig.setAspect(window.innerWidth / window.innerHeight);
});

renderer.setAnimationLoop(() => {
  rig.controls.update();
  renderer.render(scene, rig.activeCamera());
});

// Small hook for automated capture / smoke tests (not gameplay).
window.KKRC = {
  setCamera: activate,
  renderOnce: () => renderer.render(scene, rig.activeCamera()),
  stats: () => ({
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    geometries: renderer.info.memory.geometries,
    textures: renderer.info.memory.textures,
  }),
  ready: true,
};
