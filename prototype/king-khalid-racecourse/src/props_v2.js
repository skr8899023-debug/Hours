// KKRC V2 props: racing rails, zoned palms, buildings per reference zones,
// infield garden from the definition (no global random scatter), floodlights,
// and the far surroundings (soft ridgelines + irregular low-rise city).

import * as THREE from 'three';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';
import {
  TRACK, BUILDING_ZONES, VEGETATION_ZONES, INFIELD,
  perimeter, offsetPointAt, placementAt, sampleLoop,
} from './kkrc_reference_definition.js';
import { buildRibbon, buildBlob } from './geometry_v2.js';

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Racing rails: slim posts + two horizontal rails — NOT a solid wall.
// ---------------------------------------------------------------------------

// One thin horizontal rail strip following the loop at offset o.
function railStrip(o, yCenter, thickness, material, segments = 640) {
  const pts = sampleLoop(o, segments);
  const positions = [];
  const indices = [];
  const y0 = yCenter - thickness / 2, y1 = yCenter + thickness / 2;
  for (let i = 0; i <= segments; i++) {
    const p = pts[i % segments];
    positions.push(p.x, y0, p.z, p.x, y1, p.z);
  }
  for (let i = 0; i < segments; i++) {
    const k = i * 2;
    indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

export function buildRails(mats) {
  const g = new THREE.Group();
  g.name = 'v2_rails';
  const P = perimeter();
  const h = TRACK.railHeight;
  const railOffsets = [TRACK.mainTrack.innerEdgeOffset + 0.5, TRACK.mainTrack.outerEdgeOffset - 0.5];

  // two thin horizontal rails per line
  for (const o of railOffsets) {
    g.add(railStrip(o, h - 0.05, 0.09, mats.railWhite));
    g.add(railStrip(o, h - 0.42, 0.07, mats.railWhite));
  }

  // slim posts every 5 m
  const spacing = 5;
  const perRail = Math.ceil(P / spacing);
  const postGeo = new THREE.BoxGeometry(0.07, h, 0.07);
  postGeo.translate(0, h / 2, 0);
  const posts = new THREE.InstancedMesh(postGeo, mats.railWhite, perRail * railOffsets.length);
  const m = new THREE.Matrix4();
  let i = 0;
  for (const o of railOffsets) {
    for (let s = 0; s < P; s += spacing) {
      const p = offsetPointAt(s, o);
      m.makeTranslation(p.x, 0, p.z);
      posts.setMatrixAt(i++, m);
    }
  }
  posts.count = i;
  posts.castShadow = true;
  g.add(posts);

  // light grey perimeter fence outside the service road: posts + single rail
  const fo = TRACK.perimeterFenceOffset;
  g.add(railStrip(fo, 1.45, 0.06, mats.fenceGrey, 512));
  const fpGeo = new THREE.BoxGeometry(0.08, 1.5, 0.08);
  fpGeo.translate(0, 0.75, 0);
  const fposts = new THREE.InstancedMesh(fpGeo, mats.fenceGrey, Math.ceil(P / 10));
  let j = 0;
  for (let s = 0; s < P; s += 10) {
    const p = offsetPointAt(s, fo);
    m.makeTranslation(p.x, 0, p.z);
    fposts.setMatrixAt(j++, m);
  }
  fposts.count = j;
  g.add(fposts);

  return g;
}

// ---------------------------------------------------------------------------
// Palms V2: slimmer trunk with a slight lean, softer 10-frond crown with
// per-instance color variation. Placement strictly from VEGETATION_ZONES.
// ---------------------------------------------------------------------------

function palmCrownGeometry() {
  const positions = [];
  const indices = [];
  const F = 10;
  for (let k = 0; k < F; k++) {
    const a = (k / F) * Math.PI * 2 + (k % 2) * 0.13;
    const dx = Math.cos(a), dz = Math.sin(a);
    const sx = -dz, sz = dx;
    // three-quad frond: rises from the crown, arcs over, droops at the tip
    const nodes = [
      [0, 0, 0, 0.34],
      [dx * 1.5, 0.55, dz * 1.5, 0.30],
      [dx * 3.1, 0.25, dz * 3.1, 0.20],
      [dx * 4.3, -0.85, dz * 4.3, 0.05],
    ];
    let prev = null;
    for (const [x, y, z, w] of nodes) {
      const i0 = positions.length / 3;
      positions.push(x + sx * w, y, z + sz * w, x - sx * w, y, z - sz * w);
      if (prev !== null) indices.push(prev, prev + 1, i0, prev + 1, i0 + 1, i0);
      prev = i0;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function buildPalms(mats) {
  const g = new THREE.Group();
  g.name = 'v2_palms';
  const rng = mulberry32(1042);
  const placements = [];

  for (const zone of VEGETATION_ZONES) {
    if (zone.type === 'row') {
      for (let s = zone.sFrom; s <= zone.sTo; s += zone.spacing) {
        const p = offsetPointAt(s + (rng() - 0.5) * 3, zone.offset + (rng() - 0.5) * 3);
        placements.push({ x: p.x, z: p.z });
      }
    } else if (zone.type === 'cluster') {
      const c = offsetPointAt(zone.s, zone.offset);
      for (let k = 0; k < zone.count; k++) {
        const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * zone.radius;
        placements.push({ x: c.x + Math.cos(a) * r, z: c.z + Math.sin(a) * r });
      }
    } else if (zone.type === 'infield') {
      for (const [ax, az] of zone.anchors) {
        for (let k = 0; k < zone.perAnchor; k++) {
          const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * zone.radius;
          placements.push({ x: ax + Math.cos(a) * r, z: az + Math.sin(a) * r });
        }
      }
    }
  }

  const trunkGeo = new THREE.CylinderGeometry(0.13, 0.26, 1, 7);
  trunkGeo.translate(0, 0.5, 0);
  const crownGeo = palmCrownGeometry();
  const trunks = new THREE.InstancedMesh(trunkGeo, mats.palmTrunk, placements.length);
  const crowns = new THREE.InstancedMesh(crownGeo, mats.palmFrond, placements.length);
  trunks.castShadow = crowns.castShadow = true;

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const c = new THREE.Color();
  placements.forEach((p, i) => {
    const h = 5.5 + rng() * 4.5;
    const yaw = rng() * Math.PI * 2;
    const lean = (rng() - 0.5) * 0.12;
    e.set(lean, yaw, (rng() - 0.5) * 0.1);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(p.x, 0, p.z), q, new THREE.Vector3(1, h, 1));
    trunks.setMatrixAt(i, m);
    const cs = 0.75 + rng() * 0.45;
    // crown sits at the trunk tip (account for the lean)
    const tip = new THREE.Vector3(0, h, 0).applyQuaternion(q);
    m.compose(new THREE.Vector3(p.x + tip.x, tip.y, p.z + tip.z), q, new THREE.Vector3(cs, cs, cs));
    crowns.setMatrixAt(i, m);
    // subtle olive-tone variation per palm (near-white multipliers over the
    // base material color)
    c.setHSL(0.2 + rng() * 0.05, 0.15 + rng() * 0.1, 0.8 + rng() * 0.17);
    crowns.setColorAt(i, c);
    c.setHSL(0.08, 0.1, 0.85 + rng() * 0.15);
    trunks.setColorAt(i, c);
  });
  g.add(trunks, crowns);
  return g;
}

// ---------------------------------------------------------------------------
// Floodlight towers around the perimeter road (visible in the references)
// ---------------------------------------------------------------------------

export function buildFloodlights(mats) {
  const g = new THREE.Group();
  g.name = 'v2_floodlights';
  const P = perimeter();
  const n = 12;
  const poleGeo = new THREE.CylinderGeometry(0.35, 0.6, 28, 8);
  poleGeo.translate(0, 14, 0);
  const headGeo = new THREE.BoxGeometry(4.4, 2.0, 0.7);
  const poles = new THREE.InstancedMesh(poleGeo, mats.steel, n);
  const heads = new THREE.InstancedMesh(headGeo, mats.lightHead, n);
  poles.castShadow = true;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < n; i++) {
    const s = (i / n) * P + 60;
    const pl = placementAt(s, -37);
    m.makeTranslation(pl.x, 0, pl.z);
    poles.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(pl.x, 27, pl.z), q.setFromAxisAngle(up, pl.yaw), new THREE.Vector3(1, 1, 1));
    heads.setMatrixAt(i, m);
  }
  g.add(poles, heads);
  return g;
}

// ---------------------------------------------------------------------------
// Buildings — every block from BUILDING_ZONES, oriented to the track edge.
// ---------------------------------------------------------------------------

function orientedGroup(zone) {
  const p = offsetPointAt(zone.s, zone.offset);
  const grp = new THREE.Group();
  grp.position.set(p.x, 0, p.z);
  // local +X runs along the track direction, local -Z faces the track
  grp.rotation.y = Math.atan2(-p.dirZ, p.dirX);
  return grp;
}

export function buildBuildings(mats) {
  const g = new THREE.Group();
  g.name = 'v2_buildings';

  // --- main grandstand ---
  const GS = BUILDING_ZONES.grandstand;
  const stand = orientedGroup(GS);
  const L = GS.length;

  // local -Z faces the track: lowest tier at the front (-Z), block at the rear
  const podium = new THREE.Mesh(new THREE.BoxGeometry(L + 14, 2.2, GS.depth), mats.buildingBeige);
  podium.position.set(0, 1.1, 2);
  podium.castShadow = podium.receiveShadow = true;
  stand.add(podium);

  for (let i = 0; i < 9; i++) {
    const tier = new THREE.Mesh(new THREE.BoxGeometry(L, 1.5, 2.6), mats.buildingWhite);
    tier.position.set(0, 2.2 + i * 1.5, -13 + i * 2.4);
    tier.castShadow = tier.receiveShadow = true;
    stand.add(tier);
  }

  const block = new THREE.Mesh(new THREE.BoxGeometry(L, 11, 9), mats.buildingBeige);
  block.position.set(0, 7.5, 13);
  block.castShadow = true;
  stand.add(block);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(L * 0.7, 2.6, 9.15), mats.glass);
  glass.position.set(0, 10, 13);
  stand.add(glass);

  // slim canopy: thin slab, slight tilt down toward the rear, slender columns
  const roof = new THREE.Mesh(new THREE.BoxGeometry(L + 10, 0.35, 26), mats.canopyWhite);
  roof.position.set(0, 17.5, 1);
  roof.rotation.x = -0.12;
  roof.castShadow = true;
  stand.add(roof);
  const colGeo = new THREE.CylinderGeometry(0.28, 0.28, 16, 6);
  const cols = new THREE.InstancedMesh(colGeo, mats.steel, 8);
  const cm = new THREE.Matrix4();
  for (let i = 0; i < 8; i++) {
    cm.makeTranslation(-L / 2 + 8 + i * ((L - 16) / 7), 9, 10);
    cols.setMatrixAt(i, cm);
  }
  cols.castShadow = true;
  stand.add(cols);
  g.add(stand);

  // --- stewards tower ---
  const tower = orientedGroup(BUILDING_ZONES.stewardsTower);
  const tBase = new THREE.Mesh(new THREE.BoxGeometry(6.5, 15, 6.5), mats.buildingWhite);
  tBase.position.y = 7.5;
  tBase.castShadow = true;
  tower.add(tBase);
  const tGlass = new THREE.Mesh(new THREE.BoxGeometry(6.7, 2.8, 6.7), mats.glass);
  tGlass.position.y = 13;
  tower.add(tGlass);
  const tRoof = new THREE.Mesh(new THREE.BoxGeometry(8, 0.5, 8), mats.roofDark);
  tRoof.position.y = 15.3;
  tower.add(tRoof);
  g.add(tower);

  // --- paddock oval (green parade ring outside the SW corner) ---
  const PD = BUILDING_ZONES.paddock;
  const pd = orientedGroup(PD);
  const ring = new THREE.Mesh(new THREE.CircleGeometry(1, 44), mats.paddockGreen);
  ring.rotation.x = -Math.PI / 2;
  ring.scale.set(PD.rx, PD.rz, 1);
  ring.position.y = 0.12;
  pd.add(ring);
  const ringPath = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 44), mats.path);
  ringPath.rotation.x = -Math.PI / 2;
  ringPath.scale.set(PD.rx, PD.rz, 1);
  ringPath.position.y = 0.14;
  pd.add(ringPath);
  g.add(pd);

  // --- white shade canopies (pyramid tents) ---
  const canopyGeo = new THREE.ConeGeometry(8, 4.5, 4);
  const canopies = new THREE.InstancedMesh(canopyGeo, mats.canopyWhite, BUILDING_ZONES.canopies.sList.length);
  const m = new THREE.Matrix4();
  BUILDING_ZONES.canopies.sList.forEach((s, i) => {
    const pl = placementAt(s, BUILDING_ZONES.canopies.offset);
    m.makeRotationY(pl.yaw);
    m.setPosition(pl.x, 6, pl.z);
    canopies.setMatrixAt(i, m);
  });
  canopies.castShadow = true;
  g.add(canopies);

  // --- service buildings ---
  for (const sb of BUILDING_ZONES.serviceBuildings) {
    const grp = orientedGroup(sb);
    const bld = new THREE.Mesh(new THREE.BoxGeometry(sb.w, sb.h, sb.d), mats.buildingBeige);
    bld.position.y = sb.h / 2;
    bld.castShadow = true;
    grp.add(bld);
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(sb.w + 0.6, 0.5, sb.d + 0.6), mats.buildingWhite);
    parapet.position.y = sb.h;
    grp.add(parapet);
    g.add(grp);
  }

  // --- parking aprons ---
  for (const pk of BUILDING_ZONES.parking) {
    const grp = orientedGroup(pk);
    const lot = new THREE.Mesh(new THREE.PlaneGeometry(pk.w, pk.d), mats.asphaltFlat);
    lot.rotation.x = -Math.PI / 2;
    lot.position.y = 0.07;
    grp.add(lot);
    g.add(grp);
  }

  // --- SE entrance gate ---
  const gate = orientedGroup(BUILDING_ZONES.entranceGate);
  const gL = new THREE.Mesh(new THREE.BoxGeometry(1.4, 7, 1.4), mats.buildingWhite);
  gL.position.set(-6, 3.5, 0);
  const gR = gL.clone();
  gR.position.set(6, 3.5, 0);
  const gT = new THREE.Mesh(new THREE.BoxGeometry(15, 1.2, 2), mats.buildingBeige);
  gT.position.y = 7;
  gate.add(gL, gR, gT);
  g.add(gate);

  // --- stable barn rows west of the venue (sunset reference) ---
  const ST = BUILDING_ZONES.stables;
  const barnGeo = new THREE.BoxGeometry(1, 1, 1);
  const barns = new THREE.InstancedMesh(barnGeo, mats.buildingWhite, ST.rows * ST.perRow);
  let bi = 0;
  for (let r = 0; r < ST.rows; r++) {
    for (let k = 0; k < ST.perRow; k++) {
      m.makeScale(ST.w, 4.5, ST.d);
      m.setPosition(ST.x - r * ST.gapX, 2.25, ST.z - (ST.perRow / 2) * ST.gapZ + k * ST.gapZ);
      barns.setMatrixAt(bi++, m);
    }
  }
  barns.castShadow = true;
  g.add(barns);

  return g;
}

