import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MUSICAL_HEART_ATTACK_SECONDS,
  advanceBeatMapClock,
  createBeatMapClockState,
  resetBeatMapClock,
  sampleHeartContractionEnvelope,
} from '../src/music/beatMapClock';

const beats = Float32Array.from([0.5, 1, 1.5, 2.1, 2.6]);
const state = createBeatMapClockState();
resetBeatMapClock(state, beats, 0.4);
let frame = advanceBeatMapClock(state, beats, 0.454, true);
assert.equal(frame.pulse, null, 'Heart attack must not begin before its look-ahead window.');
frame = advanceBeatMapClock(state, beats, 0.456, true);
assert.ok(frame.pulse, 'Heart attack must begin before the Beat Map timestamp.');
assert.ok(Math.abs(frame.pulse!.attackTime - (0.5 - MUSICAL_HEART_ATTACK_SECONDS)) < 1e-6, 'Beat look-ahead must equal the Heart attack duration.');
assert.equal(sampleHeartContractionEnvelope(0), 0, 'Contraction begins from rest.');
assert.equal(sampleHeartContractionEnvelope(MUSICAL_HEART_ATTACK_SECONDS), 1, 'Maximum contraction must land at the Beat Map timestamp.');

const delivered: number[] = [frame.pulse!.beatTime];
for (let time = 0.46; time <= 2.8; time += 1 / 60) {
  const next = advanceBeatMapClock(state, beats, time, true);
  if (next.pulse) delivered.push(next.pulse.beatTime);
}
assert.deepEqual(delivered.map((time) => Number(time.toFixed(2))), Array.from(beats, (time) => Number(time.toFixed(2))), 'Repeated beats must remain phase-locked without drift.');

resetBeatMapClock(state, beats, 0.47);
assert.equal(state.nextIndex, 1, 'A near-beat reset with insufficient attack lead must skip that beat.');
resetBeatMapClock(state, beats, 1.7);
assert.equal(state.nextIndex, 3, 'Forward seek must find the next future beat by binary search.');
resetBeatMapClock(state, beats, 0.7);
assert.equal(state.nextIndex, 1, 'Backward seek must reacquire the correct future beat.');
assert.equal(advanceBeatMapClock(state, beats, 1, true, true).pulse, null, 'Scrubbing must suspend Heart events.');

const controllerSource = readFileSync('src/music/useMusicAudioController.ts', 'utf8');
const rendererSource = readFileSync('src/visualization/WaveCanvas.tsx', 'utf8');
assert.ok(controllerSource.includes('audio.currentTime'), 'The imported-song playback clock must remain authoritative.');
assert.ok(controllerSource.includes('resetBeatMapClock') && controllerSource.includes('advanceBeatMapClock'), 'Play, resume, and seek must share the Beat Map clock.');
assert.ok(!controllerSource.includes('target.beatToken += 1'), 'The real-time analyser must not emit a competing major Heart pulse.');
assert.ok(rendererSource.includes('triggerBioelectricHeartPulse'), 'Musical and autonomous timing must feed one biological pulse implementation.');
for (const delay of ['beatAge - 0.045', 'beatAge - 0.09', 'beatAge - 0.145']) {
  assert.ok(rendererSource.includes(delay), `${delay} must preserve outward Heart-to-root-to-vein-to-rim conduction.`);
}
assert.ok(rendererSource.indexOf('rootBeatPulse') < rendererSource.indexOf('veinBeatPulse') && rendererSource.indexOf('veinBeatPulse') < rendererSource.indexOf('rimBeatPulse'), 'Major propagation must follow Heart, roots, veins, then rim.');
assert.ok(rendererSource.includes('nextAutonomousBeatAt') && rendererSource.includes('autonomousHeartInterval'), 'No-song, pause, end, and map gaps must retain autonomous Heart pulses.');
assert.ok(rendererSource.includes("lastBioelectricSource = musical ? 'musical' : 'autonomous'"), 'Musical and autonomous clocks must remain observable through the same pulse generator.');
assert.ok(rendererSource.includes('pendingVeilAt') && rendererSource.includes('pendingRibbonAt') && rendererSource.includes('pendingMoteAt'), 'One Heart event must schedule bounded downstream bioelectric effects.');

console.log('Beat-mapped Heart verification passed: look-ahead phase lock, seek arbitration, one generator, conduction delays, and autonomous life.');
