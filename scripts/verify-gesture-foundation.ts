import assert from 'node:assert/strict';
import { cameraPointToGesturePoint, gesturePointToViewport } from '../src/gesture/coordinateTransform';
import { classifyGesture, GestureStabilizer } from '../src/gesture/gestureClassifier';
import { HandTemporalTracker } from '../src/gesture/handSmoothing';
import type { GesturePoint, RawHandDetection } from '../src/gesture/types';

const makeHand = (gesture: 'open' | 'fist' | 'pointing', xOffset = 0): GesturePoint[] => {
  const points = Array.from({ length: 21 }, () => ({ x: 0.5 + xOffset, y: 0.72, z: 0 }));
  points[0] = { x: 0.5 + xOffset, y: 0.9, z: 0 };
  points[4] = { x: 0.28 + xOffset, y: 0.62, z: 0 };
  const fingers = [[5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]];
  fingers.forEach((indices, fingerIndex) => {
    const x = 0.38 + xOffset + fingerIndex * 0.08;
    const extended = gesture === 'open' || (gesture === 'pointing' && fingerIndex === 0);
    const ys = extended ? [0.68, 0.57, 0.43, 0.27] : [0.68, 0.59, 0.68, 0.76];
    indices.forEach((index, joint) => { points[index] = { x, y: ys[joint], z: -joint * 0.01 }; });
  });
  return points;
};

const detection = (landmarks: GesturePoint[], timestamp: number, handedness: 'Left' | 'Right' = 'Right'): RawHandDetection => ({
  landmarks,
  handedness,
  confidence: 0.92,
  timestamp,
});

assert.equal(classifyGesture(makeHand('open')), 'openPalm');
assert.equal(classifyGesture(makeHand('fist')), 'fist');
assert.equal(classifyGesture(makeHand('pointing')), 'pointing');

const stabilizer = new GestureStabilizer();
assert.equal(stabilizer.update('openPalm', 0), 'none');
assert.equal(stabilizer.update('openPalm', 121), 'openPalm');
assert.equal(stabilizer.update('fist', 140), 'openPalm');
assert.equal(stabilizer.update('fist', 261), 'fist');

const mirrored = cameraPointToGesturePoint({ x: 0.2, y: 0.25, z: -0.1 });
assert.deepEqual(mirrored, { x: 0.8, y: 0.25, z: -0.1, visibility: undefined });
assert.deepEqual(gesturePointToViewport(mirrored, 1000, 800), { x: 800, y: 200, z: -0.1 });

const tracker = new HandTemporalTracker();
tracker.update([detection(makeHand('open', -0.2), 0, 'Left'), detection(makeHand('open', 0.2), 0)], 0);
let frame = tracker.update([detection(makeHand('open', -0.2), 120, 'Left'), detection(makeHand('open', 0.2), 120)], 120);
assert.equal(frame.hands.length, 2);
assert.equal(frame.twoHandsPresent, true);
assert.equal(frame.hands.every((hand) => hand.landmarks.length === 21), true);

frame = tracker.update([], 200);
assert.equal(frame.hands.length, 2);
assert.equal(frame.hands.every((hand) => hand.lostOpacity > 0 && hand.lostOpacity < 1), true);
frame = tracker.update([], 350);
assert.equal(frame.hands.length, 0);

const responsiveTracker = new HandTemporalTracker();
responsiveTracker.update([detection(makeHand('pointing', -0.25), 0)], 0);
const fastHand = makeHand('pointing', 0.25);
const fastFrame = responsiveTracker.update([detection(fastHand, 40)], 40);
assert.ok(fastFrame.hands[0].landmarks[8].x > 0.52, 'Fast motion should reduce smoothing lag.');

console.log('Gesture foundation verification passed: classification, debounce, mirror mapping, two hands, fade, and adaptive smoothing.');
