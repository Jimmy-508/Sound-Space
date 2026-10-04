import { readFileSync } from 'node:fs';
import {
  DEFAULT_SOUND_SPIRIT_PHENOTYPE,
  DEFAULT_SOUND_SPIRIT_GENOME,
  SOUND_SPIRIT_SPECIES_GUARDRAILS,
  createSoundSpiritInteractionRecorder,
  createSoundSpiritPhenotype,
  generateSoundSpiritPhenotype,
  resolveSoundSpiritGenome,
  type SoundSpiritGenome,
  type SoundSpiritPhenotypeConfig,
} from '../src/spirit/soundSpiritIdentity';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function deepEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function populateBroadHistory() {
  const recorder = createSoundSpiritInteractionRecorder();
  recorder.observeAmplitude(0.12, 0.92);
  recorder.snapshot();
  recorder.observeFrequency(160, 3600);
  recorder.snapshot();
  recorder.observeWaveform('sine', 'square');
  recorder.observeWaveform('square', 'triangle');
  recorder.observeSampleRate(8000, 96000);
  recorder.snapshot();
  recorder.observeBitDepth(8, 32);
  recorder.snapshot();
  recorder.observeChannels(1, 2);
  recorder.observeSamplingCombination(96000, 32, 2);
  return recorder;
}

const goldenBaseline: SoundSpiritPhenotypeConfig = {
  key: 'default', isDefault: true, seed: 1,
  energy: 0.5, frequency: 0.5, diversity: 0.5, precision: 0.5, interactionDepth: 0,
  bodyFullness: 1, bodyLength: 1, bodyAsymmetry: 0,
  wingSpan: 1, wingHeight: 1, wingSweep: 1, wingCurvature: 0, wingAsymmetry: 0,
  membraneOpacity: 1, membraneLayerExtra: 0, veinExtra: 0, veinOpacity: 1, rimOpacity: 1,
  heartScale: 1, heartVariation: 0, heartGlow: 1,
  energyOpacity: 1, energyPathExtra: 0, energyRouting: 0,
  particleRichness: 1, iridescence: 1, glowIntensity: 1,
  primaryColor: 0x6ee7ff, secondaryColor: 0xa48bff, accentColor: 0xffcf86, energyColor: 0xffb968,
  primaryHue: 199, secondaryHue: 249, accentHue: 292,
};

const empty = createSoundSpiritInteractionRecorder();
const defaultGenome = resolveSoundSpiritGenome(empty.snapshot());
assert(!defaultGenome.hasHistory, 'No meaningful history must resolve to the Default Genome.');
assert(defaultGenome === DEFAULT_SOUND_SPIRIT_GENOME, 'No meaningful history must return the canonical Default Genome object.');
assert(createSoundSpiritPhenotype(empty.snapshot()) === DEFAULT_SOUND_SPIRIT_PHENOTYPE, 'Empty history must return the exact shared default object.');
assert(deepEqual(DEFAULT_SOUND_SPIRIT_PHENOTYPE, goldenBaseline), 'Default phenotype parameters must exactly match the Golden baseline.');
assert(generateSoundSpiritPhenotype(defaultGenome) === DEFAULT_SOUND_SPIRIT_PHENOTYPE, 'Default Genome must preserve object identity with the Golden phenotype.');

const sameA = populateBroadHistory();
const sameB = populateBroadHistory();
const genomeA = resolveSoundSpiritGenome(sameA.snapshot());
const genomeB = resolveSoundSpiritGenome(sameB.snapshot());
assert(deepEqual(genomeA, genomeB), 'The same ordered history must produce the same genome.');
assert(deepEqual(generateSoundSpiritPhenotype(genomeA), generateSoundSpiritPhenotype(genomeA)), 'The same genome must produce the same phenotype.');

const orderedA = createSoundSpiritInteractionRecorder();
orderedA.observeWaveform('sine', 'square');
orderedA.observeChannels(1, 2);
const orderedB = createSoundSpiritInteractionRecorder();
orderedB.observeChannels(1, 2);
orderedB.observeWaveform('sine', 'square');
const orderedGenomeA = resolveSoundSpiritGenome(orderedA.snapshot());
const orderedGenomeB = resolveSoundSpiritGenome(orderedB.snapshot());
assert(orderedGenomeA.seed !== orderedGenomeB.seed, 'Meaningful event order must participate in the deterministic seed.');
assert(orderedGenomeA.diversity === orderedGenomeB.diversity, 'Event order must personalize detail without changing equivalent aggregate genes.');

const highEnergy = createSoundSpiritInteractionRecorder();
highEnergy.observeAmplitude(0.08, 0.96);
const highEnergyGenome = resolveSoundSpiritGenome(highEnergy.snapshot());
assert(highEnergyGenome.energy > 0.7, 'Broad amplitude exploration must produce a visibly energetic gene.');
assert(generateSoundSpiritPhenotype(highEnergyGenome).heartScale > 1.05, 'High energy must enlarge the Heart within guardrails.');

const highFrequency = createSoundSpiritInteractionRecorder();
highFrequency.observeFrequency(120, 4000);
const highFrequencyGenome = resolveSoundSpiritGenome(highFrequency.snapshot());
assert(highFrequencyGenome.frequency > 0.6, 'Frequency must combine perceptual position, explored range, and regions.');
assert(generateSoundSpiritPhenotype(highFrequencyGenome).wingSpan > 1.03, 'Broad frequency exploration must visibly alter wing proportion.');

