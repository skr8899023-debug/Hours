// REFERENCE ALIGNMENT MODE + DIFFERENCE REVIEW (V2.1)
// Top-orthographic view with the aerial reference photo as a ground overlay.
//
//  - loads reference/kkrc_aerial_reference.(jpg|png) or accepts drag & drop
//  - shows the loaded file name and native resolution in the panel
//  - opacity / scale / rotation / offset controls, exportable to JSON
//  - digitized landmark markers + 50 m grid
//  - track boundary debug lines (centerline, inner/outer, service road,
//    training track) and the 28 spline control points
//  - Difference Review presets: reference-only, model-only, overlay 25/50/75,
//    flicker A/B, edge comparison (boundary lines over the photo)
//
// HONESTY GUARD: while no real photo is loaded, the overlay falls back to a
// schematic drawn from the digitized landmark coordinates, state.isPhoto stays
// false, and a red "SCHEMATIC" banner is shown — approval captures must check
// state.isPhoto and refuse to run against the schematic.

import * as THREE from 'three';
import { sampleLoop, CONTROL_POINTS, TRACK } from './kkrc_reference_definition.js';

const IMG_CANDIDATES = [
  '../reference/kkrc_aerial_reference.jpg',
  '../reference/kkrc_aerial_reference.png',
  './reference/kkrc_aerial_reference.jpg',
  './reference/kkrc_aerial_reference.png',
];

// Ground-footprint mapping for the committed photo (landscape OBLIQUE aerial,
// 800x533: city/north at the top, facilities/west at the left). Flat-projected
// onto the ground plane this can only be a best-fit around the oval — the
// perspective foreshortening of an oblique shot cannot be removed by an
// affine overlay, and the report must say so.
//   image-top -> -Z (north), image-left -> -X (west)  => base rotation 0
const PHOTO_MAPPING = {
  baseRotationDeg: 0,
  // Calibrated in edge-comparison mode against the model boundary lines:
  // the oblique view compresses the vertical image axis severely, so the
  // 800x533 frame covers a nearly square ground footprint around the oval.
  metersWidth: 1290,
  metersHeight: 1275,
};
// The schematic fallback still uses the original portrait digitization
// (image-top -> -X, image-left -> +Z => base rotation +90).

