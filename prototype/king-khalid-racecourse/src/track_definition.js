// King Khalid Racecourse — track definition (pure math, no rendering deps).
// Single source of truth shared by the scene builder (src/geometry.js) and
// the metadata exporter (tools/export_metadata.mjs).
//
// Coordinate system: right-handed, Y up, ground on the XZ plane, units in meters.
// The centerline is a "stadium" loop: two straights along X joined by
// semicircular turns. s = arc-length along the centerline, s=0 at the west end
// of the home straight (south side, z = +turnRadius), running eastward (+X).
// Lateral offset o is measured from the centerline: o > 0 toward the infield,
// o < 0 outward.

export const TRACK = {
  name: 'King Khalid Racecourse',
  id: 'kkrc',
  units: 'meters',
  straightLength: 500,
  turnRadius: 190,
  mainTrack: {
    surface: 'dirt',
    width: 24,
    laneCount: 8,
    laneWidth: 3,
    // band in offset space: [innerEdge, outerEdge] (inward positive)
    innerEdgeOffset: 12,
    outerEdgeOffset: -12,
  },
  trainingTrack: {
    surface: 'sand',
    width: 18,
    gapFromMain: 8,
    innerEdgeOffset: -20,
    outerEdgeOffset: -38,
  },
  innerVergeOffset: 16,        // infield boundary (o = +16)
  outerApronOffset: -46,       // outer sand apron edge
  perimeterFenceOffset: -47,
  railHeight: 1.1,
  startLineS: 300,
  finishLineS: 380,
  raceDirection: 'counter-clockwise (viewed from above, north up)',
};

export function perimeter() {
  return 2 * TRACK.straightLength + 2 * Math.PI * TRACK.turnRadius;
}

// Returns { x, z, dirX, dirZ } — position and unit tangent at arc-length s.
export function pointAt(s) {
  const L = TRACK.straightLength;
  const R = TRACK.turnRadius;
  const P = perimeter();
  s = ((s % P) + P) % P;
  const arc = Math.PI * R;
  if (s < L) {
    // home straight (south, z = +R), heading +X
    return { x: -L / 2 + s, z: R, dirX: 1, dirZ: 0 };
  } else if (s < L + arc) {
    // east turn, center (L/2, 0)
    const t = (s - L) / R;
    return {
      x: L / 2 + R * Math.sin(t),
      z: R * Math.cos(t),
      dirX: Math.cos(t),
      dirZ: -Math.sin(t),
    };
  } else if (s < 2 * L + arc) {
    // back straight (north, z = -R), heading -X
    const u = s - L - arc;
    return { x: L / 2 - u, z: -R, dirX: -1, dirZ: 0 };
  } else {
    // west turn, center (-L/2, 0)
    const t = (s - 2 * L - arc) / R;
    return {
      x: -L / 2 - R * Math.sin(t),
      z: -R * Math.cos(t),
      dirX: -Math.cos(t),
      dirZ: Math.sin(t),
    };
  }
}

// Inward unit normal at arc-length s (o > 0 side).
export function normalAt(s) {
  const p = pointAt(s);
  return { x: p.dirZ, z: -p.dirX };
}

// Point at arc-length s, lateral offset o (o > 0 toward infield).
export function offsetPointAt(s, o) {
  const p = pointAt(s);
  const n = normalAt(s);
  return { x: p.x + n.x * o, z: p.z + n.z * o, dirX: p.dirX, dirZ: p.dirZ };
}

// n samples of the closed loop at lateral offset o → [{x,z,dirX,dirZ}, ...]
export function sampleLoop(o, n) {
  const P = perimeter();
  const pts = [];
  for (let i = 0; i < n; i++) pts.push(offsetPointAt((i / n) * P, o));
  return pts;
}

// ---------------------------------------------------------------------------
// Named anchors (portable to the main game project via the metadata exporter)
// ---------------------------------------------------------------------------

export function laneCenterOffsets() {
  const { laneCount, laneWidth, innerEdgeOffset } = TRACK.mainTrack;
  const out = [];
  for (let i = 0; i < laneCount; i++) {
    // lane 1 is the innermost lane (closest to the infield rail)
    out.push(innerEdgeOffset - laneWidth / 2 - i * laneWidth);
  }
  return out;
}

export function startGates() {
  return laneCenterOffsets().map((o, i) => {
    const p = offsetPointAt(TRACK.startLineS, o);
    return {
      lane: i + 1,
      position: [round2(p.x), 0, round2(p.z)],
      heading: [p.dirX, 0, p.dirZ],
    };
  });
}

export function finishLine() {
  const s = TRACK.finishLineS;
  const inner = offsetPointAt(s, TRACK.mainTrack.innerEdgeOffset);
  const outer = offsetPointAt(s, TRACK.mainTrack.outerEdgeOffset);
  const p = pointAt(s);
  return {
    s,
    inner_point: [round2(inner.x), 0, round2(inner.z)],
    outer_point: [round2(outer.x), 0, round2(outer.z)],
    heading: [p.dirX, 0, p.dirZ],
  };
}

// Evenly spaced anchors on the main-track centerline for future obstacles /
// gameplay props. Purely positional — nothing is rendered at these points.
export function obstacleAnchors(count = 12) {
  const P = perimeter();
  const out = [];
  for (let i = 0; i < count; i++) {
    const s = (i / count) * P;
    const p = pointAt(s);
    out.push({
      id: `obstacle_${String(i + 1).padStart(2, '0')}`,
      s: round2(s),
      lateral_offset: 0,
      position: [round2(p.x), 0, round2(p.z)],
      heading: [p.dirX, 0, p.dirZ],
    });
  }
  return out;
}

export const CAMERA_ANCHORS = {
  aerial: {
    position: [-430, 280, 520],
    target: [30, 0, 20],
    fov: 50,
    description: 'High oblique aerial matching the reference photo angle',
  },
  trackside: {
    position: [175, 2.6, 207],
    target: [-60, 1.5, 196],
    fov: 55,
    description: 'Eye-level outside the home-straight rail near the finish line',
  },
  grandstand: {
    position: [10, 14, 252],
    target: [130, 3, 180],
    fov: 50,
    description: 'From the grandstand upper tier looking toward the finish line',
  },
  overview: {
    position: [0, 980, 1],
    target: [0, 0, 0],
    fov: 45,
    description: 'Top-down plan view matching the overhead reference image',
  },
};

function round2(v) {
  return Math.round(v * 100) / 100;
}
