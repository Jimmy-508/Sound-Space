import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { InteractionSoundPlayer } from '../src/audio/interactionSound';
import { createBlueTearSeeds, createPointerTearSeeds, createWavefrontTearSeeds, clampEffectCount, gestureEffectLimits } from '../src/gesture/gestureEffectsModel';
import { mapWaveAmplitude } from '../src/gesture/gestureMappings';
import { createCompactHandRenderPoints } from '../src/gesture/gestureRenderModel';
import { GestureInteractionController, gestureThresholds } from '../src/gesture/interactionController';
import { clampNavigationScroll, getNavigationEdgeMotion, mapPageScrollDelta } from '../src/gesture/navigationGesture';
import { GestureFrameStore, type GesturePoint, type TrackedHand } from '../src/gesture/types';
import { computeAttractionSteering, computeWavefrontInfluence } from '../src/visualization/repulsor';
import { WorldInteractionController } from '../src/interaction/worldInteraction';

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
assert.ok(fastSeeds.length <= 58);
let randomStep = 0;
const spreadSeeds = createBlueTearSeeds({
  landmarks,
  previousLandmarks,
  velocityX: 1.42,
  velocityY: -0.35,
  speed: 1.46,
  turnIntensity: 0.72,
}, () => [0.12, 0.88, 0.04, 0.96, 0.24, 0.76][randomStep++ % 6]);
assert.ok(Math.max(...spreadSeeds.map((seed) => Math.abs(seed.y - landmarks[seed.sourceIndex].y))) > 0.035, 'Wake field must extend beyond the compact skeleton.');
assert.ok(spreadSeeds.every((seed) => seed.size < 2), 'Blue Tears stay tiny even when the disturbance field is broad.');
const bounded = Array.from({ length: 520 }, (_, index) => index);
clampEffectCount(bounded, gestureEffectLimits.blueTears);
assert.equal(bounded.length, gestureEffectLimits.blueTears);
assert.equal(gestureEffectLimits.blueTears, 520);
assert.equal(gestureEffectLimits.waterRipples, 52);
assert.equal(gestureEffectLimits.wavefrontSpecksPerBurst, 84);
assert.equal(gestureEffectLimits.explosionBursts, 3);
const wavefrontSeeds = createWavefrontTearSeeds(100, 80, 64, 12, () => 0.5);
assert.equal(wavefrontSeeds.length, 12);
assert.ok(wavefrontSeeds.every((seed) => Math.hypot(seed.x - 100, seed.y - 80) >= 60), 'Explosion motes must originate at the wavefront, not the center.');
assert.ok(wavefrontSeeds.every((seed) => seed.size < 2));
const pointerSeeds = createPointerTearSeeds({
  point: { x: 0.58, y: 0.42, z: 0 },
  previousPoint: { x: 0.5, y: 0.46, z: 0 },
  velocityX: 0.8,
  velocityY: -0.4,
  speed: 0.9,
  turnIntensity: 0.4,
}, () => 0.75);
assert.ok(pointerSeeds.length > 0);
assert.ok(pointerSeeds.every((seed) => seed.size < 2), 'Pointer disturbance must retain micro-organism scale.');
assert.equal(createPointerTearSeeds({ point: landmarks[0], previousPoint: landmarks[0], velocityX: 0, velocityY: 0, speed: 0, turnIntensity: 0 }).length, 0);

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
assert.equal(computeWavefrontInfluence(0.4, 0.1, 0.06), 0, 'The Spirit must not react before the pressure wave arrives.');
assert.equal(computeWavefrontInfluence(0.4, 0.4, 0.06), 1);
assert.equal(computeWavefrontInfluence(0.4, 0.7, 0.06), 0, 'The pressure impulse ends after the wavefront passes.');

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
const landmarkSnapshot = structuredClone(pointingHand.landmarks);
const compactPoints = createCompactHandRenderPoints(pointingHand.landmarks);
assert.deepEqual(pointingHand.landmarks, landmarkSnapshot, 'Visual compaction must never mutate recognition landmarks.');
const span = (points: readonly GesturePoint[]) => Math.max(...points.map((point) => point.x)) - Math.min(...points.map((point) => point.x));
const withoutIndexTip = (points: readonly GesturePoint[]) => points.filter((_, index) => ![6, 7, 8].includes(index));
assert.ok(span(withoutIndexTip(compactPoints)) < span(withoutIndexTip(pointingHand.landmarks)) * 0.9, 'Rendered hand should stay compact outside the compensated index tip.');
assert.deepEqual(pointerState.pointer?.point, { x: 0.73, y: 0.26, z: 0 }, 'The star cursor stays on the true index fingertip.');
assert.deepEqual(compactPoints[8], pointingHand.landmarks[8], 'Compact index rendering must converge on true landmark #8.');
const mobilePoints = createCompactHandRenderPoints(pointingHand.landmarks, 0.7);
assert.deepEqual(mobilePoints[8], pointingHand.landmarks[8], 'Mobile visual scale must not move the interaction fingertip.');
const palmDistance = (points: readonly GesturePoint[], index: number) => Math.hypot(points[index].x - points[9].x, points[index].y - points[9].y);
assert.ok(palmDistance(mobilePoints, 20) < palmDistance(compactPoints, 20) * 0.75, 'Non-index mobile skeleton must use the 70% visual treatment.');

