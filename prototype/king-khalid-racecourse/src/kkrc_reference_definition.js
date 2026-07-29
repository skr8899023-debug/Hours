// KKRC V2 — reference-calibrated track definition (single source of truth).
// Pure math + data, zero rendering dependencies. Everything in the V2 scene
// (geometry, props placement, cameras, exported metadata) derives from here.
//
// Coordinate system: right-handed, Y up, ground on XZ, meters.
// Mapping to the aerial reference: image-up = -X (west), image-left = +Z
// (south, grandstand side). s = arc length along the centerline, s=0 at the
// west end of the home straight (south side), running eastward — race
// direction is counter-clockwise seen from above.
//
// The centerline is a closed Catmull-Rom spline through CONTROL_POINTS.
// The points were digitized against the aerial reference via a two-circle
// egg construction (west turn r≈165 m, east turn r≈200 m, straights ≈378 m,
// south straight climbing ~5.3° east — the east end of the oval is visibly
// wider in the reference). Each point is individually editable for further
// calibration in REFERENCE ALIGNMENT MODE.

export const CONTROL_POINTS = [
  [-205.2, 164.3],
  [-137.3, 170.6],
  [-69.4, 176.9],
  [-1.4, 183.1],
  [66.5, 189.4],
  [134.4, 195.7],
  [202.4, 199.6],
  [268.5, 184.0],
  [325.5, 147.1],
  [366.9, 93.3],
  [387.9, 28.8],
  [386.1, -39.1],
  [361.8, -102.4],
  [317.6, -154.0],
  [258.8, -187.8],
  [192.0, -200.0],
  [124.0, -194.7],
  [56.1, -188.5],
  [-11.8, -182.2],
  [-79.8, -175.9],
  [-147.7, -169.6],
  [-215.6, -163.0],
  [-278.9, -139.0],
  [-327.2, -91.6],
  [-352.5, -28.7],
  [-350.3, 39.0],
  [-321.2, 100.1],
  [-269.9, 144.4],
];

export const TRACK = {
  name: 'King Khalid Racecourse',
  id: 'kkrc',
  version: 2,
  units: 'meters',
  raceDirection: 'counter-clockwise (viewed from above, north = -Z ... image-up = west)',
  mainTrack: {
    surface: 'dirt (warm clay / terracotta)',
    width: 24,
    laneCount: 8,
    laneWidth: 3,
    innerEdgeOffset: 12,   // o > 0 toward infield
    outerEdgeOffset: -12,
  },
  // narrow light service path hugging the infield side of the main track
  // (visible as a thin pale ring inside the dirt in the overhead reference)
  innerServicePath: { innerEdgeOffset: 17, outerEdgeOffset: 14 },
  trainingTrack: {
    surface: 'sand',
    width: 16,
    innerEdgeOffset: -18,
    outerEdgeOffset: -34,
  },
  // grey asphalt perimeter service road with light poles (clearly visible
  // in the oblique reference), plus sandy shoulders on both sides
  serviceRoad: { innerEdgeOffset: -40, outerEdgeOffset: -48 },
  outerShoulderOffset: -54,
  innerVergeOffset: 18,      // infield boundary
  perimeterFenceOffset: -50,
  railHeight: 1.15,
  startLineS: 210,
  finishLineS: 300,
};

// Chute / training extension leaving the south-east of the oval (the wide
// diagonal sand band in the lower right of the oblique reference).
export const CHUTE = { s: 470, offset: -26, length: 235, width: 16 };

// ---------------------------------------------------------------------------
// Closed Catmull-Rom centerline with arc-length lookup
// ---------------------------------------------------------------------------

const LUT_SIZE = 4096;
let _lut = null;

