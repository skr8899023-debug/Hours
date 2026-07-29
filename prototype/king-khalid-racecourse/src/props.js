// Props for the KKRC scene prototype: perimeter palms, rail posts, floodlight
// towers, grandstand + venue buildings, infield garden features, and the far
// surroundings. Repeated objects use InstancedMesh to keep draw calls low.

import * as THREE from 'three';
import {
  TRACK, perimeter, offsetPointAt, sampleLoop,
} from './track_definition.js';
import { buildRibbon, buildBlob } from './geometry.js';

// Deterministic RNG so the scene is identical on every load.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Palms
// ---------------------------------------------------------------------------

function palmCrownGeometry() {
  // 8 drooping frond quads arranged radially — one merged geometry.
  const positions = [];
  const indices = [];
  const frondLen = 3.4;
  const frondW = 0.75;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const droop = -0.9;
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const side = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(frondW / 2);
    const tip = dir.clone().multiplyScalar(frondLen).add(new THREE.Vector3(0, droop, 0));
    const mid = dir.clone().multiplyScalar(frondLen * 0.45).add(new THREE.Vector3(0, 0.25, 0));
    const base = new THREE.Vector3(0, 0, 0);
    const i0 = positions.length / 3;
    positions.push(
      base.x, base.y, base.z,
      mid.x + side.x, mid.y, mid.z + side.z,
      mid.x - side.x, mid.y, mid.z - side.z,
      tip.x, tip.y, tip.z
    );
    indices.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function buildPalms(mats) {
  const g = new THREE.Group();
  g.name = 'props_palms';
  const rng = mulberry32(42);
  const P = perimeter();

  // two staggered rows just outside the perimeter fence
  const placements = [];
  for (const [o, spacing, phase] of [[-53, 14, 0], [-60, 16, 7]]) {
    for (let s = phase; s < P; s += spacing) {
      const p = offsetPointAt(s, o + (rng() - 0.5) * 2);
      placements.push({ x: p.x, z: p.z, h: 6 + rng() * 4, rot: rng() * Math.PI * 2 });
    }
  }

  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.42, 1, 6);
  trunkGeo.translate(0, 0.5, 0); // pivot at base, unit height → scaled per instance
  const crownGeo = palmCrownGeometry();

  const trunks = new THREE.InstancedMesh(trunkGeo, mats.palmTrunk, placements.length);
  const crowns = new THREE.InstancedMesh(crownGeo, mats.palmFrond, placements.length);
  trunks.castShadow = crowns.castShadow = true;

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  placements.forEach((p, i) => {
    m.compose(
      new THREE.Vector3(p.x, 0, p.z),
      q.setFromAxisAngle(up, p.rot),
      new THREE.Vector3(1, p.h, 1)
    );
    trunks.setMatrixAt(i, m);
    m.compose(
      new THREE.Vector3(p.x, p.h, p.z),
      q.setFromAxisAngle(up, p.rot),
      new THREE.Vector3(0.8 + p.h / 20, 0.8 + p.h / 30, 0.8 + p.h / 20)
    );
    crowns.setMatrixAt(i, m);
  });
  g.add(trunks, crowns);
  return g;
}

// ---------------------------------------------------------------------------
// Rail posts + floodlights
// ---------------------------------------------------------------------------

export function buildRailPosts(mats) {
  const g = new THREE.Group();
  g.name = 'props_rail_posts';
  const P = perimeter();
  const offsets = [
    TRACK.mainTrack.innerEdgeOffset + 0.4,
    TRACK.mainTrack.outerEdgeOffset - 0.4,
  ];
  const spacing = 12;
  const count = offsets.length * Math.ceil(P / spacing);
  const geo = new THREE.CylinderGeometry(0.05, 0.05, TRACK.railHeight, 5);
  geo.translate(0, TRACK.railHeight / 2, 0);
  const posts = new THREE.InstancedMesh(geo, mats.railWhite, count);
  const m = new THREE.Matrix4();
  let i = 0;
  for (const o of offsets) {
    for (let s = 0; s < P; s += spacing) {
      const p = offsetPointAt(s, o);
      m.makeTranslation(p.x, 0, p.z);
      posts.setMatrixAt(i++, m);
    }
  }
  posts.count = i;
  g.add(posts);
  return g;
}