const gestureHand = (gesture: TrackedHand['gesture'], timestamp: number): TrackedHand => ({
  id: 7,
  gesture,
  landmarks,
  handedness: 'Right',
  confidence: 0.98,
  timestamp,
  lostOpacity: 1,
});
const countExplosions = (steps: Array<{ gesture: TrackedHand['gesture'] | 'lost'; now: number }>) => {
  const controller = new GestureInteractionController(new GestureFrameStore());
  let explosions = 0;
  controller.subscribe((event) => { if (event.type === 'explosion') explosions += 1; });
  steps.forEach((step) => controller.update({ hands: step.gesture === 'lost' ? [] : [gestureHand(step.gesture, step.now)], twoHandsPresent: false, timestamp: step.now + 1 }, step.now, true));
  return explosions;
};
assert.equal(countExplosions([
  { gesture: 'openPalm', now: 0 },
  { gesture: 'openPalm', now: gestureThresholds.openArmStableMs + 1 },
  { gesture: 'fist', now: 300 },
  { gesture: 'fist', now: 300 + gestureThresholds.fistChargeStableMs + 1 },
  { gesture: 'openPalm', now: 500 },
  { gesture: 'openPalm', now: 1600 },
]), 1, 'Stable Open -> stable Fist -> rapid Open emits exactly once.');
assert.equal(countExplosions([{ gesture: 'fist', now: 0 }, { gesture: 'fist', now: 140 }, { gesture: 'openPalm', now: 200 }]), 0);
assert.equal(countExplosions([{ gesture: 'pointing', now: 0 }, { gesture: 'fist', now: 100 }, { gesture: 'openPalm', now: 220 }]), 0);
assert.equal(countExplosions([
  { gesture: 'openPalm', now: 0 }, { gesture: 'openPalm', now: 230 },
  { gesture: 'fist', now: 300 }, { gesture: 'fist', now: 430 },
  { gesture: 'openPalm', now: 1000 },
]), 0, 'A slow release after the charge window must not explode.');
assert.equal(countExplosions([{ gesture: 'openPalm', now: 0 }, { gesture: 'openPalm', now: 230 }, { gesture: 'lost', now: 260 }, { gesture: 'fist', now: 300 }, { gesture: 'openPalm', now: 430 }]), 0);

const world = new WorldInteractionController();
const worldEvents: string[] = [];
world.subscribe((event) => worldEvents.push(`${event.type}:${event.source}`));
assert.equal(world.pulse('gesture', { x: 0.4, y: 0.5, z: 0 }, 1000), true);
assert.equal(world.pulse('mouse', { x: 0.4, y: 0.5, z: 0 }, 1200), false, 'Pulse cooldown must be shared across input sources.');
assert.equal(world.pulse('touch', { x: 0.4, y: 0.5, z: 0 }, 2000), true);
world.setAttraction('gesture', { x: 0.2, y: 0.2, z: 0 }, true, 10);
world.setAttraction('mouse', { x: 0.7, y: 0.6, z: 0 }, true, 20);
assert.equal(world.readAttraction()?.source, 'mouse');
world.clear('mouse');
assert.equal(world.readAttraction()?.source, 'gesture', 'Releasing mouse attraction should fall back to gesture.');
assert.deepEqual(worldEvents, ['pulse:gesture', 'pulse:touch']);