function cr(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

function lut() {
  if (_lut) return _lut;
  const n = CONTROL_POINTS.length;
  const pts = new Float64Array(LUT_SIZE * 2);
  for (let i = 0; i < LUT_SIZE; i++) {
    const u = (i / LUT_SIZE) * n;
    const seg = Math.floor(u), t = u - seg;
    const p0 = CONTROL_POINTS[(seg - 1 + n) % n];
    const p1 = CONTROL_POINTS[seg % n];
    const p2 = CONTROL_POINTS[(seg + 1) % n];
    const p3 = CONTROL_POINTS[(seg + 2) % n];
    pts[i * 2] = cr(p0[0], p1[0], p2[0], p3[0], t);
    pts[i * 2 + 1] = cr(p0[1], p1[1], p2[1], p3[1], t);
  }
  const cum = new Float64Array(LUT_SIZE + 1);
  for (let i = 0; i < LUT_SIZE; i++) {
    const j = (i + 1) % LUT_SIZE;
    cum[i + 1] = cum[i] + Math.hypot(pts[j * 2] - pts[i * 2], pts[j * 2 + 1] - pts[i * 2 + 1]);
  }
  _lut = { pts, cum, total: cum[LUT_SIZE] };
  return _lut;
}

export function perimeter() {
  return lut().total;
}

// Position + unit tangent at arc length s.
export function pointAt(s) {
  const { pts, cum, total } = lut();
  s = ((s % total) + total) % total;
  let lo = 0, hi = LUT_SIZE;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= s) lo = mid; else hi = mid;
  }
  const t = (s - cum[lo]) / (cum[lo + 1] - cum[lo] || 1);
  const j = (lo + 1) % LUT_SIZE;
  const x = pts[lo * 2] + (pts[j * 2] - pts[lo * 2]) * t;
  const z = pts[lo * 2 + 1] + (pts[j * 2 + 1] - pts[lo * 2 + 1]) * t;
  const k = (lo + 2) % LUT_SIZE, h = (lo - 1 + LUT_SIZE) % LUT_SIZE;
  let dx = pts[k * 2] - pts[h * 2], dz = pts[k * 2 + 1] - pts[h * 2 + 1];
  const len = Math.hypot(dx, dz) || 1;
  return { x, z, dirX: dx / len, dirZ: dz / len };
}

export function normalAt(s) {
  const p = pointAt(s);
  return { x: p.dirZ, z: -p.dirX }; // inward (o > 0) normal
}

export function offsetPointAt(s, o) {
  const p = pointAt(s);
  return { x: p.x + p.dirZ * o, z: p.z - p.dirX * o, dirX: p.dirX, dirZ: p.dirZ };
}

export function sampleLoop(o, n) {
  const P = perimeter();
  const out = [];
  for (let i = 0; i < n; i++) out.push(offsetPointAt((i / n) * P, o));
  return out;
}

// Placement helper: position + yaw (radians, around Y) for props that must
// follow the track direction. yawOffset 0 = facing along +s.
export function placementAt(s, o, yawOffset = 0) {
  const p = offsetPointAt(s, o);
  return { x: p.x, z: p.z, yaw: Math.atan2(p.dirX, p.dirZ) + yawOffset };
}

// ---------------------------------------------------------------------------
// Race markers
// ---------------------------------------------------------------------------

export function laneCenterOffsets() {
  const { laneCount, laneWidth, innerEdgeOffset } = TRACK.mainTrack;
  const out = [];
  for (let i = 0; i < laneCount; i++) out.push(innerEdgeOffset - laneWidth / 2 - i * laneWidth);
  return out;
}

export function startGates() {
  return laneCenterOffsets().map((o, i) => {
    const p = offsetPointAt(TRACK.startLineS, o);
    return {
      lane: i + 1,
      position: [r2(p.x), 0, r2(p.z)],
      heading: [r2(p.dirX), 0, r2(p.dirZ)],
    };
  });
}

export function finishLine() {
  const s = TRACK.finishLineS;
  const a = offsetPointAt(s, TRACK.mainTrack.innerEdgeOffset);
  const b = offsetPointAt(s, TRACK.mainTrack.outerEdgeOffset);
  const p = pointAt(s);
  return {
    s,
    inner_point: [r2(a.x), 0, r2(a.z)],
    outer_point: [r2(b.x), 0, r2(b.z)],
    heading: [r2(p.dirX), 0, r2(p.dirZ)],
  };
}

