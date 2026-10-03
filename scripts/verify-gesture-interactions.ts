import assert from 'node:assert/strict';
import { DwellSelectionController } from '../src/gesture/dwellController';
import { mapWaveAmplitude, mapWaveFrequency, resolveSamplingGesture } from '../src/gesture/gestureMappings';
import { GestureInteractionController, type GestureInteractionEvent } from '../src/gesture/interactionController';
import { GestureFrameStore, type GestureFrame, type GestureName, type GesturePoint, type TrackedHand } from '../src/gesture/types';
import { WAVE_FREQUENCY_MAX, WAVE_FREQUENCY_MIN } from '../src/spirit/soundSpiritIdentity';

const dwell = new DwellSelectionController();
const targetA = {};
assert.equal(dwell.update(targetA, 0, true).activated, false);
assert.equal(dwell.update(targetA, 719, true).activated, false);
assert.equal(dwell.update(targetA, 720, true).activated, true);
assert.equal(dwell.update(targetA, 2000, true).activated, false);
dwell.update(undefined, 2010, true);
assert.equal(dwell.update(targetA, 2020, true).progress, 0);
assert.equal(dwell.update(targetA, 2740, true).activated, true);
dwell.reset();
assert.equal(dwell.update(targetA, 4000, false).activated, false);

const point = (x: number, y: number, z = 0): GesturePoint => ({ x, y, z });
const makeHand = (
  id: number,
  gesture: GestureName,
  centerX: number,
  centerY = 0.5,
  palm: 'forward' | 'inward-left' | 'inward-right' = 'forward',
): TrackedHand => {
  const landmarks = Array.from({ length: 21 }, () => point(centerX, centerY, 0));
  landmarks[0] = point(centerX, centerY + 0.18, 0);
  landmarks[9] = point(centerX, centerY - 0.08, palm === 'forward' ? 0.01 : 0.2);
  if (palm === 'inward-right') {
    landmarks[5] = point(centerX + 0.11, centerY, 0);
    landmarks[17] = point(centerX - 0.11, centerY, 0);
  } else {
    landmarks[5] = point(centerX - 0.11, centerY, 0);
    landmarks[17] = point(centerX + 0.11, centerY, 0);
  }
  landmarks[8] = point(centerX, centerY - 0.28, 0);
  return { id, gesture, landmarks, handedness: id === 1 ? 'Left' : 'Right', confidence: 0.95, timestamp: 0, lostOpacity: 1 };
};
const frame = (hands: TrackedHand[], timestamp: number): GestureFrame => ({ hands, twoHandsPresent: hands.length === 2, timestamp });

const store = new GestureFrameStore();
const controller = new GestureInteractionController(store);
let state = controller.update(frame([makeHand(1, 'pointing', 0.5)], 1), 0, true);
assert.equal(state.pointer, undefined);
state = controller.update(frame([makeHand(1, 'pointing', 0.5)], 2), 301, true);
assert.ok(state.pointer);

controller.reset();
state = controller.update(frame([makeHand(1, 'fist', 0.5)], 3), 0, true);
assert.equal(state.fist?.deltaX, 0);
state = controller.update(frame([makeHand(1, 'fist', 0.51)], 4), 20, true);
assert.equal(state.fist?.axis, 'none');
state = controller.update(frame([makeHand(1, 'fist', 0.55)], 5), 40, true);
assert.equal(state.fist?.axis, 'x');
state = controller.update(frame([makeHand(1, 'fist', 0.56, 0.58)], 6), 60, true);
assert.equal(state.fist?.axis, 'x');
controller.update(frame([], 7), 80, true);
state = controller.update(frame([makeHand(1, 'fist', 0.7)], 8), 100, true);
assert.equal(state.fist?.deltaX, 0);

controller.reset();
controller.update(frame([makeHand(1, 'fist', 0.5, 0.5)], 81), 0, true);
state = controller.update(frame([makeHand(1, 'fist', 0.505, 0.55)], 82), 20, true);
assert.equal(state.fist?.axis, 'y');
state = controller.update(frame([makeHand(1, 'fist', 0.58, 0.56)], 83), 40, true);
assert.equal(state.fist?.axis, 'y', 'A locked vertical fist must not jump to horizontal movement.');
assert.equal(state.fist?.deltaX, 0);