const rangeSource = readFileSync('src/components/RangeControl.tsx', 'utf8');
const stylesSource = readFileSync('src/styles.css', 'utf8');
const appSource = readFileSync('src/App.tsx', 'utf8');
const effectsSource = readFileSync('src/gesture/GestureEffectsOverlay.tsx', 'utf8');
const overlaySource = readFileSync('src/gesture/GestureOverlay.tsx', 'utf8');
const waveCanvasSource = readFileSync('src/visualization/WaveCanvas.tsx', 'utf8');
const samplingSource = readFileSync('src/labs/SamplingLab.tsx', 'utf8');
const renderModelSource = readFileSync('src/gesture/gestureRenderModel.ts', 'utf8');
const starRendererSource = readFileSync('src/interaction/twinklingStarRenderer.ts', 'utf8');
const musicSource = readFileSync('src/labs/MusicLab.tsx', 'utf8');
assert.ok(!rangeSource.includes('已選取'));
assert.ok(!rangeSource.includes('gesture-control-marker'));
assert.ok(!stylesSource.includes('gesture-control-marker'));
assert.ok(rangeSource.includes('手勢已鎖定'));
const selectedRule = stylesSource.match(/\.control\.gesture-control-selected\s*\{([^}]+)\}/)?.[1] ?? '';
assert.ok(!selectedRule.includes('padding'), 'Captured state must not change control height.');
assert.ok(appSource.includes("dwellControllerRef.current.update(undefined, now, false)"));
assert.ok(appSource.includes('data-gesture-scroll'));
assert.ok(effectsSource.includes('clearEffects()'), 'The shared effect pool must clean up on unmount.');
assert.ok(effectsSource.includes('WorldInteractionController'), 'All inputs must share the same effect renderer.');
assert.ok(effectsSource.includes('drawPressureRing'));
assert.ok(effectsSource.includes('for (let ring = 0; ring < 4'));
assert.ok(effectsSource.includes('createWavefrontTearSeeds'));
assert.ok(!effectsSource.includes("rgba(255, 184, 49"), 'Explosion must no longer use golden projectile rays.');
assert.ok(overlaySource.includes('createCompactHandRenderPoints'));
assert.ok(overlaySource.includes('drawTwinklingStarCursor'));
assert.ok(starRendererSource.includes('successPulse'));
assert.ok(starRendererSource.includes('dustCount'));
assert.ok(!overlaySource.includes('palmCore'), 'Palm center calculation remains internal and must not render a decorative dot.');
assert.ok(renderModelSource.includes('getHandPalmCenter'));
assert.ok(stylesSource.includes('pointer-events: none'));
assert.ok(stylesSource.includes('gesture-captured-flow'));
assert.ok(waveCanvasSource.includes("repulsor.type === 'ripple' ? 0"), 'Ripple awareness must remain zero until the ring arrives.');
assert.ok(samplingSource.includes("'soundspace:gesture-reset'"), 'Gesture OFF must clear Slider capture.');
assert.ok(appSource.includes("target.dataset.gestureSelected !== 'true'"));
assert.ok(appSource.includes("interactionSound.play('select')"), 'New capture transitions must play the cached select SFX.');
assert.ok(appSource.includes("'soundspace:file-picker-ready'"));
assert.ok(musicSource.includes('請輕觸以選擇音樂'));
assert.ok(musicSource.includes("worldInteraction.pulse('mouse'"));
assert.ok(musicSource.includes("worldInteraction.pulse('touch'"));
assert.ok(musicSource.includes('worldInteractionThresholds.holdMs'));

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
sound.setEnabled(false);
await sound.play('select');
assert.equal(starts, 1, 'SFX OFF must suppress capture feedback without creating another context.');
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

console.log('Unified world interaction verification passed: aligned compact hands, guarded gesture pulse, shared pointer water, cross-input cooldown, attraction ownership, file readiness, and cached SFX.');