// Three approved gameplay obstacle anchors (matching the game's current
// hurdle mode): on straights, away from turns, camera-safe. Additional
// candidates are exported separately and are NOT approved gameplay points.
const GAMEPLAY_OBSTACLE_S = [140, 1120, 1300];
const CANDIDATE_OBSTACLE_S = [60, 260, 520, 700, 880, 1480, 1650, 1810];

function obstacleAnchor(s, id) {
  const p = pointAt(s);
  const n = normalAt(s);
  const takeoff = pointAt(s - 9);
  const landing = pointAt(s + 9);
  return {
    id,
    arc_length: r2(s),
    position: [r2(p.x), 0, r2(p.z)],
    tangent: [r2(p.dirX), 0, r2(p.dirZ)],
    normal: [r2(n.x), 0, r2(n.z)],
    obstacle_rotation_y: r2(Math.atan2(p.dirX, p.dirZ) + Math.PI / 2),
    takeoff_point: [r2(takeoff.x), 0, r2(takeoff.z)],
    landing_point: [r2(landing.x), 0, r2(landing.z)],
    safe_camera_visibility: true,
    visibility_note: 'on a straight, >60 m from turn entry/exit, unobstructed from trackside and grandstand anchors',
  };
}

export function gameplayObstacleAnchors() {
  return GAMEPLAY_OBSTACLE_S.map((s, i) => obstacleAnchor(s, `gameplay_obstacle_${i + 1}`));
}

export function candidateObstacleAnchors() {
  return CANDIDATE_OBSTACLE_S.map((s, i) => {
    const a = obstacleAnchor(s, `candidate_${String(i + 1).padStart(2, '0')}`);
    a.safe_camera_visibility = false;
    a.visibility_note = 'candidate only — not validated for gameplay';
    return a;
  });
}

// ---------------------------------------------------------------------------
// Camera anchors (all six exported with the metadata)
// ---------------------------------------------------------------------------

export const CAMERA_ANCHORS = {
  referenceMatch: {
    type: 'perspective',
    position: [480, 235, 640],
    target: [-120, 0, -80],
    fov: 52,
    description: 'Matches the oblique aerial reference: from the south, grandstand side near, city skyline behind, chute lower right',
  },
  topOrthographic: {
    type: 'orthographic',
    position: [0, 900, 0.01],
    target: [0, 0, 0],
    halfWidth: 500,
    description: 'Plan view for reference-overlay alignment and geometry comparison',
  },
  aerialHero: {
    type: 'perspective',
    position: [-470, 250, 480],
    target: [40, 0, 10],
    fov: 50,
    description: 'Beauty shot, low oblique from the south-west',
  },
  trackside: {
    type: 'perspective',
    position: [150, 2.6, 212],
    target: [-90, 1.8, 182],
    fov: 55,
    description: 'Eye level just outside the outer rail near the finish line, looking back down the home straight',
  },
  grandstand: {
    type: 'perspective',
    position: [55, 12, 236],
    target: [175, 2, 165],
    fov: 50,
    description: 'From the grandstand tiers toward the finish line and east turn',
  },
  integrationOverview: {
    type: 'perspective',
    position: [520, 480, 600],
    target: [0, 0, 0],
    fov: 48,
    description: 'Wide three-quarter view for integration review: whole venue plus surroundings margin',
  },
};

// ---------------------------------------------------------------------------
// Zones (buildings, vegetation, infield layout) — every entry is backed by a
// visible element in the aerial reference; nothing decorative is invented.
// ---------------------------------------------------------------------------

export const BUILDING_ZONES = {
  // long grandstand row on the south (image-left) straight, canopy roof
  grandstand: { s: 285, offset: -64, length: 145, depth: 32, note: 'main stand with canopy, faces the home straight' },
  stewardsTower: { s: 312, offset: -58 },
  // green parade/paddock oval outside the south-west corner (oblique ref, lower left)
  paddock: { s: 60, offset: -92, rx: 45, rz: 28 },
  // white shade canopies west of the stand (overhead ref, left edge)
  canopies: { sList: [185, 202, 219, 236], offset: -70 },
  serviceBuildings: [
    { s: 18, offset: -100, w: 42, d: 20, h: 8, note: 'SW corner service block' },
    { s: 350, offset: -86, w: 26, d: 14, h: 6, note: 'east service block near stand' },
  ],
  parking: [
    { s: 255, offset: -112, w: 115, d: 55 },
    { s: 340, offset: -104, w: 70, d: 45 },
  ],
  entranceGate: { s: 430, offset: -66 },
  // long stable barn rows west of the venue (sunset reference, lower left)
  stables: { x: -560, z: -70, rows: 2, perRow: 6, w: 68, d: 13, gapX: 105, gapZ: 52 },
};