controller.reset();
controller.update(frame([makeHand(1, 'openPalm', 0.35), makeHand(2, 'openPalm', 0.65)], 9), 0, true);
state = controller.update(frame([makeHand(1, 'openPalm', 0.33), makeHand(2, 'openPalm', 0.67)], 10), 180, true);
assert.equal(state.twoHand.gesture, 'spread');
const spreadRate = state.twoHand.rate;
state = controller.update(frame([makeHand(1, 'openPalm', 0.31), makeHand(2, 'openPalm', 0.69)], 11), 220, true);
assert.equal(state.twoHand.gesture, 'spread');
assert.ok(state.twoHand.rate >= spreadRate);
assert.equal(state.pointer, undefined);
assert.equal(state.fist, undefined, 'A valid two-hand gesture must suppress single-hand controls.');

controller.reset();
controller.update(frame([
  makeHand(1, 'openPalm', 0.25, 0.5, 'inward-left'),
  makeHand(2, 'openPalm', 0.75, 0.5, 'inward-right'),
], 12), 0, true);
state = controller.update(frame([
  makeHand(1, 'openPalm', 0.28, 0.5, 'inward-left'),
  makeHand(2, 'openPalm', 0.72, 0.5, 'inward-right'),
], 13), 180, true);
assert.equal(state.twoHand.gesture, 'close');

controller.reset();
controller.update(frame([makeHand(1, 'openPalm', 0.25), makeHand(2, 'openPalm', 0.75)], 14), 0, true);
state = controller.update(frame([makeHand(1, 'openPalm', 0.28), makeHand(2, 'openPalm', 0.72)], 15), 180, true);
assert.equal(state.twoHand.gesture, 'none', 'Palms-forward closing must not activate inward close.');

const events: GestureInteractionEvent[] = [];
controller.reset();
controller.subscribe((event) => events.push(event));
controller.update(frame([makeHand(1, 'openPalm', 0.5)], 16), 0, true);
assert.equal(events.length, 0);
controller.update(frame([makeHand(1, 'fist', 0.5)], 17), 100, true);
controller.update(frame([makeHand(1, 'openPalm', 0.5)], 18), 300, true);
assert.equal(events.filter((event) => event.type === 'explosion').length, 1);
controller.update(frame([makeHand(1, 'openPalm', 0.62)], 19), 380, true);
assert.equal(events.filter((event) => event.type === 'explosion').length, 1);
assert.equal(events.filter((event) => event.type === 'sweep').length, 0, 'Explosion cooldown suppresses immediate Blue Tears.');

assert.ok(mapWaveAmplitude(0.5, -0.05) > 0.5);
assert.ok(mapWaveAmplitude(0.5, 0.05) < 0.5);
assert.equal(mapWaveAmplitude(0.99, -1), 1);
assert.equal(mapWaveAmplitude(0.01, 1), 0);
assert.ok(mapWaveFrequency(440, 'spread', 0.01) < 440);
assert.ok(mapWaveFrequency(440, 'close', 0.01) > 440);
assert.equal(mapWaveFrequency(WAVE_FREQUENCY_MIN, 'spread', 1), WAVE_FREQUENCY_MIN);
assert.equal(mapWaveFrequency(WAVE_FREQUENCY_MAX, 'close', 1), WAVE_FREQUENCY_MAX);

assert.equal(resolveSamplingGesture('sample', 'x', null), 'sample-rate');
assert.equal(resolveSamplingGesture('quantize', 'x', null), 'quantize-depth');
assert.equal(resolveSamplingGesture('size', 'x', null), 'none');
assert.equal(resolveSamplingGesture('size', 'x', 'size-duration'), 'size-duration');
assert.equal(resolveSamplingGesture('size', 'y', 'size-duration'), 'scroll');

console.log('Gesture interaction verification passed: dwell, fist lock, two-hand orientation, mappings, sampling arbitration, and explosion cooldown.');