export function buildFloodlights(mats) {
  const g = new THREE.Group();
  g.name = 'props_floodlights';
  const P = perimeter();
  const n = 12;
  const poleGeo = new THREE.CylinderGeometry(0.4, 0.7, 30, 8);
  poleGeo.translate(0, 15, 0);
  const headGeo = new THREE.BoxGeometry(5, 2.4, 0.8);
  const poles = new THREE.InstancedMesh(poleGeo, mats.steel, n);
  const heads = new THREE.InstancedMesh(headGeo, mats.lightHead, n);
  poles.castShadow = true;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (let i = 0; i < n; i++) {
    const s = (i / n) * P + 40;
    const p = offsetPointAt(s, -49);
    m.makeTranslation(p.x, 0, p.z);
    poles.setMatrixAt(i, m);
    // head faces the track (rotate around Y to align with the tangent)
    const yaw = Math.atan2(p.dirX, p.dirZ);
    m.compose(new THREE.Vector3(p.x, 29, p.z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1));
    heads.setMatrixAt(i, m);
  }
  g.add(poles, heads);
  return g;
}

// ---------------------------------------------------------------------------
// Grandstand + venue buildings (south / home-straight side)
// ---------------------------------------------------------------------------

export function buildGrandstand(mats) {
  const g = new THREE.Group();
  g.name = 'props_grandstand';
  const zBase = 245; // south of the home straight (track edge ≈ z=228)

  // base podium
  const podium = new THREE.Mesh(new THREE.BoxGeometry(170, 3, 34), mats.buildingBeige);
  podium.position.set(40, 1.5, zBase + 15);
  podium.castShadow = podium.receiveShadow = true;
  g.add(podium);

  // seating tiers rising away from the track
  for (let i = 0; i < 8; i++) {
    const tier = new THREE.Mesh(new THREE.BoxGeometry(150, 2, 3.4), mats.buildingWhite);
    tier.position.set(40, 3 + i * 2, zBase + 4 + i * 3.2);
    tier.castShadow = tier.receiveShadow = true;
    g.add(tier);
  }

  // rear building block with a glass band
  const block = new THREE.Mesh(new THREE.BoxGeometry(150, 14, 10), mats.buildingBeige);
  block.position.set(40, 10, zBase + 32);
  block.castShadow = true;
  g.add(block);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(150.2, 4, 10.2), mats.glass);
  glass.position.set(40, 12, zBase + 32);
  g.add(glass);

  // canopy roof over the tiers on steel columns
  const roof = new THREE.Mesh(new THREE.BoxGeometry(160, 0.8, 34), mats.canopyWhite);
  roof.position.set(40, 24, zBase + 16);
  roof.rotation.x = 0.1;
  roof.castShadow = true;
  g.add(roof);
  const colGeo = new THREE.CylinderGeometry(0.5, 0.5, 22, 8);
  const cols = new THREE.InstancedMesh(colGeo, mats.steel, 6);
  const m = new THREE.Matrix4();
  for (let i = 0; i < 6; i++) {
    m.makeTranslation(-30 + i * 28, 11, zBase + 29);
    cols.setMatrixAt(i, m);
  }
  cols.castShadow = true;
  g.add(cols);

  // stewards' tower near the finish line
  const tower = new THREE.Mesh(new THREE.BoxGeometry(8, 18, 8), mats.buildingWhite);
  tower.position.set(140, 9, zBase + 6);
  tower.castShadow = true;
  g.add(tower);
  const towerGlass = new THREE.Mesh(new THREE.BoxGeometry(8.2, 3.5, 8.2), mats.glass);
  towerGlass.position.set(140, 15.5, zBase + 6);
  g.add(towerGlass);
  const towerRoof = new THREE.Mesh(new THREE.BoxGeometry(10, 0.6, 10), mats.roofDark);
  towerRoof.position.set(140, 18.3, zBase + 6);
  g.add(towerRoof);

  // auxiliary buildings west of the grandstand
  const aux1 = new THREE.Mesh(new THREE.BoxGeometry(40, 8, 22), mats.buildingBeige);
  aux1.position.set(-90, 4, zBase + 24);
  aux1.castShadow = true;
  g.add(aux1);
  const aux2 = new THREE.Mesh(new THREE.BoxGeometry(26, 6, 16), mats.buildingWhite);
  aux2.position.set(-140, 3, zBase + 20);
  aux2.castShadow = true;
  g.add(aux2);

  // white shade canopies (parade / paddock area, west side)
  const canopyGeo = new THREE.ConeGeometry(9, 5, 4);
  const canopies = new THREE.InstancedMesh(canopyGeo, mats.canopyWhite, 4);
  for (let i = 0; i < 4; i++) {
    m.makeTranslation(-200 - i * 24, 7, zBase - 10);
    canopies.setMatrixAt(i, m);
  }
  canopies.castShadow = true;
  g.add(canopies);

  // parking aprons south of the venue
  const park1 = new THREE.Mesh(new THREE.PlaneGeometry(120, 60), mats.asphalt);
  park1.rotation.x = -Math.PI / 2;
  park1.position.set(-60, 0.06, zBase + 90);
  g.add(park1);
  const park2 = new THREE.Mesh(new THREE.PlaneGeometry(80, 50), mats.asphalt);
  park2.rotation.x = -Math.PI / 2;
  park2.position.set(120, 0.06, zBase + 95);
  g.add(park2);

  return g;
}

