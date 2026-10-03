import {
  DEFAULT_SOUND_SPIRIT_PHENOTYPE,
  createSoundSpiritInteractionRecorder,
  createSoundSpiritPhenotype,
  generateSoundSpiritPhenotype,
  resolveSoundSpiritGenome,
  type SoundSpiritGenome,
} from '../src/spirit/soundSpiritIdentity';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const empty = createSoundSpiritInteractionRecorder();
assert(createSoundSpiritPhenotype(empty.snapshot()) === DEFAULT_SOUND_SPIRIT_PHENOTYPE, 'Empty history must return the exact default object.');
assert(!Object.keys(empty).some((key) => /music|play|seek|volume/i.test(key)), 'Music Lab must have no history-writing API.');

const highEnergy = createSoundSpiritInteractionRecorder();
highEnergy.observeAmplitude(0.5, 0.94);
const highEnergyGenome = resolveSoundSpiritGenome(highEnergy.snapshot());
assert(highEnergyGenome.energy > 0.7, 'High amplitude exploration must produce high energy.');
assert(generateSoundSpiritPhenotype(highEnergyGenome).heartScale > 1.05, 'High energy must enlarge the heart.');

const highFrequency = createSoundSpiritInteractionRecorder();
highFrequency.observeFrequency(440, 3600);
const highFrequencyGenome = resolveSoundSpiritGenome(highFrequency.snapshot());
assert(highFrequencyGenome.frequency > 0.75, 'Frequency must use perceptual logarithmic mapping.');
assert(generateSoundSpiritPhenotype(highFrequencyGenome).wingSpan > 1.05, 'High frequency must elongate the wings.');

const broad = createSoundSpiritInteractionRecorder();
broad.observeAmplitude(0.2, 0.9);
broad.observeFrequency(160, 3600);
broad.observeWaveform('sine', 'square');
broad.observeWaveform('square', 'triangle');
broad.observeSampleRate(8000, 96000);
broad.observeBitDepth(8, 32);
broad.observeChannels(1, 2);
broad.observeSamplingCombination(96000, 32, 2);
const broadGenome = resolveSoundSpiritGenome(broad.snapshot());
assert(broadGenome.diversity > 0.65, 'Cross-feature exploration must create diversity.');
assert(broadGenome.precision > 0.75, 'High sample rate and bit depth must create precision.');
assert(broadGenome.interactionDepth > highEnergyGenome.interactionDepth, 'Breadth must enrich depth.');
const broadPhenotype = generateSoundSpiritPhenotype(broadGenome);
assert(broadPhenotype.veinExtra > 0 && broadPhenotype.energyPathExtra > 0, 'High breadth and precision must add structural detail.');

const frozenPhenotype = JSON.stringify(broadPhenotype);
broad.observeFrequency(3600, 180);
broad.observeAmplitude(0.9, 0.15);
assert(JSON.stringify(broadPhenotype) === frozenPhenotype, 'Later interactions must not morph an existing phenotype snapshot.');
assert(JSON.stringify(createSoundSpiritPhenotype(broad.snapshot())) !== frozenPhenotype, 'A later explicit generation must use the latest history.');

const spam = createSoundSpiritInteractionRecorder();
for (let index = 0; index < 100; index += 1) spam.observeAmplitude(index % 2 ? 0.2 : 0.8, index % 2 ? 0.8 : 0.2);
const spamGenome = resolveSoundSpiritGenome(spam.snapshot());
assert(spamGenome.interactionDepth < 0.45, 'One continuous slider session must not maximize depth.');

const deterministicGenome: SoundSpiritGenome = { ...broadGenome, seed: 123456 };
assert(
  JSON.stringify(generateSoundSpiritPhenotype(deterministicGenome)) === JSON.stringify(generateSoundSpiritPhenotype(deterministicGenome)),
  'A stable genome seed must generate a stable phenotype.',
);

console.log('Sound Spirit identity checks passed.');