const sampling = createSoundSpiritInteractionRecorder();
sampling.observeSampleRate(8000, 96000);
sampling.snapshot();
sampling.observeBitDepth(1, 32);
const samplingGenome = resolveSoundSpiritGenome(sampling.snapshot());
assert(samplingGenome.precision > 0.5, 'Sampling exploration must change the precision gene.');
assert(samplingGenome.interactionDepth > 0, 'Meaningful Sampling exploration must change the genome.');

const broadGenome = resolveSoundSpiritGenome(populateBroadHistory().snapshot());
assert(broadGenome.diversity > 0.65, 'Cross-feature exploration must create diversity.');
assert(broadGenome.interactionDepth > highEnergyGenome.interactionDepth, 'Cross-lab breadth must enrich interaction depth.');
const broadPhenotype = generateSoundSpiritPhenotype(broadGenome);
assert(broadPhenotype.veinExtra > 0 && broadPhenotype.energyPathExtra > 0, 'Broad exploration must add bounded structural detail.');

const frozenRecorder = populateBroadHistory();
const frozenPhenotype = createSoundSpiritPhenotype(frozenRecorder.snapshot());
const frozenSnapshot = JSON.stringify(frozenPhenotype);
frozenRecorder.observeFrequency(3600, 180);
frozenRecorder.observeAmplitude(0.9, 0.15);
assert(JSON.stringify(frozenPhenotype) === frozenSnapshot, 'Later interactions must not morph an existing phenotype snapshot.');
assert(JSON.stringify(createSoundSpiritPhenotype(frozenRecorder.snapshot())) !== frozenSnapshot, 'Only a later explicit birth may use newer history.');

const spam = createSoundSpiritInteractionRecorder();
for (let index = 0; index < 120; index += 1) {
  spam.observeWaveform(index % 2 ? 'square' : 'sine', index % 2 ? 'sine' : 'square');
}
const spamGenome = resolveSoundSpiritGenome(spam.snapshot());
assert(spamGenome.interactionDepth < 0.45, 'Repeated identical transitions must have strong diminishing returns.');

const recorderKeys = Object.keys(empty);
assert(!recorderKeys.some((key) => /music|play|seek|volume|home|settings|gesture/i.test(key)), 'Only lab control APIs may write interaction history.');
for (const source of ['src/labs/MusicLab.tsx', 'src/components/HomeMusicTitles.tsx', 'src/components/SettingsPanel.tsx']) {
  assert(!readFileSync(source, 'utf8').includes('SoundSpiritInteractionRecorder'), `${source} must not receive the DNA recorder.`);
}

const [wingSpanMin, wingSpanMax] = SOUND_SPIRIT_SPECIES_GUARDRAILS.wingSpan;
const [wingHeightMin, wingHeightMax] = SOUND_SPIRIT_SPECIES_GUARDRAILS.wingHeight;
const [bodyFullnessMin, bodyFullnessMax] = SOUND_SPIRIT_SPECIES_GUARDRAILS.bodyFullness;
const [bodyLengthMin, bodyLengthMax] = SOUND_SPIRIT_SPECIES_GUARDRAILS.bodyLength;
const [membraneMin, membraneMax] = SOUND_SPIRIT_SPECIES_GUARDRAILS.membraneOpacity;
const [glowMin, glowMax] = SOUND_SPIRIT_SPECIES_GUARDRAILS.glowIntensity;
const [asymmetryMin, asymmetryMax] = SOUND_SPIRIT_SPECIES_GUARDRAILS.wingAsymmetry;

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
    const phenotype = generateSoundSpiritPhenotype(genome);
    assert(Object.values(phenotype).every((entry) => typeof entry !== 'number' || Number.isFinite(entry)), 'Phenotype must contain no NaN or Infinity.');
    assert(phenotype.wingSpan >= wingSpanMin && phenotype.wingSpan <= wingSpanMax, 'Wing span must remain bounded.');
    assert(phenotype.wingHeight >= wingHeightMin && phenotype.wingHeight <= wingHeightMax, 'Wing height must remain bounded.');
    assert(phenotype.bodyFullness >= bodyFullnessMin && phenotype.bodyFullness <= bodyFullnessMax, 'Body fullness must remain bounded.');
    assert(phenotype.bodyLength >= bodyLengthMin && phenotype.bodyLength <= bodyLengthMax, 'Body length must preserve the Holy Cross silhouette.');
    assert(phenotype.wingAsymmetry >= asymmetryMin && phenotype.wingAsymmetry <= asymmetryMax, 'Controlled asymmetry must remain subtle.');
    assert(phenotype.membraneOpacity >= membraneMin && phenotype.membraneOpacity <= membraneMax, 'Membrane opacity must remain bounded.');
    assert(phenotype.glowIntensity >= glowMin && phenotype.glowIntensity <= glowMax, 'Internal glow must remain bounded.');
    assert(phenotype.veinExtra >= 0 && phenotype.veinExtra <= 2, 'Membrane detail density must remain bounded.');
  }
}

assert(SOUND_SPIRIT_SPECIES_GUARDRAILS.wingCount === 2, 'The species must always retain two wings.');
assert(SOUND_SPIRIT_SPECIES_GUARDRAILS.wingRootX === 0.145, 'Wing roots must stay at the Golden upper-body position.');
assert(SOUND_SPIRIT_SPECIES_GUARDRAILS.heartPresent, 'The Heart must always be present.');
assert(SOUND_SPIRIT_SPECIES_GUARDRAILS.heartLobeCount === 5, 'The Heart must retain its five-lobed structure.');

console.log('Living Genome and Sound Spirit species guardrail checks passed.');
