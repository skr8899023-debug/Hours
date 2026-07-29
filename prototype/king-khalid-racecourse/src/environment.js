// Daylight environment for the KKRC scene prototype: hazy desert sky dome,
// sun + hemisphere lighting, and distance fog.

import * as THREE from 'three';

function skyDome() {
  const geo = new THREE.SphereGeometry(4200, 24, 12);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const zenith = new THREE.Color('#6f9ec7');
  const horizon = new THREE.Color('#e6dcc4');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, Math.min(1, pos.getY(i) / 4200));
    c.lerpColors(horizon, zenith, Math.pow(t, 0.55));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
  });
  const dome = new THREE.Mesh(geo, mat);
  dome.name = 'sky_dome';
  return dome;
}

export function setupEnvironment(scene, opts = {}) {
  const fogColor = opts.fogColor ?? 0xded2b6;
  scene.fog = new THREE.Fog(fogColor, opts.fogNear ?? 1400, opts.fogFar ?? 5200);
  scene.add(skyDome());

  const hemi = new THREE.HemisphereLight(
    opts.hemiSky ?? 0xbcd3e8, opts.hemiGround ?? 0xcbb083, opts.hemiIntensity ?? 0.9);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(opts.sunColor ?? 0xfff2df, opts.sunIntensity ?? 2.4);
  sun.position.set(-500, 700, -350);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const cam = sun.shadow.camera;
  cam.left = cam.bottom = -700;
  cam.right = cam.top = 700;
  cam.near = 100;
  cam.far = 2200;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);

  return { hemi, sun };
}
