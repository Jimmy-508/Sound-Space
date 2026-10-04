import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { InteractionSoundPlayer } from '../src/audio/interactionSound';
import { createBlueTearSeeds, clampEffectCount, gestureEffectLimits } from '../src/gesture/gestureEffectsModel';
import { mapWaveAmplitude } from '../src/gesture/gestureMappings';
import { GestureInteractionController } from '../src/gesture/interactionController';
import { clampNavigationScroll, getNavigationEdgeMotion, mapPageScrollDelta } from '../src/gesture/navigationGesture';
import { GestureFrameStore, type GesturePoint, type TrackedHand } from '../src/gesture/types';
import { computeAttractionSteering } from '../src/visualization/repulsor';

const landmarks = Array.from({ length: 21 }, (_, index) => ({
  x: 0.32 + index % 5 * 0.035,
  y: 0.68 - Math.floor(index / 5) * 0.075,
  z: 0,
}));
const previousLandmarks = landmarks.map((point, index) => ({ ...point, x: point.x - 0.018 - index * 0.0002 }));
const slowSeeds = createBlueTearSeeds({
  landmarks,
  previousLandmarks,
  velocityX: 0.42,
  velocityY: 0.02,
  speed: 0.42,
  turnIntensity: 0.05,
}, () => 0.5);
const fastSeeds = createBlueTearSeeds({
  landmarks,
  previousLandmarks,
  velocityX: 1.42,
  velocityY: -0.35,
  speed: 1.46,
  turnIntensity: 0.72,
}, () => 0.5);
assert.equal(createBlueTearSeeds({ landmarks, previousLandmarks, velocityX: 0, velocityY: 0, speed: 0, turnIntensity: 0 }).length, 0);
assert.ok(slowSeeds.length > 0, 'A moving open hand should disturb Blue Tears.');
assert.ok(new Set(slowSeeds.map((seed) => seed.sourceIndex)).size > 6, 'Emission must sample multiple hand landmarks.');
assert.ok(fastSeeds.length > slowSeeds.length, 'A faster sweep should create a denser bounded wake.');
assert.ok(fastSeeds.length <= 46);
const bounded = Array.from({ length: 400 }, (_, index) => index);
clampEffectCount(bounded, gestureEffectLimits.blueTears);
assert.equal(bounded.length, gestureEffectLimits.blueTears);
assert.equal(gestureEffectLimits.explosionParticles, 112);
assert.equal(gestureEffectLimits.explosionBursts, 3);

const navRect = { left: 20, right: 380, top: 10, bottom: 70, width: 360 };
const leftOuter = getNavigationEdgeMotion(navRect, 21, 40);
const leftInner = getNavigationEdgeMotion(navRect, 65, 40);
const rightOuter = getNavigationEdgeMotion(navRect, 379, 40);
assert.equal(leftOuter.direction, -1);
assert.equal(rightOuter.direction, 1);
assert.ok(Math.abs(leftOuter.velocity) > Math.abs(leftInner.velocity));
assert.equal(getNavigationEdgeMotion(navRect, 200, 100).direction, 0);
assert.equal(clampNavigationScroll(0, -100, 900, 360), 0);
assert.equal(clampNavigationScroll(540, 100, 900, 360), 540);

assert.ok(mapPageScrollDelta(-0.1) > 0, 'The corrected mapping reverses the previous page-scroll direction.');
assert.ok(mapPageScrollDelta(0.1) < 0);
assert.ok(mapWaveAmplitude(0.5, -0.1) > 0.5, 'Wave amplitude mapping must remain unchanged.');
assert.ok(mapWaveAmplitude(0.5, 0.1) < 0.5);

const attraction = computeAttractionSteering(0.5, 0.1, 1.65, 1, 0.4);
assert.ok(Math.hypot(attraction.accelerationX, attraction.accelerationY) > 0.12, 'Attraction must be visibly stronger than autonomous drift.');
const nearAttraction = computeAttractionSteering(0.03, 0, 1.65, 1, 0.4);
assert.ok(Math.abs(nearAttraction.accelerationX) < Math.abs(attraction.accelerationX), 'Arrival should slow near the fingertip.');

