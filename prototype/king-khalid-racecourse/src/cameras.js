// View cameras. Anchor definitions are passed in (V2: CAMERA_ANCHORS from
// kkrc_reference_definition.js; legacy: from track_definition.js) so both
// scene variants share identical camera angles for before/after comparison.

import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';

export function createCameraRig(renderer, aspect, anchors) {
  const cameras = {};
  for (const [name, a] of Object.entries(anchors)) {
    let cam;
    if (a.type === 'orthographic') {
      const hw = a.halfWidth || 500;
      cam = new THREE.OrthographicCamera(-hw, hw, hw / aspect, -hw / aspect, 1, 4000);
      cam.userData.halfWidth = hw;
    } else {
      cam = new THREE.PerspectiveCamera(a.fov || 50, aspect, 2, 12000);
    }
    cam.position.fromArray(a.position);
    cam.name = `camera_${name}`;
    cameras[name] = cam;
  }

  const first = Object.keys(anchors)[0];
  const controls = new OrbitControls(cameras[first], renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI / 2 - 0.02;
  controls.maxDistance = 4000;

  const rig = {
    cameras,
    controls,
    active: first,
    activeCamera() {
      return cameras[rig.active];
    },
    setActive(name) {
      if (!cameras[name]) return;
      rig.active = name;
      const a = anchors[name];
      const cam = cameras[name];
      cam.position.fromArray(a.position);
      controls.object = cam;
      controls.target.fromArray(a.target);
      controls.update();
    },
    setAspect(aspect) {
      for (const cam of Object.values(cameras)) {
        if (cam.isOrthographicCamera) {
          const hw = cam.userData.halfWidth;
          cam.left = -hw; cam.right = hw;
          cam.top = hw / aspect; cam.bottom = -hw / aspect;
        } else {
          cam.aspect = aspect;
        }
        cam.updateProjectionMatrix();
      }
    },
  };
  rig.setActive(first);
  return rig;
}
