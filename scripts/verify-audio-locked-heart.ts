import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AUDIO_ONSET_REFRACTORY_MS,
  createAudioOnsetDetectorState,
  detectAudioOnset,
  type AudioOnsetInput,
} from '../src/music/audioOnsetDetector';
import {
  createMajorBeatGateState,
  gateMajorBeat,
  MAJOR_BEAT_RECOVERY_MS,
} from '../src/music/majorBeatGate';

const silence: AudioOnsetInput = { bass: 0, mid: 0, treble: 0, spectralFlux: 0, playing: true };
const quiet: AudioOnsetInput = { bass: 0.025, mid: 0.018, treble: 0.012, spectralFlux: 0.0004, playing: true };
const strong: AudioOnsetInput = { bass: 0.92, mid: 0.58, treble: 0.32, spectralFlux: 0.12, playing: true };
const weak: AudioOnsetInput = { bass: 0.27, mid: 0.2, treble: 0.13, spectralFlux: 0.026, playing: true };

function run(sequence: AudioOnsetInput[], stepMs = 32) {
  const state = createAudioOnsetDetectorState();
  return sequence.flatMap((input, index) => {
    const event = detectAudioOnset(state, input, index * stepMs);
    return event.detected ? [{ ...event, at: index * stepMs }] : [];
  });
}

assert.equal(run(Array.from({ length: 80 }, () => silence)).length, 0, 'Silence must not create musical beats.');
const isolated = run([...Array.from({ length: 12 }, () => quiet), strong, ...Array.from({ length: 24 }, () => quiet)]);
assert.equal(isolated.length, 1, 'An isolated transient must create exactly one onset.');

const repeatedSequence = Array.from({ length: 72 }, (_, index) => index >= 12 && (index - 12) % 12 === 0 ? strong : quiet);
const repeated = run(repeatedSequence);
assert.equal(repeated.length, 5, 'Evenly spaced transients must create matching onset events.');

const alternatingSequence = Array.from({ length: 60 }, () => quiet);
alternatingSequence[10] = strong;
alternatingSequence[22] = weak;
alternatingSequence[34] = strong;
alternatingSequence[46] = weak;
const alternating = run(alternatingSequence);
assert.equal(alternating.length, 4, 'Alternating strong and weak transients must all remain detectable.');
assert.ok(alternating[0].strength > alternating[1].strength, 'Onset strength must preserve strong/weak ordering.');
assert.ok(alternating[0].lowStrength > alternating[0].highStrength, 'Kick-heavy input must emphasize deep contraction.');

const sustained = run([
  ...Array.from({ length: 12 }, () => quiet),
  ...Array.from({ length: 80 }, () => ({ ...strong, spectralFlux: 0 })),
]);
assert.ok(sustained.length <= 1, 'A sustained loud tone must not fire continuously.');

const closeEvents = Array.from({ length: 40 }, () => quiet);
closeEvents[10] = strong;
closeEvents[14] = strong;
closeEvents[18] = strong;
const refractory = run(closeEvents);
assert.equal(refractory.length, 2, 'The detector must reject an event inside refractory and accept one outside it.');
assert.ok(refractory[1].at - refractory[0].at >= AUDIO_ONSET_REFRACTORY_MS, 'Accepted events must respect refractory timing.');
assert.deepEqual(run(alternatingSequence), run(alternatingSequence), 'Onset detection must be deterministic.');

const noOnset = { detected: false, strength: 0, lowStrength: 0, highStrength: 0 };
const gentleOnset = { detected: true, strength: 0.105, lowStrength: 0.075, highStrength: 0.09 };
const weakOnset = { detected: true, strength: 0.12, lowStrength: 0.09, highStrength: 0.12 };
const moderateLocalPeak = { detected: true, strength: 0.18, lowStrength: 0.14, highStrength: 0.16 };
const majorOnset = { detected: true, strength: 0.34, lowStrength: 0.3, highStrength: 0.26 };

function energyFor(event: typeof majorOnset | undefined) {
  if (!event) return 0.025;
  if (event.strength >= 0.3) return 0.22;
  if (event.strength >= 0.17) return 0.12;
  if (event.strength >= 0.115) return 0.055;
  return 0.035;
}

function runMajor(events: Map<number, typeof majorOnset>, durationMs: number, stepMs = 32) {
  const state = createMajorBeatGateState();
  const accepted: Array<{ at: number; strength: number; confidence: number }> = [];
  for (let now = 0; now <= durationMs; now += stepMs) {
    const onset = events.get(now);
    const event = gateMajorBeat(state, onset ?? noOnset, energyFor(onset), now, true);
    if (event.detected) accepted.push({ at: now, strength: event.strength, confidence: event.confidence });
  }
  return { accepted, confidence: state.confidence };
}

