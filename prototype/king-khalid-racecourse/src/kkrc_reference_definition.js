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
  // NW quadrant nudged outward per the photographic overlay (V2.1): the
  // photo's back-straight/west-turn junction bulges slightly north-west of
  // the original egg construction.
  [-217.5, -166.5],
  [-283.5, -143.5],
  [-332.5, -95.0],
  [-359.0, -29.5],
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
  // finish just after the west-turn exit, in front of the stands at the
  // west end (photographic pass: the facilities cluster around the west
  // apex, not the middle of the home straight)
  finishLineS: 30,
};

// Long training extension leaving the east end nearly parallel to the main
// axis and exiting the venue (photographic pass: the band runs to the frame
// edge in the reference, far longer than the first-guess diagonal chute).
export const CHUTE = { s: 420, offset: -26, length: 430, width: 18 };

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
    position: [30, 200, 620],
    target: [30, 0, -80],
    fov: 55,
    description: 'Matches the oblique aerial photo: from the south at moderate height, west facilities left, city skyline behind, training extension exiting right',
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
    position: [-140, 2.6, 186],
    target: [90, 1.8, 196],
    fov: 55,
    description: 'Eye level just outside the outer rail near the finish line (west end of the home straight), looking east down the straight',
  },
  grandstand: {
    type: 'perspective',
    position: [-400, 13, -15],
    target: [-140, 2, 45],
    fov: 50,
    description: 'From the west-apex stand tiers looking east across the track toward the infield',
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

// V2.1 photographic pass: the facilities cluster around the WEST APEX of the
// oval (stand + paddocks + service blocks + barn rows), the south straight is
// bare apart from the perimeter road and parking aprons, and a gate house
// sits at the south-east corner.
export const BUILDING_ZONES = {
  grandstand: { s: 1620, offset: -64, length: 110, depth: 30, note: 'main stand outside the NW-to-apex stretch of the west turn, faces the track' },
  stewardsTower: { s: 1575, offset: -58 },
  paddocks: [
    { s: 1710, offset: -92, rx: 42, rz: 26, note: 'main parade oval, just south of the stand' },
    { s: 1650, offset: -86, rx: 24, rz: 16, note: 'small warm-up green beside the stand' },
  ],
  // few white shade tents just north of the stand
  canopies: { sList: [1520, 1545, 1570], offset: -80 },
  serviceBuildings: [
    { s: 1800, offset: -175, w: 55, d: 28, h: 10, note: 'large white SW building (own parking)' },
    { s: 60, offset: -95, w: 24, d: 12, h: 5, note: 'small shed on the south side' },
  ],
  parking: [
    { s: 120, offset: -105, w: 130, d: 50, note: 'south foreground rows' },
    { s: 1830, offset: -215, w: 80, d: 45, note: 'SW building lot' },
  ],
  entranceGate: { s: 480, offset: -70, note: 'SE corner gate house (red roof in the photo)' },
  // barn rows just NORTH-WEST of the venue (photo, upper left)
  stables: { x: -340, z: -160, rows: 2, perRow: 4, w: 50, d: 11, gapX: 75, gapZ: 30 },
};

export const VEGETATION_ZONES = [
  // dense tree line along the far (north) side — visible in all references
  { type: 'row', sFrom: 1050, sTo: 1430, offset: -58, spacing: 13 },
  // row rounding the east turn (photo: continues along the east outer edge)
  { type: 'row', sFrom: 430, sTo: 900, offset: -60, spacing: 16 },
  // north half of the west arc
  { type: 'row', sFrom: 1440, sTo: 1560, offset: -58, spacing: 14 },
  // clusters around the west-end facilities (photographic pass)
  { type: 'cluster', s: 1790, offset: -95, radius: 24, count: 10 },
  { type: 'cluster', s: 1660, offset: -85, radius: 20, count: 8 },
  { type: 'cluster', s: 480, offset: -82, radius: 18, count: 7 },
  // sparse palms inside the infield, tied to the garden layout
  {
    type: 'infield', anchors: [
      [-150, -25], [-60, 0], [30, 25], [120, 50], [-40, -75],
      [80, -35], [-110, 60], [10, 80], [-200, 20], [60, -70],
    ], perAnchor: 3, radius: 14,
  },
];

export const INFIELD = {
  // walking paths — V2.1: east ends trimmed where the dirt arena wedge sits
  paths: [
    { id: 'promenade', width: 5, points: [[-260, -60], [-140, -12], [0, 18], [90, 40], [140, 58]] },
    { id: 'cross', width: 3.5, points: [[-160, 118], [-40, 44], [70, -42], [150, -90]] },
    { id: 'loop', width: 3, ellipse: { cx: -30, cz: 8, rx: 185, rz: 90, samples: 40 } },
    { id: 'plaza_spur', width: 2.5, points: [[130, -35], [172, -47]] },
    { id: 'circle_spur', width: 2.5, points: [[78, 36], [96, 44]] },
  ],
  // V2.1 photographic positions (measured in edge-comparison mode against
  // the final calibrated overlay):
  features: {
    // large ornamental circle garden, NE quarter of the infield
    plaza: { x: 195, z: -50, r: 22 },
    // concentric ringed circle, right-center
    greenCircle: { x: 103, z: 46, r: 14 },
    // radial wheel/star pattern, center-west of the infield
    star: { x: -52, z: -56, r: 13 },
  },
  // open dirt arena wedge on the east side of the infield, with a small
  // structure at its east tip (clearly visible in the photo)
  arena: {
    points: [[240, -30], [350, -22], [352, 58], [248, 50]],
    building: [330, 15],
  },
  // planting beds at fixed anchors along the paths (structure is manual;
  // only the organic outline jitter uses a fixed seed)
  bedAnchors: [
    { x: -180, z: -40, r: 19 }, { x: -120, z: -15, r: 15 }, { x: -70, z: 5, r: 21 },
    { x: -20, z: 15, r: 13 }, { x: 40, z: 30, r: 22 }, { x: 100, z: 45, r: 15 },
    { x: 135, z: 65, r: 14 }, { x: -90, z: 60, r: 16 }, { x: -30, z: 78, r: 12 },
    { x: 60, z: -60, r: 18 }, { x: 0, z: -92, r: 13 }, { x: -140, z: -90, r: 15 },
    { x: 120, z: -22, r: 16 }, { x: -230, z: 20, r: 14 },
    { x: 20, z: 60, r: 14 }, { x: -60, z: -110, r: 12 },
    { x: 185, z: -45, r: 13 }, { x: 250, z: -100, r: 12 },
  ],
};

export const SERVICE_ACCESS_ROADS = [
  // from the perimeter road out to the parking aprons / entrances
  { sFrom: 130, length: 60, width: 8, note: 'south parking access' },
  { sFrom: 470, length: 320, width: 9, note: 'SE entrance road past the gate house' },
  { sFrom: 1240, length: 220, width: 8, note: 'north access toward the built-up side' },
];

function r2(v) {
  return Math.round(v * 100) / 100;
}