const pointingHand: TrackedHand = {
  id: 1,
  gesture: 'pointing',
  landmarks: landmarks.map((point, index) => index === 8 ? { x: 0.73, y: 0.26, z: 0 } : point),
  handedness: 'Right',
  confidence: 0.98,
  timestamp: 1,
  lostOpacity: 1,
};
const pointerController = new GestureInteractionController(new GestureFrameStore());
pointerController.update({ hands: [pointingHand], twoHandsPresent: false, timestamp: 1 }, 0, true);
const pointerState = pointerController.update({ hands: [pointingHand], twoHandsPresent: false, timestamp: 2 }, 301, true);
assert.deepEqual(pointerState.pointer?.point, pointingHand.landmarks[8], 'Attraction and dwell must share landmark #8.');

const rangeSource = readFileSync('src/components/RangeControl.tsx', 'utf8');
const stylesSource = readFileSync('src/styles.css', 'utf8');
const appSource = readFileSync('src/App.tsx', 'utf8');
const effectsSource = readFileSync('src/gesture/GestureEffectsOverlay.tsx', 'utf8');
const samplingSource = readFileSync('src/labs/SamplingLab.tsx', 'utf8');
assert.ok(!rangeSource.includes('已選取'));
assert.ok(rangeSource.includes('gesture-control-marker'));
assert.ok(rangeSource.includes('手勢已鎖定'));
const selectedRule = stylesSource.match(/\.control\.gesture-control-selected\s*\{([^}]+)\}/)?.[1] ?? '';
assert.ok(!selectedRule.includes('padding'), 'Captured state must not change control height.');
assert.ok(appSource.includes("dwellControllerRef.current.update(undefined, now, false)"));
assert.ok(appSource.includes('data-gesture-scroll'));
assert.ok(effectsSource.includes('if (!enabledRef.current)'));
assert.ok(effectsSource.includes('clearEffects()'), 'Gesture OFF must clear active effect pools.');
assert.ok(samplingSource.includes("'soundspace:gesture-reset'"), 'Gesture OFF must clear Slider capture.');

let starts = 0;
class FakeAudioContext {
  state = 'suspended';
  destination = {};
  createGain() { return { gain: { value: 0 }, connect() {} }; }
  async decodeAudioData() {
    return {
      duration: 0.5,
      length: 8,
      numberOfChannels: 1,
      getChannelData: () => new Float32Array([0, 0.2, -0.4, 0.8, -0.3, 0.1, 0, 0]),
    };
  }
  async resume() { this.state = 'running'; }
  createBufferSource() { return { buffer: null, connect() {}, start() { starts += 1; } }; }
}
const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const originalDocument = globalThis.document;
Object.assign(globalThis, {
  window: { AudioContext: FakeAudioContext },
  document: { baseURI: 'https://example.test/Sound-Space/' },
  fetch: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }),
});
const sound = new InteractionSoundPlayer();
const firstPreload = sound.preload();
assert.equal(sound.preload(), firstPreload, 'Preload must be cached and not fetch repeatedly.');
await firstPreload;
assert.equal(sound.hasCachedBuffer('explosion'), true);
await sound.warm();
await sound.play('explosion');
assert.equal(starts, 1, 'A warmed cached explosion should start without another fetch/decode.');
let warnings = 0;
const originalWarn = console.warn;
console.warn = () => { warnings += 1; };
globalThis.fetch = async () => { throw new Error('offline'); };
const unavailableSound = new InteractionSoundPlayer();
await unavailableSound.preload();
assert.equal(await unavailableSound.play('explosion'), null, 'Missing audio must not reject or block the visual event.');
await unavailableSound.preload();
assert.equal(warnings, 1, 'Audio failure must not spam warnings.');
console.warn = originalWarn;
globalThis.fetch = originalFetch;
globalThis.window = originalWindow;
globalThis.document = originalDocument;

console.log('Gesture polish verification passed: hand-shaped wake, stable capture, reversed page scroll, attraction, bounded explosion, cached SFX, and navigation edge motion.');
