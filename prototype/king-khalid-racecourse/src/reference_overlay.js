// REFERENCE ALIGNMENT MODE
// Top-orthographic view with the aerial reference as a ground overlay:
//  - opacity / scale / rotation / offset controls (exportable to JSON)
//  - digitized landmark markers from reference/reference_landmarks.json
//  - optional 50 m coordinate grid
// The real photo is loaded from reference/kkrc_aerial_reference.(jpg|png) if
// present, or via drag & drop. Without it, a schematic redraw generated from
// the digitized landmark image-space coordinates is used, so alignment can
// still be judged against the digitization rather than against the model.

import * as THREE from 'three';

const IMG_CANDIDATES = [
  '../reference/kkrc_aerial_reference.jpg',
  '../reference/kkrc_aerial_reference.png',
];

export async function createReferenceOverlay(scene) {
  const state = {
    enabled: false,
    opacity: 0.5,
    scale: 1.0,        // multiplier over meters_per_image_height
    rotationDeg: 0,
    offsetX: 0,
    offsetZ: 0,
    imageSource: 'schematic (drop the aerial photo onto the page to replace)',
  };

  let landmarksDoc = null;
  try {
    const res = await fetch('../reference/reference_landmarks.json');
    landmarksDoc = await res.json();
  } catch (e) {
    console.warn('reference_landmarks.json not reachable:', e);
  }
  const H = landmarksDoc?.image_mapping?.meters_per_image_height ?? 830;
  const W = landmarksDoc?.image_mapping?.meters_per_image_width ?? 623;

  const group = new THREE.Group();
  group.name = 'reference_alignment';
  group.visible = false;
  scene.add(group);

  // --- overlay plane (image plane axes: plane +x = image u -> -Z model,
  //     plane +y(=world -z after rotX) = image v -> ... handled by mapping) ---
  const planeGeo = new THREE.PlaneGeometry(1, 1);
  const planeMat = new THREE.MeshBasicMaterial({
    transparent: true, opacity: state.opacity, depthWrite: false, depthTest: false,
  });
  const plane = new THREE.Mesh(planeGeo, planeMat);
  plane.rotation.x = -Math.PI / 2;
  plane.renderOrder = 900;
  plane.position.y = 1.5;
  group.add(plane);

  function fitPlane() {
    // documented mapping: image-top -> model -X, image-left -> model +Z.
    // After rotation.x = -90°, an extra +90° in-plane rotation sends the
    // image top to -X and the image right edge to -Z.
    plane.scale.set(W * state.scale, H * state.scale, 1);
    plane.rotation.z = Math.PI / 2 + (state.rotationDeg * Math.PI) / 180;
    plane.position.set(state.offsetX, 1.5, state.offsetZ);
  }

  function schematicTexture() {
    // redraw of the digitized reference: track boundary landmarks + features,
    // drawn purely from image_uv values (independent of the 3D model data)
    const cw = 512, ch = Math.round(512 * (H / W));
    const canvas = document.createElement('canvas');
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(20,40,70,0.35)';
    ctx.fillRect(0, 0, cw, ch);
    if (landmarksDoc) {
      ctx.fillStyle = '#7fd7ff';
      ctx.strokeStyle = '#7fd7ff';
      ctx.font = '11px sans-serif';
      for (const lm of landmarksDoc.landmarks) {
        if (!lm.in_frame) continue;
        const [u, v] = lm.image_uv;
        const px = u * cw, py = v * ch;
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillRect(px - 0.75, py - 8, 1.5, 16);
        ctx.fillRect(px - 8, py - 0.75, 16, 1.5);
        ctx.fillText(lm.id, px + 7, py - 5);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  async function tryLoadPhoto() {
    const loader = new THREE.TextureLoader();
    for (const url of IMG_CANDIDATES) {
      try {
        const tex = await loader.loadAsync(url);
        tex.colorSpace = THREE.SRGBColorSpace;
        state.imageSource = url.replace('../', '');
        return tex;
      } catch { /* keep trying */ }
    }
    return null;
  }

  // texture orientation: canvas/photo v runs top->bottom, plane local +y runs
  // bottom->top — flip Y so image-top lands at plane local +y (= model -X
  // after the -90° yaw), matching the documented mapping.
  function applyTexture(tex) {
    tex.flipY = true;
    planeMat.map = tex;
    planeMat.needsUpdate = true;
  }

  const photo = await tryLoadPhoto();
  applyTexture(photo || schematicTexture());

  // --- landmark markers in model space (green rings, always in meters) ---
  const markers = new THREE.Group();
  markers.renderOrder = 901;
  if (landmarksDoc) {
    const ringGeo = new THREE.RingGeometry(2.2, 3.2, 20);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x6bff9e, depthTest: false, transparent: true, opacity: 0.95, side: THREE.DoubleSide,
    });
    for (const lm of landmarksDoc.landmarks) {
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(lm.model_xz[0], 2.2, lm.model_xz[1]);
      ring.renderOrder = 901;
      markers.add(ring);
    }
  }
  group.add(markers);

  // --- 50 m grid ---
  const grid = new THREE.GridHelper(2000, 40, 0x224466, 0x224466);
  grid.material.transparent = true;
  grid.material.opacity = 0.35;
  grid.position.y = 1.0;
  grid.visible = false;
  group.add(grid);

  // --- HTML control panel ---
  const panel = document.createElement('div');
  panel.id = 'refPanel';
  panel.innerHTML = `
    <strong>REFERENCE ALIGNMENT MODE</strong>
    <label>Opacity <input type="range" id="refOp" min="0" max="1" step="0.05" value="0.5"></label>
    <label>Scale <input type="range" id="refSc" min="0.5" max="1.5" step="0.005" value="1"></label>
    <label>Rotate° <input type="range" id="refRot" min="-15" max="15" step="0.25" value="0"></label>
    <label>Offset X <input type="range" id="refOX" min="-150" max="150" step="1" value="0"></label>
    <label>Offset Z <input type="range" id="refOZ" min="-150" max="150" step="1" value="0"></label>
    <div class="refBtns">
      <button id="refImgToggle">image on/off</button>
      <button id="refGrid">grid</button>
      <button id="refMarks">landmarks</button>
      <button id="refExport">export JSON</button>
    </div>
    <small id="refSrc"></small>`;
  panel.style.display = 'none';
  document.body.appendChild(panel);
  panel.querySelector('#refSrc').textContent = `source: ${state.imageSource}`;

  const bind = (id, fn) => panel.querySelector(id).addEventListener('input', fn);
  bind('#refOp', (e) => { state.opacity = +e.target.value; planeMat.opacity = state.opacity; });
  bind('#refSc', (e) => { state.scale = +e.target.value; fitPlane(); });
  bind('#refRot', (e) => { state.rotationDeg = +e.target.value; fitPlane(); });
  bind('#refOX', (e) => { state.offsetX = +e.target.value; fitPlane(); });
  bind('#refOZ', (e) => { state.offsetZ = +e.target.value; fitPlane(); });
  panel.querySelector('#refImgToggle').addEventListener('click', () => { plane.visible = !plane.visible; });
  panel.querySelector('#refGrid').addEventListener('click', () => { grid.visible = !grid.visible; });
  panel.querySelector('#refMarks').addEventListener('click', () => { markers.visible = !markers.visible; });
  panel.querySelector('#refExport').addEventListener('click', () => {
    const out = {
      format: 'kkrc-reference-alignment',
      image: state.imageSource,
      meters_per_image_height: H * state.scale,
      meters_per_image_width: W * state.scale,
      rotation_deg: state.rotationDeg,
      offset_meters: [state.offsetX, state.offsetZ],
      opacity: state.opacity,
    };
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'reference_alignment.json';
    a.click();
  });

  // drag & drop the real aerial photo
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const tex = new THREE.TextureLoader().load(URL.createObjectURL(file), () => {
      tex.colorSpace = THREE.SRGBColorSpace;
      applyTexture(tex);
      state.imageSource = `dropped: ${file.name}`;
      panel.querySelector('#refSrc').textContent = `source: ${state.imageSource}`;
    });
  });

  fitPlane();

  return {
    group,
    state,
    setEnabled(on) {
      state.enabled = on;
      group.visible = on;
      panel.style.display = on ? 'flex' : 'none';
    },
    setOpacity(v) {
      state.opacity = v;
      planeMat.opacity = v;
      panel.querySelector('#refOp').value = String(v);
    },
  };
}
