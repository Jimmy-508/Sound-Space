import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AUDIO_ONSET_REFRACTORY_MS,
  createAudioOnsetDetectorState,
  detectAudioOnset,
  type AudioOnsetInput,
} from '../src/music/audioOnsetDetector';

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

const detectorSource = readFileSync('src/music/audioOnsetDetector.ts', 'utf8');
const controllerSource = readFileSync('src/music/useMusicAudioController.ts', 'utf8');
const rendererSource = readFileSync('src/visualization/WaveCanvas.tsx', 'utf8');
const musicSource = readFileSync('src/labs/MusicLab.tsx', 'utf8');
assert.ok(!detectorSource.includes('Math.random'), 'Musical onset timing must contain no random source.');
assert.ok(!detectorSource.includes('personality'), 'Personality must not shift onset timestamps.');
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

console.log('Audio-locked Heart verification passed: adaptive transient timing, strength, refractory control, frequency-aware expression, and autoplay fallback.');