// ---------------------------------------------------------------------------
// Infield garden: paths, planting blobs, circular features, shrubs
// ---------------------------------------------------------------------------

export function buildInfield(mats) {
  const g = new THREE.Group();
  g.name = 'props_infield';
  const rng = mulberry32(7);

  // main diagonal promenade + crossing path (echoing the aerial reference)
  g.add(buildRibbon([[-210, -90], [-60, -20], [80, 60], [200, 120]], 7, 0.14, mats.path));
  g.add(buildRibbon([[-140, 110], [-30, 40], [60, -50], [150, -110]], 5, 0.14, mats.path));
  // perimeter loop path inside the verge
  const loop = sampleLoop(TRACK.innerVergeOffset + 12, 64).map((p) => [p.x, p.z]);
  g.add(buildRibbon(loop, 4, 0.14, mats.path, true));

  // organic planting beds scattered across the infield
  for (let i = 0; i < 42; i++) {
    const a = rng() * Math.PI * 2;
    const rx = 30 + rng() * 190;
    const rz = 20 + rng() * 110;
    const cx = Math.cos(a) * rx;
    const cz = Math.sin(a) * rz;
    g.add(buildBlob(cx, cz, 8 + rng() * 14, 0.12, rng() > 0.35 ? mats.green : mats.greenDark, rng));
  }

  // low shrubs sprinkled on the beds
  const shrubGeo = new THREE.IcosahedronGeometry(1, 0);
  shrubGeo.scale(1, 0.6, 1);
  const shrubs = new THREE.InstancedMesh(shrubGeo, mats.shrub, 160);
  const m = new THREE.Matrix4();
  for (let i = 0; i < 160; i++) {
    const a = rng() * Math.PI * 2;
    const cx = Math.cos(a) * (20 + rng() * 200);
    const cz = Math.sin(a) * (15 + rng() * 115);
    const s = 0.6 + rng() * 1.2;
    m.makeScale(s, s, s);
    m.setPosition(cx, 0.3, cz);
    shrubs.setMatrixAt(i, m);
  }
  shrubs.castShadow = true;
  g.add(shrubs);

  // central plaza (north-center): stone circle + green ring + small monument
  const plaza = new THREE.Group();
  const plazaDisc = new THREE.Mesh(new THREE.CircleGeometry(28, 40), mats.stone);
  plazaDisc.rotation.x = -Math.PI / 2;
  plazaDisc.position.y = 0.15;
  plaza.add(plazaDisc);
  const plazaRing = new THREE.Mesh(new THREE.RingGeometry(18, 24, 40), mats.green);
  plazaRing.rotation.x = -Math.PI / 2;
  plazaRing.position.y = 0.17;
  plaza.add(plazaRing);
  const monument = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3, 9, 8), mats.buildingWhite);
  monument.position.y = 4.5;
  monument.castShadow = true;
  plaza.add(monument);
  plaza.position.set(-40, 0, -60);
  g.add(plaza);

  // fountain circle (south-east)
  const fountain = new THREE.Group();
  const fDisc = new THREE.Mesh(new THREE.CircleGeometry(16, 36), mats.stone);
  fDisc.rotation.x = -Math.PI / 2;
  fDisc.position.y = 0.15;
  fountain.add(fDisc);
  const fWater = new THREE.Mesh(new THREE.CircleGeometry(9, 36), mats.water);
  fWater.rotation.x = -Math.PI / 2;
  fWater.position.y = 0.2;
  fountain.add(fWater);
  const fRing = new THREE.Mesh(new THREE.TorusGeometry(9.5, 0.5, 8, 36), mats.buildingWhite);
  fRing.rotation.x = -Math.PI / 2;
  fRing.position.y = 0.4;
  fountain.add(fRing);
  fountain.position.set(120, 0, 70);
  g.add(fountain);

  // geometric star feature (south-west)
  const star = new THREE.Group();
  const sDisc = new THREE.Mesh(new THREE.CircleGeometry(14, 32), mats.path);
  sDisc.rotation.x = -Math.PI / 2;
  sDisc.position.y = 0.15;
  star.add(sDisc);
  const spokeGeo = new THREE.BoxGeometry(26, 0.2, 0.6);
  for (let i = 0; i < 4; i++) {
    const spoke = new THREE.Mesh(spokeGeo, mats.roofDark);
    spoke.position.y = 0.25;
    spoke.rotation.y = (i / 4) * Math.PI;
    star.add(spoke);
  }
  star.position.set(-130, 0, 75);
  g.add(star);

  // scattered infield palms (sparser than the perimeter rows)
  const rng2 = mulberry32(99);
  const trunkGeo = new THREE.CylinderGeometry(0.2, 0.38, 1, 6);
  trunkGeo.translate(0, 0.5, 0);
  const crownGeo = new THREE.IcosahedronGeometry(2.2, 0);
  crownGeo.scale(1, 0.55, 1);
  const n = 40;
  const trunks = new THREE.InstancedMesh(trunkGeo, mats.palmTrunk, n);
  const crowns = new THREE.InstancedMesh(crownGeo, mats.palmFrond, n);
  trunks.castShadow = crowns.castShadow = true;
  for (let i = 0; i < n; i++) {
    const a = rng2() * Math.PI * 2;
    const cx = Math.cos(a) * (25 + rng2() * 195);
    const cz = Math.sin(a) * (18 + rng2() * 110);
    const h = 5 + rng2() * 3;
    m.makeScale(1, h, 1);
    m.setPosition(cx, 0, cz);
    trunks.setMatrixAt(i, m);
    m.makeScale(1, 1, 1);
    m.setPosition(cx, h, cz);
    crowns.setMatrixAt(i, m);
  }
  g.add(trunks, crowns);

  return g;
}

