// Exports portable V2 track metadata for the main game project.
// Usage: node tools/export_metadata.mjs   (from prototype/king-khalid-racecourse/)
// Output: metadata/kkrc_track_metadata.json (deterministic)
// The V1 export is preserved at metadata/kkrc_track_metadata.v1.legacy.json.

import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TRACK, CHUTE, CONTROL_POINTS, SERVICE_ACCESS_ROADS,
  BUILDING_ZONES, VEGETATION_ZONES, INFIELD, CAMERA_ANCHORS,
  perimeter, pointAt, sampleLoop, laneCenterOffsets,
  startGates, finishLine, gameplayObstacleAnchors, candidateObstacleAnchors,
} from '../src/kkrc_reference_definition.js';

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, '..', 'metadata', 'kkrc_track_metadata.json');
const landmarksPath = join(here, '..', 'reference', 'reference_landmarks.json');

const r2 = (v) => Math.round(v * 100) / 100;
const toXYZ = (pts) => pts.map((p) => [r2(p.x), 0, r2(p.z)]);

const SAMPLES = 256;
const landmarks = JSON.parse(readFileSync(landmarksPath, 'utf8'));

const metadata = {
  format: 'kkrc-track-metadata',
  version: 2,
  generated_by: 'prototype/king-khalid-racecourse/tools/export_metadata.mjs',
  units: TRACK.units,
  coordinate_system: {
    handedness: 'right-handed',
    up_axis: 'Y',
    ground_plane: 'XZ',
    origin: 'geometric center of the track oval',
  },
  track: {
    name: TRACK.name,
    id: TRACK.id,
    definition: 'closed Catmull-Rom spline through reference-calibrated control points (src/kkrc_reference_definition.js)',
    control_points: CONTROL_POINTS.map(([x, z]) => [r2(x), 0, r2(z)]),
    centerline_perimeter: r2(perimeter()),
    race_direction: TRACK.raceDirection,
    main_track: {
      surface: TRACK.mainTrack.surface,
      width: TRACK.mainTrack.width,
      lane_count: TRACK.mainTrack.laneCount,
      lane_width: TRACK.mainTrack.laneWidth,
    },
    training_track: {
      surface: TRACK.trainingTrack.surface,
      width: TRACK.trainingTrack.width,
    },
    chute: CHUTE,
    rail_height: TRACK.railHeight,
  },
  centerline: {
    closed: true,
    sample_count: SAMPLES,
    points: toXYZ(sampleLoop(0, SAMPLES)),
  },
  track_boundaries: {
    main_track: {
      inner: toXYZ(sampleLoop(TRACK.mainTrack.innerEdgeOffset, SAMPLES)),
      outer: toXYZ(sampleLoop(TRACK.mainTrack.outerEdgeOffset, SAMPLES)),
      lane_center_offsets: laneCenterOffsets().map(r2),
    },
    training_track: {
      inner: toXYZ(sampleLoop(TRACK.trainingTrack.innerEdgeOffset, SAMPLES)),
      outer: toXYZ(sampleLoop(TRACK.trainingTrack.outerEdgeOffset, SAMPLES)),
    },
  },
  service_road_boundaries: {
    inner: toXYZ(sampleLoop(TRACK.serviceRoad.innerEdgeOffset, SAMPLES)),
    outer: toXYZ(sampleLoop(TRACK.serviceRoad.outerEdgeOffset, SAMPLES)),
    access_roads: SERVICE_ACCESS_ROADS,
  },
  start_points: {
    line_s: TRACK.startLineS,
    gates: startGates(),
  },
  finish_line: finishLine(),
  gameplay_obstacle_anchors: gameplayObstacleAnchors(),
  candidate_obstacle_anchors: candidateObstacleAnchors(),
  camera_anchors: CAMERA_ANCHORS,
  building_zones: BUILDING_ZONES,
  vegetation_zones: VEGETATION_ZONES,
  infield_layout: INFIELD,
  reference_landmarks: landmarks.landmarks,
  reference_image_mapping: landmarks.image_mapping,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(metadata, null, 2) + '\n');
console.log(`Wrote ${outPath}`);
console.log(`Centerline perimeter: ${r2(perimeter())} m, samples: ${SAMPLES}`);
const f = pointAt(TRACK.finishLineS);
console.log(`Finish line at s=${TRACK.finishLineS} -> x=${r2(f.x)}, z=${r2(f.z)}`);
