import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gesturePointToViewport } from '../src/gesture/coordinateTransform';
import {
  HAND_LANDMARK_COUNT,
  HAND_SKELETON_CONNECTIONS,
  mapHandLandmarksToViewport,
} from '../src/gesture/handSkeletonRenderer';
import type { GesturePoint } from '../src/gesture/types';

const landmarks = Array.from({ length: HAND_LANDMARK_COUNT }, (_, index): GesturePoint => ({
  x: 0.12 + index * 0.031,
  y: 0.84 - index * 0.027,
  z: -index * 0.004,
}));

assert.equal(HAND_LANDMARK_COUNT, 21);
assert.deepEqual(HAND_SKELETON_CONNECTIONS, [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
]);

const connected = new Set(HAND_SKELETON_CONNECTIONS.flatMap(([from, to]) => [from, to]));
assert.equal(connected.size, 21, 'The standard topology must connect every MediaPipe landmark.');
for (const chain of [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]]) {
  for (let index = 1; index < chain.length; index += 1) {
    assert.ok(HAND_SKELETON_CONNECTIONS.some(([from, to]) => from === chain[index - 1] && to === chain[index]));
  }
}

for (const [width, height] of [[1280, 720], [390, 844], [844, 390], [1024, 1366]]) {
  const mapped = mapHandLandmarksToViewport(landmarks, width, height);
  landmarks.forEach((point, index) => {
    const pointerPoint = gesturePointToViewport(point, width, height);
    assert.ok(Math.abs(mapped[index * 2] - pointerPoint.x) < 0.0001);
    assert.ok(Math.abs(mapped[index * 2 + 1] - pointerPoint.y) < 0.0001);
  });
}

const openMapped = mapHandLandmarksToViewport(landmarks, 1000, 700);
const pointingMapped = mapHandLandmarksToViewport(landmarks, 1000, 700);
assert.deepEqual(pointingMapped, openMapped, 'Gesture labels must not select another skeleton geometry.');
const originalSnapshot = structuredClone(landmarks);
mapHandLandmarksToViewport(landmarks, 390, 844);
assert.deepEqual(landmarks, originalSnapshot, 'Rendering must not mutate recognition landmarks.');

const rendererSource = readFileSync('src/gesture/handSkeletonRenderer.ts', 'utf8');
const overlaySource = readFileSync('src/gesture/GestureOverlay.tsx', 'utf8');
const previewSource = readFileSync('src/gesture/devGesturePreview.ts', 'utf8');
assert.ok(!rendererSource.includes('gesture ==='));
assert.ok(!rendererSource.includes('pointing'));
assert.ok(!rendererSource.includes('compactHand'));
assert.ok(!rendererSource.includes('viewportScale'));
assert.ok(overlaySource.includes('HandSkeletonRenderer'));
assert.ok(!overlaySource.includes('createCompactHandRenderPoints'));
assert.ok(!previewSource.includes('landmarks[8] ='), 'Pointing preview must move the whole hand, not stretch landmark #8.');

console.log('Gesture skeleton verification passed: standard topology, shared mapping, no Pointing scaling, responsive alignment, and immutable landmarks.');
