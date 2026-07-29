// View cameras for the KKRC scene prototype. Anchor definitions live in
// src/track_definition.js (CAMERA_ANCHORS) so they export with the metadata.

import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { CAMERA_ANCHORS } from './track_definition.js';

export function createCameraRig(renderer, aspect) {
  const cameras = {};
  for (const [name, a] of Object.entries(CAMERA_ANCHORS)) {
    const cam = new THREE.PerspectiveCamera(a.fov, aspect, 2, 9000);
    cam.position.fromArray(a.position);
    cam.name = `camera_${name}`;
    cameras[name] = cam;
  }

  const controls = new OrbitControls(cameras.aerial, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI / 2 - 0.02;
  controls.maxDistance = 3000;

  const rig = {
    cameras,
    controls,
    active: 'aerial',
    activeCamera() {
      return cameras[rig.active];
    },
    setActive(name) {
      if (!cameras[name]) return;
      rig.active = name;
      const a = CAMERA_ANCHORS[name];
      const cam = cameras[name];
      cam.position.fromArray(a.position);
      controls.object = cam;
      controls.target.fromArray(a.target);
      controls.update();
    },
    setAspect(aspect) {
      for (const cam of Object.values(cameras)) {
        cam.aspect = aspect;
        cam.updateProjectionMatrix();
      }
    },
  };
  rig.setActive('aerial');
  return rig;
}
