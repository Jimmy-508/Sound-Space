import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createSoundSpiritInteractionRecorder,
  resolveSoundSpiritBirth,
  type SoundSpiritGenome,
} from '../src/spirit/soundSpiritIdentity';
import {
  DEFAULT_SOUND_SPIRIT_PERSONALITY,
  PERSONALITY_GUARDRAILS,
  generateSoundSpiritPersonality,
  personalityDistance,
  type SoundSpiritPersonality,
} from '../src/spirit/soundSpiritPersonality';

function amplitudeHistory() {
  const recorder = createSoundSpiritInteractionRecorder();
  recorder.observeAmplitude(0.08, 0.96);
  return recorder;
}

function frequencyHistory() {
  const recorder = createSoundSpiritInteractionRecorder();
  recorder.observeFrequency(120, 4000);
  return recorder;
}

function precisionHistory() {
  const recorder = createSoundSpiritInteractionRecorder();
  recorder.observeSampleRate(8000, 96000);
  recorder.snapshot();
  recorder.observeBitDepth(2, 32);
  recorder.observeChannels(1, 2);
  return recorder;
}

function diverseHistory() {
  const recorder = createSoundSpiritInteractionRecorder();
  recorder.observeWaveform('sine', 'square');
  recorder.observeWaveform('square', 'triangle');
  recorder.observeAmplitude(0.14, 0.88);
  recorder.snapshot();
  recorder.observeFrequency(180, 3200);
  recorder.observeSamplingCombination(48000, 24, 2);
  return recorder;
}

const empty = createSoundSpiritInteractionRecorder();
const defaultBirth = resolveSoundSpiritBirth(empty.snapshot());
assert.equal(defaultBirth.personality, DEFAULT_SOUND_SPIRIT_PERSONALITY, 'No history must use the canonical personality object.');
for (const [name, value] of Object.entries(DEFAULT_SOUND_SPIRIT_PERSONALITY)) {
  if (name === 'key' || name === 'isDefault' || ['vitality', 'curiosity', 'caution', 'grace', 'rhythmAffinity', 'independence'].includes(name)) continue;
  assert.equal(value, 1, `Default ${name} must be exactly neutral.`);
}

const sameA = resolveSoundSpiritBirth(diverseHistory().snapshot());
const sameB = resolveSoundSpiritBirth(diverseHistory().snapshot());
assert.deepEqual(sameA.personality, sameB.personality, 'The same ordered history must produce the same personality.');
assert.ok(Object.isFrozen(sameA) && Object.isFrozen(sameA.personality), 'Birth and personality must be immutable.');

const representatives = [amplitudeHistory(), frequencyHistory(), precisionHistory(), diverseHistory()]
  .map((recorder) => resolveSoundSpiritBirth(recorder.snapshot()).personality);
assert.ok(new Set(representatives.map((personality) => personality.key)).size === representatives.length, 'Representative histories need distinct personalities.');
assert.ok(representatives.some((personality) => personalityDistance(personality, DEFAULT_SOUND_SPIRIT_PERSONALITY) > 0.035), 'Natural histories must create observable behavioral separation.');

const frozenRecorder = diverseHistory();
const firstBirth = resolveSoundSpiritBirth(frozenRecorder.snapshot());
const frozenPersonality = JSON.stringify(firstBirth.personality);
frozenRecorder.observeAmplitude(0.95, 0.08);
frozenRecorder.observeFrequency(3800, 140);
assert.equal(JSON.stringify(firstBirth.personality), frozenPersonality, 'The living personality must not morph after birth.');
const nextBirth = resolveSoundSpiritBirth(frozenRecorder.snapshot());
assert.notEqual(nextBirth.personality.key, firstBirth.personality.key, 'The next birth may consume meaningful new history.');
assert.deepEqual(resolveSoundSpiritBirth(frozenRecorder.snapshot()), nextBirth, 'A repeated birth without new history must be deterministic.');

const dimensionNames = ['vitality', 'curiosity', 'caution', 'grace', 'rhythmAffinity', 'independence'] as const;
const multiplierNames = Object.keys(PERSONALITY_GUARDRAILS).filter((name) => name !== 'dimension') as Array<Exclude<keyof typeof PERSONALITY_GUARDRAILS, 'dimension'>>;
for (let seed = 1; seed <= 32; seed += 1) {
  for (let mask = 0; mask < 32; mask += 1) {
    const genome: SoundSpiritGenome = {
      hasHistory: true,
      energy: mask & 1 ? 1 : 0,
      frequency: mask & 2 ? 1 : 0,
      diversity: mask & 4 ? 1 : 0,
      precision: mask & 8 ? 1 : 0,
      interactionDepth: mask & 16 ? 1 : 0,
      seed,
    };
    const personality = generateSoundSpiritPersonality(genome);
    assert.ok(Object.values(personality).every((value) => typeof value !== 'number' || Number.isFinite(value)), 'Personality must contain no NaN or Infinity.');
    dimensionNames.forEach((name) => assertInRange(personality[name], PERSONALITY_GUARDRAILS.dimension, name));
    multiplierNames.forEach((name) => assertInRange(personality[name], PERSONALITY_GUARDRAILS[name], name));
    const prominentTraits = dimensionNames.filter((name) => Math.abs(personality[name] - 0.5) > 0.105);
    assert.ok(prominentTraits.length <= 3, 'Trait budget must keep non-signature dimensions near neutral.');
  }
}

const personalitySource = readFileSync('src/spirit/soundSpiritPersonality.ts', 'utf8');
const rendererSource = readFileSync('src/visualization/WaveCanvas.tsx', 'utf8');
const appSource = readFileSync('src/App.tsx', 'utf8');
const musicSource = readFileSync('src/labs/MusicLab.tsx', 'utf8');
assert.ok(!personalitySource.includes('Math.random'), 'Personality resolution must use seeded variation only.');
for (const multiplier of ['idleSpeed', 'wanderRadius', 'turnResponsiveness', 'pathCurvature', 'attractionStrength', 'sweepResponse', 'explosionResponse', 'wingRate', 'rhythmResponse', 'followThrough']) {
  assert.ok(rendererSource.includes(`personality.${multiplier}`), `${multiplier} must parameterize the Golden renderer.`);
}
assert.ok(appSource.includes('setSpiritPersonality(birth.personality)'), 'A successful import must commit personality from the same birth snapshot.');
assert.ok(!musicSource.includes('SoundSpiritInteractionRecorder'), 'Music interactions must continue to write zero DNA history.');

console.log('Living Personality verification passed: deterministic births, bounded traits, stable lives, and parameterized Golden motion.');

function assertInRange(value: number, range: readonly [number, number], name: string) {
  assert.ok(value >= range[0] && value <= range[1], `${name} must remain inside species-safe guardrails.`);
}