assert.equal(runMajor(new Map(), 1600).accepted.length, 0, 'Silence must create no Major Beat.');
assert.equal(runMajor(new Map([[320, gentleOnset], [832, gentleOnset]]), 1400).accepted.length, 0, 'Gentle events must leave the biological Heart autonomous.');
const strongPulse = runMajor(new Map([[320, majorOnset], [832, majorOnset], [1344, majorOnset], [1856, majorOnset]]), 2200);
assert.equal(strongPulse.accepted.length, 4, 'Strong evenly spaced bass transients must produce readable Major Beats.');
assert.ok(strongPulse.accepted.at(-1)!.confidence > strongPulse.accepted[0].confidence, 'Repeated strong pulse must raise musical confidence.');
assert.equal(strongPulse.accepted[0].at, 320, 'The first strong beat must pass without prior confidence or BPM support.');
const localPeakSequence = runMajor(new Map([[320, gentleOnset], [640, gentleOnset], [960, moderateLocalPeak]]), 1300);
assert.deepEqual(localPeakSequence.accepted.map(({ at }) => at), [960], 'A moderate-amplitude event must pass when it is a strong local peak.');
const strongWithWeak = runMajor(new Map([[320, majorOnset], [640, weakOnset], [832, majorOnset], [1152, weakOnset], [1344, majorOnset]]), 1700);
assert.deepEqual(strongWithWeak.accepted.map(({ at }) => at), [320, 832, 1344], 'Weak intermediate transients must not cause full contractions.');
const denseWeak = new Map<number, typeof majorOnset>();
for (let at = 320; at < 1800; at += 192) denseWeak.set(at, weakOnset);
assert.equal(runMajor(denseWeak, 2100).accepted.length, 0, 'Dense weak percussion must not machine-gun the Heart.');
const alternatingMajor = runMajor(new Map([[320, majorOnset], [640, weakOnset], [960, majorOnset], [1280, weakOnset], [1600, majorOnset]]), 1900);
assert.deepEqual(alternatingMajor.accepted.map(({ at }) => at), [320, 960, 1600], 'Strong/weak accents must preserve only the major pulse.');
const confidenceState = createMajorBeatGateState();
[320, 832, 1344].forEach((at) => gateMajorBeat(confidenceState, majorOnset, 0.22, at, true));
const capturedConfidence = confidenceState.confidence;
for (let now = 1376; now <= 6200; now += 32) gateMajorBeat(confidenceState, noOnset, 0.08, now, true);
assert.ok(capturedConfidence > 0.45 && confidenceState.confidence < 0.16, 'Musical confidence must rise with pulse and decay after it stops.');
const gentleThenStrong = runMajor(new Map([[320, gentleOnset], [640, gentleOnset], [960, majorOnset], [1472, majorOnset], [1984, majorOnset]]), 2250);
assert.deepEqual(gentleThenStrong.accepted.map(({ at }) => at), [960, 1472, 1984], 'A gentle section must transition naturally into music capture.');
assert.equal(runMajor(new Map([[320, majorOnset]]), 2200).accepted.length, 1, 'A sustained signal must not invent repeated Major Beats.');
const irregular = runMajor(new Map([[320, majorOnset], [736, majorOnset], [1312, majorOnset], [1696, majorOnset]]), 2000);
assert.equal(irregular.accepted.length, 4, 'Prominent expressive events must not be forced onto a rigid BPM grid.');
assert.ok(irregular.accepted.every((event, index, list) => index === 0 || event.at - list[index - 1].at >= MAJOR_BEAT_RECOVERY_MS), 'Major Beats must respect biological recovery.');
assert.deepEqual(runMajor(new Map([[320, majorOnset], [832, majorOnset]]), 1200), runMajor(new Map([[320, majorOnset], [832, majorOnset]]), 1200), 'Major Beat gating must be deterministic.');

const detectorSource = readFileSync('src/music/audioOnsetDetector.ts', 'utf8');
const majorGateSource = readFileSync('src/music/majorBeatGate.ts', 'utf8');
const controllerSource = readFileSync('src/music/useMusicAudioController.ts', 'utf8');
const rendererSource = readFileSync('src/visualization/WaveCanvas.tsx', 'utf8');
const musicSource = readFileSync('src/labs/MusicLab.tsx', 'utf8');
assert.ok(!detectorSource.includes('Math.random'), 'Musical onset timing must contain no random source.');
assert.ok(!detectorSource.includes('personality'), 'Personality must not shift onset timestamps.');
assert.ok(!majorGateSource.includes('personality'), 'Rhythm Affinity must not alter Major Beat timestamps.');
assert.ok(controllerSource.includes('gateMajorBeat'), 'Raw onset analysis must pass through the Major Beat Gate before Heart contraction.');
assert.ok(controllerSource.includes('target.onsetToken += 1') && controllerSource.includes('target.beatToken += 1'), 'Minor onset and full Heart events must remain separate signals.');
assert.ok(rendererSource.includes('audioVisual.beatToken !== observedAudioBeatToken'), 'The renderer must consume the analyser onset token directly.');
assert.ok(rendererSource.includes('personality.rhythmResponse'), 'Rhythm Affinity must remain an expression multiplier.');
assert.ok(rendererSource.includes('0.022'), 'Five-lobe propagation must remain within one short biological event.');
assert.ok(musicSource.includes('musicVisualStateRef={controller.visualStateRef}'), 'Music Lab must pass the live analyser ref without React timing delay.');
const decodeIndex = controllerSource.indexOf('await context.decodeAudioData');
const successIndex = controllerSource.indexOf('onSuccessfulLoad()');
const autoPlayIndex = controllerSource.indexOf('await audio.play()', successIndex);
assert.ok(decodeIndex >= 0 && decodeIndex < successIndex && successIndex < autoPlayIndex, 'Successful decode must start Birth and make one bounded autoplay attempt.');
const autoPlayCatch = controllerSource.indexOf('setPlaying(false)', autoPlayIndex);
assert.ok(autoPlayCatch > autoPlayIndex, 'Autoplay rejection must preserve the session and leave manual Play available.');

console.log('Audio-locked Heart verification passed: raw onset detail, adaptive Major Beat gating, confidence decay, biological recovery, and autoplay fallback.');
