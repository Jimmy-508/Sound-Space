import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ALIVE_SOUND_SPIRIT_BIRTH_FRAME,
  SOUND_SPIRIT_BIRTH_DURATION_SECONDS,
  getSoundSpiritBirthFrame,
  isSoundSpiritBirthInteractionLocked,
} from '../src/spirit/soundSpiritBirth';
import {
  createLocalSpiritPreviewBirth,
  createSoundSpiritInteractionRecorder,
  resolveSoundSpiritBirth,
} from '../src/spirit/soundSpiritIdentity';

const expectedStates = ['UNBORN', 'HEART', 'FORMING', 'UNFOLDING', 'AWAKENING', 'ALIVE'];
const observedStates = [0, 0.8, 1.7, 2.7, 3.6, SOUND_SPIRIT_BIRTH_DURATION_SECONDS]
  .map((time) => getSoundSpiritBirthFrame(time).state);
assert.deepEqual(observedStates, expectedStates, 'Birth must follow the approved state order.');
assert.equal(SOUND_SPIRIT_BIRTH_DURATION_SECONDS, 4, 'Birth must remain inside the approved 3.5-4.2 second window.');
assert.equal(getSoundSpiritBirthFrame(-1).state, 'UNBORN', 'Negative elapsed time must clamp to the unborn state.');
assert.equal(getSoundSpiritBirthFrame(20), ALIVE_SOUND_SPIRIT_BIRTH_FRAME, 'Completed births must reuse the immutable alive frame.');
assert.ok(Object.isFrozen(ALIVE_SOUND_SPIRIT_BIRTH_FRAME), 'The shared alive frame must be immutable.');

const revealKeys = [
  'progress',
  'heartReveal',
  'bodyReveal',
  'crownReveal',
  'energyReveal',
  'wingRootReveal',
  'wingVeinReveal',
  'wingMembraneReveal',
  'wingRimReveal',
  'awakening',
  'livingMotion',
] as const;
const spectacleKeys = ['convergence', 'focusGlow', 'lightAbsorption', 'externalLight', 'centralAccumulation', 'formationFront', 'overexposure', 'revealEnergy'] as const;
let previous = getSoundSpiritBirthFrame(0);
for (let step = 1; step <= 400; step += 1) {
  const frame = getSoundSpiritBirthFrame(step / 100);
  revealKeys.forEach((key) => {
    assert.ok(frame[key] >= previous[key], `${key} must never reverse during birth.`);
    assert.ok(Number.isFinite(frame[key]) && frame[key] >= 0 && frame[key] <= 1, `${key} must remain normalized.`);
  });
  previous = frame;
}
for (let step = 0; step < 400; step += 1) {
  const frame = getSoundSpiritBirthFrame(step / 100);
  spectacleKeys.forEach((key) => assert.ok(frame[key] >= 0 && frame[key] <= 1, `${key} must remain bounded.`));
}
spectacleKeys.forEach((key) => assert.equal(ALIVE_SOUND_SPIRIT_BIRTH_FRAME[key], 0, `${key} must terminate at ALIVE.`));
assert.ok(getSoundSpiritBirthFrame(0.6).convergence > 0.4, 'Screen-scale light must visibly converge before biological formation.');
assert.ok(getSoundSpiritBirthFrame(3.64).overexposure > 0.95, 'Completed biological structure must create a brief organism-only luminosity peak.');
assert.ok(getSoundSpiritBirthFrame(3.48).overexposure < 0.01 && getSoundSpiritBirthFrame(3.8).overexposure < 0.01, 'Final luminosity must remain tightly bounded near 150ms.');
assert.equal(getSoundSpiritBirthFrame(0.6).heartReveal, 0, 'Early convergence must begin without a readable organism.');
assert.ok(getSoundSpiritBirthFrame(1.0).heartReveal > 0, 'The five-lobed Heart must be the first biological system.');
assert.equal(getSoundSpiritBirthFrame(1.0).bodyReveal, 0, 'The body must not precede the Heart.');
assert.ok(getSoundSpiritBirthFrame(1.7).externalLight > 0.8 && getSoundSpiritBirthFrame(1.7).bodyReveal > 0, 'External light must overlap early body formation.');
assert.ok(getSoundSpiritBirthFrame(1.7).formationFront > 0, 'Body condensation must follow a luminous spatial front.');
assert.ok(getSoundSpiritBirthFrame(2.25).wingRootReveal > getSoundSpiritBirthFrame(2.25).wingVeinReveal, 'Wing roots must stabilize before major veins.');
assert.ok(getSoundSpiritBirthFrame(2.65).wingVeinReveal > 0.45 && getSoundSpiritBirthFrame(2.65).wingMembraneReveal === 0, 'Wing light architecture must remain readable before membrane condensation.');
assert.ok(getSoundSpiritBirthFrame(3.0).wingRimReveal < getSoundSpiritBirthFrame(3.0).wingVeinReveal, 'Outer rim must complete after major veins.');
assert.equal(isSoundSpiritBirthInteractionLocked(0, 0, 0), false, 'A session without a birth token must remain interactive.');
assert.equal(isSoundSpiritBirthInteractionLocked(1, 1000, 1000 + 3999), true, 'Creature interaction must stay locked throughout birth.');
assert.equal(isSoundSpiritBirthInteractionLocked(1, 1000, 1000 + 4000), false, 'Creature interaction must unlock at ALIVE.');