// ---------------------------------------------------------------------------
// Infield garden — everything placed from INFIELD definition, no global RNG.
// ---------------------------------------------------------------------------

export function buildInfield(mats) {
  const g = new THREE.Group();
  g.name = 'v2_infield';
  const rng = mulberry32(77); // outline jitter + small details only

  // paths
  for (const path of INFIELD.paths) {
    const mat = path.width >= 4 ? mats.path : mats.pathMinor;
    if (path.ellipse) {
      const { cx, cz, rx, rz, samples } = path.ellipse;
      const pts = [];
      for (let i = 0; i < samples; i++) {
        const a = (i / samples) * Math.PI * 2;
        pts.push([cx + Math.cos(a) * rx, cz + Math.sin(a) * rz]);
      }
      g.add(buildRibbon(pts, path.width, 0.11, mat, true));
    } else {
      g.add(buildRibbon(path.points, path.width, 0.11, mat));
    }
  }

  // planting beds: fixed anchors, merged into two draw calls by tone
  const light = [];
  const dark = [];
  INFIELD.bedAnchors.forEach((b, i) => {
    (i % 3 === 0 ? dark : light).push(buildBlob(b.x, b.z, b.r, 0.1, null, rng));
  });
  if (light.length) {
    const mesh = new THREE.Mesh(mergeGeometries(light), mats.green);
    mesh.receiveShadow = true;
    g.add(mesh);
  }
  if (dark.length) {
    const mesh = new THREE.Mesh(mergeGeometries(dark), mats.greenDark);
    mesh.receiveShadow = true;
    g.add(mesh);
  }

  // shrubs sprinkled on the beds only
  const shrubGeo = new THREE.IcosahedronGeometry(1, 0);
  shrubGeo.scale(1, 0.55, 1);
  const shrubCount = INFIELD.bedAnchors.length * 6;
  const shrubs = new THREE.InstancedMesh(shrubGeo, mats.shrub, shrubCount);
  const m = new THREE.Matrix4();
  let si = 0;
  for (const b of INFIELD.bedAnchors) {
    for (let k = 0; k < 6; k++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * b.r * 0.7;
      const sc = 0.5 + rng() * 0.9;
      m.makeScale(sc, sc, sc);
      m.setPosition(b.x + Math.cos(a) * r, 0.25, b.z + Math.sin(a) * r);
      shrubs.setMatrixAt(si++, m);
    }
  }
  shrubs.count = si;
  shrubs.castShadow = true;
  g.add(shrubs);

  // plaza: pale stone ring, sand center — no monument (none in the reference)
  const F = INFIELD.features;
  const plazaRing = new THREE.Mesh(new THREE.RingGeometry(F.plaza.r * 0.62, F.plaza.r, 44), mats.stone);
  plazaRing.rotation.x = -Math.PI / 2;
  plazaRing.position.set(F.plaza.x, 0.13, F.plaza.z);
  g.add(plazaRing);
  const plazaInner = new THREE.Mesh(new THREE.RingGeometry(F.plaza.r * 0.30, F.plaza.r * 0.44, 40), mats.path);
  plazaInner.rotation.x = -Math.PI / 2;
  plazaInner.position.set(F.plaza.x, 0.13, F.plaza.z);
  g.add(plazaInner);

  // concentric green circle
  const gc = F.greenCircle;
  const gc1 = new THREE.Mesh(new THREE.CircleGeometry(gc.r, 36), mats.greenDark);
  gc1.rotation.x = -Math.PI / 2;
  gc1.position.set(gc.x, 0.12, gc.z);
  g.add(gc1);
  const gc2 = new THREE.Mesh(new THREE.RingGeometry(gc.r * 0.45, gc.r * 0.65, 36), mats.path);
  gc2.rotation.x = -Math.PI / 2;
  gc2.position.set(gc.x, 0.14, gc.z);
  g.add(gc2);

  // radial star feature (flat, subtle)
  const st = F.star;
  const stDisc = new THREE.Mesh(new THREE.CircleGeometry(st.r, 28), mats.pathMinor);
  stDisc.rotation.x = -Math.PI / 2;
  stDisc.position.set(st.x, 0.12, st.z);
  g.add(stDisc);
  const spokes = [];
  for (let i = 0; i < 4; i++) {
    const sp = new THREE.BoxGeometry(st.r * 2.1, 0.1, 0.5);
    sp.rotateY((i / 4) * Math.PI);
    sp.translate(st.x, 0.16, st.z);
    spokes.push(sp);
  }
  g.add(new THREE.Mesh(mergeGeometries(spokes), mats.stone));

  return g;
}

