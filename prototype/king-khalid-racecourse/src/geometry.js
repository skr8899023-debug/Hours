// Track geometry builders for the KKRC scene prototype.
// Everything here derives from src/track_definition.js so that the rendered
// scene and the exported metadata can never disagree.

import * as THREE from 'three';
import { TRACK, perimeter, sampleLoop, offsetPointAt } from './track_definition.js';

const LOOP_SEGMENTS = 512;

// Flat closed band between lateral offsets oA and oB (inward-positive), at
// height y. UVs run along the loop so tiled textures follow the track.
export function buildBand(oA, oB, y, material, segments = LOOP_SEGMENTS) {
  const a = sampleLoop(oA, segments);
  const b = sampleLoop(oB, segments);
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i <= segments; i++) {
    const j = i % segments;
    positions.push(a[j].x, y, a[j].z, b[j].x, y, b[j].z);
    const u = (i / segments) * 60;
    uvs.push(u, 0, u, 1);
  }
  for (let i = 0; i < segments; i++) {
    const k = i * 2;
    indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  return mesh;
}

// Vertical white-rail wall following the loop at offset o.
export function buildRailWall(o, yBottom, yTop, material, segments = LOOP_SEGMENTS) {
  const pts = sampleLoop(o, segments);
  const positions = [];
  const indices = [];
  for (let i = 0; i <= segments; i++) {
    const p = pts[i % segments];
    positions.push(p.x, yBottom, p.z, p.x, yTop, p.z);
  }
  for (let i = 0; i < segments; i++) {
    const k = i * 2;
    indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}

// Filled infield polygon (everything inside the inner verge).
export function buildInfieldFill(y, material) {
  const pts = sampleLoop(TRACK.innerVergeOffset, 256);
  const shape = new THREE.Shape();
  shape.moveTo(pts[0].x, -pts[0].z);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, -pts[i].z);
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.y = y;
  mesh.receiveShadow = true;
  return mesh;
}

// Flat ribbon of constant width following an arbitrary list of XZ points.
// Used for the infield walking paths.
export function buildRibbon(points, width, y, material, closed = false) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(p[0], 0, p[1])),
    closed,
    'catmullrom',
    0.5
  );
  const n = Math.max(24, points.length * 12);
  const positions = [];
  const indices = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = curve.getPoint(t);
    const tan = curve.getTangent(t);
    const nx = tan.z;
    const nz = -tan.x;
    const h = width / 2;
    positions.push(p.x + nx * h, y, p.z + nz * h, p.x - nx * h, y, p.z - nz * h);
  }
  for (let i = 0; i < n; i++) {
    const k = i * 2;
    indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  return mesh;
}

// Organic landscaped blob (irregular closed spline), for infield planting beds.
export function buildBlob(cx, cz, radius, y, material, rng) {
  const n = 9;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = radius * (0.55 + rng() * 0.75);
    pts.push(new THREE.Vector2(cx + Math.cos(a) * r, -(cz + Math.sin(a) * r * 0.8)));
  }
  const shape = new THREE.Shape();
  shape.moveTo(pts[0].x, pts[0].y);
  shape.splineThru(pts.slice(1));
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape, 12);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.y = y;
  mesh.receiveShadow = true;
  return mesh;
}

// White finish-line strip painted across the main track.
export function buildFinishLine(material) {
  const s = TRACK.finishLineS;
  const inner = offsetPointAt(s, TRACK.mainTrack.innerEdgeOffset);
  const outer = offsetPointAt(s, TRACK.mainTrack.outerEdgeOffset);
  const dx = outer.x - inner.x;
  const dz = outer.z - inner.z;
  const len = Math.hypot(dx, dz);
  const geo = new THREE.PlaneGeometry(1.2, len);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set((inner.x + outer.x) / 2, 0.16, (inner.z + outer.z) / 2);
  mesh.rotation.y = Math.atan2(dx, dz) + Math.PI / 2;
  return mesh;
}

export function buildTrackGroup(mats) {
  const g = new THREE.Group();
  g.name = 'track_geometry';

  const M = TRACK.mainTrack;
  const T = TRACK.trainingTrack;

  // desert base far beyond the venue
  const desert = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), mats.desert);
  desert.rotation.x = -Math.PI / 2;
  desert.receiveShadow = true;
  desert.name = 'desert_base';
  g.add(desert);

  // surfaces, layered slightly to avoid z-fighting
  g.add(buildBand(M.innerEdgeOffset, M.outerEdgeOffset, 0.30, mats.dirtMain));       // main dirt track
  g.add(buildBand(T.innerEdgeOffset, T.outerEdgeOffset, 0.18, mats.sandTraining));   // outer training track
  g.add(buildBand(M.outerEdgeOffset, T.innerEdgeOffset, 0.12, mats.verge));          // gap verge
  g.add(buildBand(TRACK.innerVergeOffset, M.innerEdgeOffset, 0.12, mats.verge));     // inner verge
  g.add(buildBand(T.outerEdgeOffset, TRACK.outerApronOffset, 0.10, mats.infieldSand)); // outer apron
  g.add(buildInfieldFill(0.08, mats.infieldSand));                                   // infield base

  // rails: inner + outer of the main track, and the perimeter fence
  const rh = TRACK.railHeight;
  g.add(buildRailWall(M.innerEdgeOffset + 0.4, rh - 0.25, rh, mats.railWhite));
  g.add(buildRailWall(M.outerEdgeOffset - 0.4, rh - 0.25, rh, mats.railWhite));
  g.add(buildRailWall(TRACK.perimeterFenceOffset, 0.0, 1.6, mats.railWhite));

  g.add(buildFinishLine(mats.finishLine));

  return g;
}