// ---------------------------------------------------------------------------
// Far surroundings: hazy hills + low-rise town blocks
// ---------------------------------------------------------------------------

export function buildSurroundings(mats) {
  const g = new THREE.Group();
  g.name = 'props_surroundings';
  const rng = mulberry32(2026);

  const hillGeo = new THREE.ConeGeometry(1, 1, 7);
  const hills = new THREE.InstancedMesh(hillGeo, mats.hills, 26);
  const m = new THREE.Matrix4();
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + rng() * 0.2;
    const d = 2600 + rng() * 900;
    const r = 200 + rng() * 350;
    const h = 70 + rng() * 130;
    m.makeScale(r, h, r);
    m.setPosition(Math.cos(a) * d, 0, Math.sin(a) * d);
    hills.setMatrixAt(i, m);
  }
  g.add(hills);

  // low-rise town to the north-east (as in the reference photo)
  const blockGeo = new THREE.BoxGeometry(1, 1, 1);
  const town = new THREE.InstancedMesh(blockGeo, mats.town, 90);
  for (let i = 0; i < 90; i++) {
    const x = 700 + rng() * 1400;
    const z = -1400 + rng() * 900;
    const w = 25 + rng() * 60;
    const h = 6 + rng() * 14;
    m.makeScale(w, h, 20 + rng() * 50);
    m.setPosition(x, h / 2, z);
    town.setMatrixAt(i, m);
  }
  g.add(town);

  // stable rows west of the venue (long low barns, as in the sunset photo)
  const barns = new THREE.InstancedMesh(blockGeo, mats.buildingWhite, 14);
  for (let i = 0; i < 14; i++) {
    const row = Math.floor(i / 7);
    m.makeScale(70, 5, 14);
    m.setPosition(-520 - row * 110, 2.5, -180 + (i % 7) * 55);
    barns.setMatrixAt(i, m);
  }
  g.add(barns);

  return g;
}

export function buildProps(mats) {
  const g = new THREE.Group();
  g.name = 'props';
  g.add(
    buildPalms(mats),
    buildRailPosts(mats),
    buildFloodlights(mats),
    buildGrandstand(mats),
    buildInfield(mats),
    buildSurroundings(mats)
  );
  return g;
}