export async function createReferenceOverlay(scene) {
  const state = {
    enabled: false,
    opacity: 0.5,
    scale: 1.0,        // multiplier over meters_per_image_height
    rotationDeg: 0,
    offsetX: 0,
    offsetZ: 0,
    isPhoto: false,
    imageName: 'schematic (no photo loaded)',
    imageWidth: 0,
    imageHeight: 0,
    diffMode: 'off',
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

  // ------------------------------------------------------------------ plane
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
    const wm = state.isPhoto ? PHOTO_MAPPING.metersWidth : W;
    const hm = state.isPhoto ? PHOTO_MAPPING.metersHeight : H;
    const base = state.isPhoto ? PHOTO_MAPPING.baseRotationDeg : 90;
    plane.scale.set(wm * state.scale, hm * state.scale, 1);
    plane.rotation.z = ((base + state.rotationDeg) * Math.PI) / 180;
    plane.position.set(state.offsetX, 1.5, state.offsetZ);
  }

  function schematicTexture() {
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
      ctx.fillStyle = 'rgba(255,80,80,0.9)';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('SCHEMATIC — NOT A PHOTO', 20, ch - 24);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function applyTexture(tex, { isPhoto, name }) {
    tex.flipY = true;
    planeMat.map = tex;
    planeMat.needsUpdate = true;
    state.isPhoto = isPhoto;
    state.imageName = name;
    const img = tex.image;
    state.imageWidth = img?.naturalWidth ?? img?.width ?? 0;
    state.imageHeight = img?.naturalHeight ?? img?.height ?? 0;
    fitPlane();
    updateSourceLabel();
  }

  async function tryLoadPhoto() {
    const loader = new THREE.TextureLoader();
    for (const url of IMG_CANDIDATES) {
      try {
        const tex = await loader.loadAsync(url);
        tex.colorSpace = THREE.SRGBColorSpace;
        applyTexture(tex, { isPhoto: true, name: url.split('/').pop() });
        return true;
      } catch { /* keep trying */ }
    }
    return false;
  }

  // ------------------------------------------------- landmark rings + grid
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

  const grid = new THREE.GridHelper(2000, 40, 0x224466, 0x224466);
  grid.material.transparent = true;
  grid.material.opacity = 0.35;
  grid.position.y = 1.0;
  grid.visible = false;
  group.add(grid);

  // --------------------------- track boundary debug lines + control points
  const lines = new THREE.Group();
  lines.name = 'boundary_debug_lines';
  lines.visible = false;
  function loopLine(o, color, y = 2.6) {
    const pts = sampleLoop(o, 512).map((p) => new THREE.Vector3(p.x, y, p.z));
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.95 });
    const line = new THREE.LineLoop(geo, mat);
    line.renderOrder = 950;
    return line;
  }
  lines.add(loopLine(0, 0xffe14d));                                    // centerline — yellow
  lines.add(loopLine(TRACK.mainTrack.innerEdgeOffset, 0x39d0ff));      // main inner — cyan
  lines.add(loopLine(TRACK.mainTrack.outerEdgeOffset, 0xff4fd8));      // main outer — magenta
  lines.add(loopLine(TRACK.trainingTrack.innerEdgeOffset, 0x9dff4f));  // training — green
  lines.add(loopLine(TRACK.trainingTrack.outerEdgeOffset, 0x9dff4f));
  lines.add(loopLine(TRACK.serviceRoad.innerEdgeOffset, 0xffffff));    // service road — white
  lines.add(loopLine(TRACK.serviceRoad.outerEdgeOffset, 0xffffff));
  {
    const cpGeo = new THREE.OctahedronGeometry(4);
    const cpMat = new THREE.MeshBasicMaterial({ color: 0xff9a2e, depthTest: false });
    const cps = new THREE.InstancedMesh(cpGeo, cpMat, CONTROL_POINTS.length);
    const m = new THREE.Matrix4();
    CONTROL_POINTS.forEach(([x, z], i) => {
      m.makeTranslation(x, 3, z);
      cps.setMatrixAt(i, m);
    });
    cps.renderOrder = 951;
    lines.add(cps);
  }
  group.add(lines);

  // -------------------------------------------------------- HTML panel
  const panel = document.createElement('div');
  panel.id = 'refPanel';
  panel.innerHTML = `
    <strong>REFERENCE ALIGNMENT MODE</strong>
    <small id="refSrc"></small>
    <div id="refWarn">SCHEMATIC FALLBACK — approval captures blocked until
      reference/kkrc_aerial_reference.jpg is provided (or drop the photo here)</div>
    <label>Opacity <input type="range" id="refOp" min="0" max="1" step="0.05" value="0.5"></label>
    <label>Scale <input type="range" id="refSc" min="0.5" max="1.5" step="0.005" value="1"></label>
    <label>Rotate&deg; <input type="range" id="refRot" min="-15" max="15" step="0.25" value="0"></label>
    <label>Offset X <input type="range" id="refOX" min="-150" max="150" step="1" value="0"></label>
    <label>Offset Z <input type="range" id="refOZ" min="-150" max="150" step="1" value="0"></label>
    <div class="refBtns">
      <button id="refImgToggle">image</button>
      <button id="refGrid">grid</button>
      <button id="refMarks">landmarks</button>
      <button id="refLines">boundaries</button>
      <button id="refExport">export JSON</button>
    </div>
    <strong style="margin-top:4px">DIFFERENCE REVIEW</strong>
    <div class="refBtns" id="diffBtns">
      <button data-diff="reference">ref only</button>
      <button data-diff="model">model only</button>
      <button data-diff="overlay25">25%</button>
      <button data-diff="overlay50">50%</button>
      <button data-diff="overlay75">75%</button>
      <button data-diff="flicker">flicker</button>
      <button data-diff="edge">edges</button>
      <button data-diff="off">off</button>
    </div>`;
  panel.style.display = 'none';
  document.body.appendChild(panel);

  function updateSourceLabel() {
    const el = panel.querySelector('#refSrc');
    el.textContent = state.isPhoto
      ? `photo: ${state.imageName} — ${state.imageWidth}×${state.imageHeight}px`
      : `source: ${state.imageName}`;
    panel.querySelector('#refWarn').style.display = state.isPhoto ? 'none' : 'block';
  }

  const bind = (id, fn) => panel.querySelector(id).addEventListener('input', fn);
  bind('#refOp', (e) => { state.opacity = +e.target.value; planeMat.opacity = state.opacity; });
  bind('#refSc', (e) => { state.scale = +e.target.value; fitPlane(); });
  bind('#refRot', (e) => { state.rotationDeg = +e.target.value; fitPlane(); });
  bind('#refOX', (e) => { state.offsetX = +e.target.value; fitPlane(); });
  bind('#refOZ', (e) => { state.offsetZ = +e.target.value; fitPlane(); });
  panel.querySelector('#refImgToggle').addEventListener('click', () => { plane.visible = !plane.visible; });
  panel.querySelector('#refGrid').addEventListener('click', () => { grid.visible = !grid.visible; });
  panel.querySelector('#refMarks').addEventListener('click', () => { markers.visible = !markers.visible; });
  panel.querySelector('#refLines').addEventListener('click', () => { lines.visible = !lines.visible; });
  panel.querySelector('#refExport').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(exportAlignment(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'reference_alignment.json';
    a.click();
  });
  panel.querySelectorAll('#diffBtns button').forEach((b) =>
    b.addEventListener('click', () => setDiffMode(b.dataset.diff)));

  function exportAlignment(camera) {
    const out = {
      format: 'kkrc-reference-alignment',
      version: 2,
      photo_verified: state.isPhoto,
      image_filename: state.imageName,
      image_dimensions_px: [state.imageWidth, state.imageHeight],
      opacity: state.opacity,
      meters_per_image_height: (state.isPhoto ? PHOTO_MAPPING.metersHeight : H) * state.scale,
      meters_per_image_width: (state.isPhoto ? PHOTO_MAPPING.metersWidth : W) * state.scale,
      scale_multiplier: state.scale,
      base_rotation_deg: state.isPhoto ? PHOTO_MAPPING.baseRotationDeg : 90,
      rotation_deg: state.rotationDeg,
      offset_meters: [state.offsetX, state.offsetZ],
      orientation: state.isPhoto
        ? 'oblique photo, flat best-fit: image-top = -Z (north), image-left = -X (west)'
        : 'schematic: image-top = -X, image-left = +Z',
      projection_note: state.isPhoto
        ? 'oblique aerial flat-projected onto the ground plane — footprint best-fit only, perspective foreshortening not removed'
        : undefined,
    };
    if (camera) {
      out.camera_position = camera.position.toArray();
      if (camera.isOrthographicCamera) {
        out.orthographic_bounds = {
          left: camera.left, right: camera.right, top: camera.top, bottom: camera.bottom,
        };
      }
    }
    return out;
  }

  // ----------------------------------------------------- difference review
  // scene meshes we hide for "reference only" / "edge" modes
  function setModelVisible(on) {
    for (const child of scene.children) {
      if (child === group || child.isLight || child === scene.getObjectByName('sky_dome')) continue;
      if (child.name === 'sky_dome') continue;
      child.visible = on;
    }
  }

  let flickerTimer = null;
  function stopFlicker() {
    if (flickerTimer) { clearInterval(flickerTimer); flickerTimer = null; }
  }

  function setDiffMode(mode) {
    stopFlicker();
    state.diffMode = mode;
    setModelVisible(true);
    plane.visible = true;
    lines.visible = false;
    switch (mode) {
      case 'reference':
        planeMat.opacity = 1;
        setModelVisible(false);
        break;
      case 'model':
        plane.visible = false;
        break;
      case 'overlay25': planeMat.opacity = 0.25; break;
      case 'overlay50': planeMat.opacity = 0.50; break;
      case 'overlay75': planeMat.opacity = 0.75; break;
      case 'flicker':
        planeMat.opacity = 0.9;
        flickerTimer = setInterval(() => { plane.visible = !plane.visible; }, 500);
        break;
      case 'flicker-a': planeMat.opacity = 0.9; plane.visible = true; break;   // deterministic captures
      case 'flicker-b': plane.visible = false; break;
      case 'edge':
        planeMat.opacity = 1;
        setModelVisible(false);
        lines.visible = true;
        break;
      default:
        planeMat.opacity = state.opacity;
        break;
    }
    panel.querySelectorAll('#diffBtns button').forEach((b) =>
      b.classList.toggle('active', b.dataset.diff === mode));
  }

  // drag & drop the real aerial photo
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const tex = new THREE.TextureLoader().load(URL.createObjectURL(file), () => {
      tex.colorSpace = THREE.SRGBColorSpace;
      applyTexture(tex, { isPhoto: true, name: `dropped: ${file.name}` });
    });
  });

  const gotPhoto = await tryLoadPhoto();
  if (!gotPhoto) applyTexture(schematicTexture(), { isPhoto: false, name: 'schematic (no photo loaded)' });

  // restore saved calibration so every session (and the capture tool) starts
  // from the committed alignment
  try {
    const saved = await (await fetch('../reference/reference_alignment.json')).json();
    if (saved && typeof saved.scale_multiplier === 'number') {
      state.scale = saved.scale_multiplier;
      state.rotationDeg = saved.rotation_deg ?? 0;
      state.offsetX = saved.offset_meters?.[0] ?? 0;
      state.offsetZ = saved.offset_meters?.[1] ?? 0;
      state.opacity = saved.opacity ?? state.opacity;
      planeMat.opacity = state.opacity;
      const setV = (id, v) => { const el = panel.querySelector(id); if (el) el.value = String(v); };
      setV('#refSc', state.scale);
      setV('#refRot', state.rotationDeg);
      setV('#refOX', state.offsetX);
      setV('#refOZ', state.offsetZ);
      setV('#refOp', state.opacity);
    }
  } catch { /* no saved alignment yet */ }

  fitPlane();
  updateSourceLabel();

  return {
    group,
    state,
    exportAlignment,
    setDiffMode,
    setEnabled(on) {
      state.enabled = on;
      group.visible = on;
      panel.style.display = on ? 'flex' : 'none';
      if (!on) { setDiffMode('off'); setModelVisible(true); }
    },
    setOpacity(v) {
      state.opacity = v;
      planeMat.opacity = v;
      panel.querySelector('#refOp').value = String(v);
    },
    setBoundaries(on) { lines.visible = on; },
  };
}
