// Exports portable track metadata for the main game project.
// Usage: node tools/export_metadata.mjs   (from prototype/king-khalid-racecourse/)
// Output: metadata/kkrc_track_metadata.json

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TRACK, perimeter, pointAt, sampleLoop, laneCenterOffsets,
  startGates, finishLine, obstacleAnchors, CAMERA_ANCHORS,
} from '../src/track_definition.js';

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, '..', 'metadata', 'kkrc_track_metadata.json');

const r2 = (v) => Math.round(v * 100) / 100;
const toXYZ = (pts) => pts.map((p) => [r2(p.x), 0, r2(p.z)]);

const SAMPLES = 256;

const metadata = {
  format: 'kkrc-track-metadata',
  version: 1,
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
    straight_length: TRACK.straightLength,
    turn_radius: TRACK.turnRadius,
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
      gap_from_main: TRACK.trainingTrack.gapFromMain,
    },
    rail_height: TRACK.railHeight,
  },
  centerline: {
    closed: true,
    sample_count: SAMPLES,
    points: toXYZ(sampleLoop(0, SAMPLES)),
  },
  lane_boundaries: {
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
  obstacle_anchors: obstacleAnchors(12),
  start_points: {
    line_s: TRACK.startLineS,
    gates: startGates(),
  },
  finish_line: finishLine(),
  camera_anchors: CAMERA_ANCHORS,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(metadata, null, 2) + '\n');
console.log(`Wrote ${outPath}`);
console.log(`Centerline perimeter: ${r2(perimeter())} m, samples: ${SAMPLES}`);
console.log(`Finish line at s=${TRACK.finishLineS} → ${JSON.stringify(pointAt(TRACK.finishLineS))}`);