export const VEGETATION_ZONES = [
  // dense tree line along the far (north) side — visible in all references
  { type: 'row', sFrom: 1050, sTo: 1430, offset: -58, spacing: 13 },
  // partial row rounding the east turn
  { type: 'row', sFrom: 450, sTo: 900, offset: -60, spacing: 16 },
  // north half of the west arc
  { type: 'row', sFrom: 1440, sTo: 1760, offset: -58, spacing: 14 },
  // clusters near the buildings (south side is NOT a continuous row)
  { type: 'cluster', s: 62, offset: -80, radius: 26, count: 12 },
  { type: 'cluster', s: 290, offset: -84, radius: 22, count: 8 },
  { type: 'cluster', s: 425, offset: -78, radius: 18, count: 7 },
  // sparse palms inside the infield, tied to the garden layout
  {
    type: 'infield', anchors: [
      [-150, -25], [-60, 0], [30, 25], [120, 50], [-40, -75],
      [80, -35], [-110, 60], [10, 80], [170, 0],
    ], perAnchor: 3, radius: 14,
  },
];

export const INFIELD = {
  // walking paths digitized from the reference (long diagonal promenade,
  // one crossing path, an inner loop, two short connectors)
  paths: [
    { id: 'promenade', width: 5, points: [[-260, -60], [-140, -12], [0, 18], [150, 58], [252, 96]] },
    { id: 'cross', width: 3.5, points: [[-160, 118], [-40, 44], [70, -42], [172, -96]] },
    { id: 'loop', width: 3, ellipse: { cx: -10, cz: 8, rx: 200, rz: 95, samples: 40 } },
    { id: 'plaza_spur', width: 2.5, points: [[-58, -8], [-56, -42]] },
    { id: 'circle_spur', width: 2.5, points: [[86, 40], [104, 50]] },
  ],
  features: {
    // pale ring plaza, upper-middle of the infield in the overhead reference
    plaza: { x: -55, z: -60, r: 20 },
    // concentric green circle, lower-right quarter
    greenCircle: { x: 110, z: 55, r: 15 },
    // small geometric radial feature, lower-left quarter
    star: { x: -125, z: 68, r: 11 },
  },
  // planting beds at fixed anchors along the paths (structure is manual;
  // only the organic outline jitter uses a fixed seed)
  bedAnchors: [
    { x: -180, z: -40, r: 19 }, { x: -120, z: -15, r: 15 }, { x: -70, z: 5, r: 21 },
    { x: -20, z: 15, r: 13 }, { x: 40, z: 30, r: 22 }, { x: 100, z: 45, r: 15 },
    { x: 160, z: 70, r: 18 }, { x: -90, z: 60, r: 16 }, { x: -30, z: 78, r: 12 },
    { x: 60, z: -60, r: 18 }, { x: 0, z: -92, r: 13 }, { x: -140, z: -90, r: 15 },
    { x: 120, z: -22, r: 19 }, { x: 195, z: 20, r: 13 },
    { x: -230, z: 20, r: 14 }, { x: 240, z: -40, r: 15 },
    { x: 20, z: 60, r: 14 }, { x: -60, z: -110, r: 12 },
  ],
};

export const SERVICE_ACCESS_ROADS = [
  // from the perimeter road out to the parking aprons / entrances
  { sFrom: 258, length: 70, width: 8 },
  { sFrom: 432, length: 320, width: 9, note: 'SE entrance road, continues toward the city' },
  { sFrom: 1240, length: 220, width: 8, note: 'north access toward the built-up side' },
];

function r2(v) {
  return Math.round(v * 100) / 100;
}