// ---------------------------------------------------------------------------
// Far surroundings V2: smooth ridgelines (no cones) + irregular city clusters
// ---------------------------------------------------------------------------

export function buildSurroundings(mats) {
  const g = new THREE.Group();
  g.name = 'v2_surroundings';
  const rng = mulberry32(2077);

  // soft distant ridgelines: heavily flattened, stretched spheres
  const ridgeGeo = new THREE.SphereGeometry(1, 24, 10);
  const ridges = new THREE.InstancedMesh(ridgeGeo, mats.ridge, 9);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const ridgeDefs = [
    { a: 3.6, d: 3400, w: 1500, h: 190 }, { a: 3.1, d: 3800, w: 1900, h: 250 },
    { a: 2.6, d: 3300, w: 1300, h: 160 }, { a: 4.1, d: 3600, w: 1600, h: 220 },
    { a: 0.4, d: 4200, w: 2000, h: 240 }, { a: 5.4, d: 4100, w: 1700, h: 180 },
    { a: 1.6, d: 4300, w: 1800, h: 210 }, { a: 4.8, d: 3900, w: 1500, h: 160 },
    { a: 2.1, d: 4000, w: 1400, h: 150 },
  ];
  ridgeDefs.forEach((r, i) => {
    const x = Math.cos(r.a) * r.d, z = Math.sin(r.a) * r.d;
    q.setFromAxisAngle(up, -r.a + Math.PI / 2 + (rng() - 0.5) * 0.4);
    m.compose(new THREE.Vector3(x, -r.h * 0.28, z), q, new THREE.Vector3(r.w, r.h, r.w * 0.22));
    ridges.setMatrixAt(i, m);
  });
  g.add(ridges);

  // irregular low-rise city: clustered blocks with varied yaw (NE + N + E)
  const blockGeo = new THREE.BoxGeometry(1, 1, 1);
  const clusters = [
    { x: 950, z: -900, n: 40, spread: 330 },
    { x: 1500, z: -420, n: 36, spread: 300 },
    { x: 700, z: -1500, n: 30, spread: 380 },
    { x: 1700, z: 300, n: 26, spread: 260 },
    { x: 250, z: -1750, n: 24, spread: 300 },
    { x: 2100, z: -1050, n: 26, spread: 340 },
  ];
  const total = clusters.reduce((s, c) => s + c.n, 0);
  const town = new THREE.InstancedMesh(blockGeo, mats.town, total);
  const townDark = new THREE.InstancedMesh(blockGeo, mats.townDark, Math.floor(total * 0.4));
  let ti = 0, di = 0;
  for (const cl of clusters) {
    for (let k = 0; k < cl.n; k++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * cl.spread;
      const x = cl.x + Math.cos(a) * r, z = cl.z + Math.sin(a) * r * 0.8;
      const w = 14 + rng() * 46;
      const d = 12 + rng() * 40;
      const tall = rng() > 0.94;
      const h = tall ? 20 + rng() * 14 : 4 + rng() * 10;
      q.setFromAxisAngle(up, (rng() - 0.5) * 0.7);
      m.compose(new THREE.Vector3(x, h / 2, z), q, new THREE.Vector3(w, h, d));
      if (rng() > 0.6 && di < townDark.count) townDark.setMatrixAt(di++, m);
      else town.setMatrixAt(ti++, m);
    }
  }
  town.count = ti;
  townDark.count = di;
  g.add(town, townDark);

  // a couple of grey connector roads heading toward the city
  const roadMat = mats.asphaltFlat;
  const mkRoad = (pts, w) => {
    const rd = buildRibbon(pts, w, 0.045, roadMat);
    g.add(rd);
  };
  mkRoad([[430, 300], [900, 620], [1600, 800]], 10);
  mkRoad([[240, -300], [700, -800], [950, -1300]], 10);

  return g;
}

export function buildPropsV2(mats) {
  const g = new THREE.Group();
  g.name = 'v2_props';
  g.add(
    buildRails(mats),
    buildPalms(mats),
    buildFloodlights(mats),
    buildBuildings(mats),
    buildInfield(mats),
    buildSurroundings(mats)
  );
  return g;
}