const emptyRecorder = createSoundSpiritInteractionRecorder();
const defaultBirth = resolveSoundSpiritBirth(emptyRecorder.snapshot());
assert.deepEqual(defaultBirth, resolveSoundSpiritBirth(emptyRecorder.snapshot()), 'Default birth identity must remain deterministic.');
for (const preset of ['energy', 'frequency', 'precision', 'diversity', 'depth']) {
  const individualBirth = createLocalSpiritPreviewBirth(preset);
  assert.notEqual(individualBirth.phenotype.key, defaultBirth.phenotype.key, `${preset} birth must retain its resolved phenotype.`);
  assert.deepEqual(individualBirth, createLocalSpiritPreviewBirth(preset), `${preset} birth must remain deterministic through the reveal.`);
}

const birthSource = readFileSync('src/spirit/soundSpiritBirth.ts', 'utf8');
const appSource = readFileSync('src/App.tsx', 'utf8');
const musicSource = readFileSync('src/labs/MusicLab.tsx', 'utf8');
const controllerSource = readFileSync('src/music/useMusicAudioController.ts', 'utf8');
const rendererSource = readFileSync('src/visualization/WaveCanvas.tsx', 'utf8');
assert.ok(!birthSource.includes('Math.random'), 'Birth timing must be deterministic.');
assert.ok(appSource.includes('token: current.token + 1'), 'Each successful import must create a fresh, re-entrant birth token.');
assert.ok(musicSource.includes("setViewMode('spectrum')"), 'A successful birth must navigate to Spectrum.');
assert.ok(musicSource.includes('isSoundSpiritBirthInteractionLocked'), 'Music Lab must arbitrate direct interaction during birth.');
assert.ok(!musicSource.includes('音樂賦予牠生命。'), 'Birth must communicate without explanatory text.');
assert.ok(!musicSource.includes('SoundSpiritInteractionRecorder'), 'Music and birth must write zero DNA history.');
const decodeIndex = controllerSource.indexOf('await context.decodeAudioData');
const replaceIndex = controllerSource.indexOf('onReplaceFile(file)');
const successIndex = controllerSource.indexOf('onSuccessfulLoad()');
assert.ok(decodeIndex >= 0 && decodeIndex < replaceIndex && replaceIndex < successIndex, 'The active session and creature may change only after decoding succeeds.');
assert.ok(controllerSource.indexOf('setError(unsupportedAudioMessage)', successIndex) > successIndex, 'Decode failure must remain contained after the success path.');
assert.equal((birthSource.match(/requestAnimationFrame/g) ?? []).length, 0, 'Birth must not create an animation loop.');
assert.equal((birthSource.match(/Geometry/g) ?? []).length, 0, 'Birth must not allocate geometry.');
assert.equal((rendererSource.match(/requestAnimationFrame\(animate\)/g) ?? []).length, 1, 'The renderer must keep one master animation loop.');
for (const uniform of ['uBirthReveal', 'uBirthCrown', 'uBirthWing']) {
  assert.ok(rendererSource.includes(uniform), `${uniform} must reuse the existing Golden renderer materials.`);
}
for (const effect of ['birthEffects', 'birthAura', 'birthLightGroup', 'birthCore', 'uBirthFront', 'uBirthOverexposure']) {
  assert.ok(rendererSource.includes(effect), `${effect} must participate in the bounded spectacle.`);
}
for (const rejectedEffect of ['birthFlashMaterial', 'birthRingGeometry', 'birthStreaks']) {
  assert.ok(!rendererSource.includes(rejectedEffect), `${rejectedEffect} must not retain the summon/reveal visual language.`);
}
assert.ok(rendererSource.includes('CatmullRomCurve3'), 'Environmental light must follow curved gravitational paths.');
assert.ok(rendererSource.includes('birthLightPathCount = compact ? 12 : 18'), 'Birth must use screen-filling compact and desktop path counts.');
assert.ok(rendererSource.includes("new THREE.ShaderMaterial") && rendererSource.includes('pathSide'), 'Birth paths must be luminous ribbons with shader-controlled halo and core width.');
assert.ok(rendererSource.includes('uHead') && rendererSource.includes('tail') && rendererSource.includes('head'), 'Birth ribbons must communicate outside-to-center motion with moving heads and fading tails.');
assert.ok(!rendererSource.includes('birthPathMaterials: THREE.LineBasicMaterial'), 'Birth must not fall back to single-pixel LineBasicMaterial paths.');

console.log('Sound Spirit Birth verification passed: deterministic state flow, transactional import, interaction arbitration, and single-loop rendering.');
