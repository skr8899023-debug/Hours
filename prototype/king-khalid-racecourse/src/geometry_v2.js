// KKRC V2 surface geometry. All shapes derive from kkrc_reference_definition.

import * as THREE from 'three';
import {
  TRACK, CHUTE, SERVICE_ACCESS_ROADS,
  sampleLoop, offsetPointAt, pointAt,
} from './kkrc_reference_definition.js';

const LOOP_SEGMENTS = 640;

// Closed flat band between lateral offsets oA and oB. UV: u along the loop,
// v across the band (0 at oA, 1 at oB) so band textures span the width once.
export function buildBand(oA, oB, y, material, uRepeat = 26, segments = LOOP_SEGMENTS) {
  const a = sampleLoop(oA, segments);
  const b = sampleLoop(oB, segments);
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i <= segments; i++) {
    const j = i % segments;
    positions.push(a[j].x, y, a[j].z, b[j].x, y, b[j].z);
    const u = (i / segments) * uRepeat;
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

export function buildInfieldFill(y, material) {
  const pts = sampleLoop(TRACK.innerVergeOffset, 320);
  const shape = new THREE.Shape();
  shape.moveTo(pts[0].x, -pts[0].z);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, -pts[i].z);
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  // planar UVs so the infield texture tiles in world space
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i) / 800 + 0.5;
    uv[i * 2 + 1] = pos.getZ(i) / 800 + 0.5;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.y = y;
  mesh.receiveShadow = true;
  return mesh;
}

// Flat constant-width ribbon along XZ waypoints (paths, access roads).
export function buildRibbon(points, width, y, material, closed = false) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(p[0], 0, p[1])),
    closed, 'catmullrom', 0.5
  );
  const n = Math.max(24, points.length * 10);
  const positions = [];
  const indices = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = curve.getPoint(t);
    const tan = curve.getTangent(t);
    const nx = tan.z, nz = -tan.x, h = width / 2;
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

// Organic planting-bed outline around a fixed anchor. Structure (anchor +
// radius) is manual; only the outline jitter uses the caller's seeded rng.
export function buildBlob(cx, cz, radius, y, material, rng) {
  const n = 9;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = radius * (0.6 + rng() * 0.65);
    pts.push(new THREE.Vector2(cx + Math.cos(a) * r, -(cz + Math.sin(a) * r * 0.8)));
  }
  const shape = new THREE.Shape();
  shape.moveTo(pts[0].x, pts[0].y);
  shape.splineThru(pts.slice(1));
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape, 10);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, y, 0);
  return geo; // geometry only — beds get merged into few draw calls in props
}

// Flat filled polygon on the ground (infield arena wedge, aprons).
export function buildPolygon(points, y, material) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], -points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], -points[i][1]);
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i) / 200;
    uv[i * 2 + 1] = pos.getZ(i) / 200;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.y = y;
  mesh.receiveShadow = true;
  return mesh;
}

// Straight chute extension: starts tangent to the training track and runs
// straight while the oval curves away (SE diagonal band in the reference).
export function buildChute(y, material) {
  const start = offsetPointAt(CHUTE.s, CHUTE.offset);
  const dir = { x: start.dirX, z: start.dirZ };
  const nx = dir.z, nz = -dir.x;
  const h = CHUTE.width / 2;
  const positions = [];
  const indices = [];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * CHUTE.length;
    const px = start.x + dir.x * t, pz = start.z + dir.z * t;
    positions.push(px + nx * h, y, pz + nz * h, px - nx * h, y, pz - nz * h);
  }
  for (let i = 0; i < steps; i++) {
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

export function buildFinishLine(material) {
  const s = TRACK.finishLineS;
  const inner = offsetPointAt(s, TRACK.mainTrack.innerEdgeOffset);
  const outer = offsetPointAt(s, TRACK.mainTrack.outerEdgeOffset);
  const dx = outer.x - inner.x, dz = outer.z - inner.z;
  const len = Math.hypot(dx, dz);
  const geo = new THREE.PlaneGeometry(1.2, len);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set((inner.x + outer.x) / 2, 0.34, (inner.z + outer.z) / 2);
  mesh.rotation.y = Math.atan2(dx, dz) + Math.PI / 2;
  return mesh;
}

export function buildSurfaces(mats) {
  const g = new THREE.Group();
  g.name = 'v2_surfaces';

  const M = TRACK.mainTrack;
  const T = TRACK.trainingTrack;
  const R = TRACK.serviceRoad;
  const SP = TRACK.innerServicePath;

  const desert = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000, 1, 1), mats.desert);
  desert.rotation.x = -Math.PI / 2;
  desert.receiveShadow = true;
  g.add(desert);

  g.add(buildBand(M.innerEdgeOffset, M.outerEdgeOffset, 0.30, mats.dirtMain));          // main dirt
  g.add(buildBand(SP.innerEdgeOffset, SP.outerEdgeOffset, 0.24, mats.servicePath));     // thin inner path
  g.add(buildBand(SP.outerEdgeOffset, M.innerEdgeOffset, 0.18, mats.verge));            // inner lip
  g.add(buildBand(TRACK.innerVergeOffset, SP.innerEdgeOffset, 0.14, mats.verge));       // infield lip
  g.add(buildBand(M.outerEdgeOffset, T.innerEdgeOffset, 0.16, mats.verge));             // gap verge
  g.add(buildBand(T.innerEdgeOffset, T.outerEdgeOffset, 0.20, mats.sandTraining));      // training sand
  g.add(buildBand(T.outerEdgeOffset, R.innerEdgeOffset, 0.12, mats.verge));             // shoulder
  g.add(buildBand(R.innerEdgeOffset, R.outerEdgeOffset, 0.15, mats.asphalt));           // perimeter road
  g.add(buildBand(R.outerEdgeOffset, TRACK.outerShoulderOffset, 0.08, mats.infieldSand)); // outer shoulder
  g.add(buildInfieldFill(0.06, mats.infieldSand));

  g.add(buildChute(0.19, mats.sandTraining));
  g.add(buildFinishLine(mats.finishLine));

  // access roads from the perimeter ring outward
  for (const road of SERVICE_ACCESS_ROADS) {
    const a = offsetPointAt(road.sFrom, R.innerEdgeOffset);
    const out = offsetPointAt(road.sFrom, R.outerEdgeOffset - road.length);
    g.add(buildRibbon([[a.x, a.z], [out.x, out.z]], road.width, 0.13, mats.asphaltFlat));
  }

  return g;
}
