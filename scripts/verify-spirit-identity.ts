import { readFileSync } from 'node:fs';
import {
  DEFAULT_SOUND_SPIRIT_PHENOTYPE,
  DEFAULT_SOUND_SPIRIT_GENOME,
  SOUND_SPIRIT_SPECIES_GUARDRAILS,
  createSoundSpiritInteractionRecorder,
  createSoundSpiritPhenotype,
  generateSoundSpiritPhenotype,
  phenotypeVisualDistance,
  resolveSoundSpiritBirth,
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
  crownHeight: 1, crownWidth: 1, crownEarHeight: 1, crownEarWidth: 1, crownEarAngle: 0, crownTipRoundness: 0, crownNotchDepth: 0, crownShoulderCurve: 1,
  wingSpan: 1, wingHeight: 1, wingPose: 0, wingFullness: 1, wingSweep: 1, wingCurvature: 0, wingScallop: 0, wingInnerContour: 0, wingAsymmetry: 0,
  membraneOpacity: 1, membraneLayerExtra: 0, veinExtra: 0, veinFan: 0, veinBranch: 0, veinOpacity: 1, rimOpacity: 1,
  heartScale: 1, heartVariation: 0, heartLobeWidths: [1, 1, 1, 1, 1], heartLobeLengths: [1, 1, 1, 1, 1],
  heartCoreScale: 1, heartPulse: 1, heartGlow: 1,
  energyOpacity: 1, energyPathExtra: 0, energyRouting: 0, energyRoutePhase: 0, energyPathEmphasis: 1,
  particleRichness: 1, iridescence: 1, glowIntensity: 1,
  bodyOuterColor: 0x7bd7e8, bodyInnerColor: 0xd8fbff,
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

const alternateSeedPhenotype = generateSoundSpiritPhenotype({ ...genomeA, seed: genomeA.seed ^ 0x51f15e });
const phenotypeA = generateSoundSpiritPhenotype(genomeA);
assert(
  alternateSeedPhenotype.primaryColor !== phenotypeA.primaryColor
    || alternateSeedPhenotype.secondaryColor !== phenotypeA.secondaryColor,
  'A different seed must be able to produce a different continuous palette.',
);
assert(
  alternateSeedPhenotype.bodyOuterColor !== phenotypeA.bodyOuterColor
    || alternateSeedPhenotype.bodyInnerColor !== phenotypeA.bodyInnerColor,
  'A different seed must be able to produce a different deterministic body tint.',
);
assert(
  generateSoundSpiritPhenotype(genomeA).bodyOuterColor === phenotypeA.bodyOuterColor
    && generateSoundSpiritPhenotype(genomeA).bodyInnerColor === phenotypeA.bodyInnerColor,
  'The same Genome and Seed must reproduce the same body tint.',
);

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
assert(highFrequencyGenome.energy === 0.5, 'Unexplored amplitude must remain neutral.');
assert(highFrequencyGenome.precision === 0.5, 'Unexplored sampling controls must remain neutral.');
assert(generateSoundSpiritPhenotype(highFrequencyGenome).wingSpan > 1.03, 'Broad frequency exploration must visibly alter wing proportion.');

const sampling = createSoundSpiritInteractionRecorder();
sampling.observeSampleRate(8000, 96000);
sampling.snapshot();
sampling.observeBitDepth(1, 32);
const samplingGenome = resolveSoundSpiritGenome(sampling.snapshot());
assert(samplingGenome.precision > 0.5, 'Sampling exploration must change the precision gene.');
assert(samplingGenome.energy === 0.5, 'Unexplored amplitude must remain neutral.');
assert(samplingGenome.frequency === 0.5, 'Unexplored frequency must remain neutral.');
assert(samplingGenome.interactionDepth > 0, 'Meaningful Sampling exploration must change the genome.');

const diversityRecorder = createSoundSpiritInteractionRecorder();
diversityRecorder.observeWaveform('sine', 'square');
diversityRecorder.observeWaveform('square', 'triangle');
diversityRecorder.observeAmplitude(0.18, 0.82);
diversityRecorder.snapshot();
diversityRecorder.observeFrequency(180, 2800);
const diversityGenome = resolveSoundSpiritGenome(diversityRecorder.snapshot());

const broadGenome = resolveSoundSpiritGenome(populateBroadHistory().snapshot());
assert(broadGenome.diversity > 0.65, 'Cross-feature exploration must create diversity.');
assert(broadGenome.interactionDepth > highEnergyGenome.interactionDepth, 'Cross-lab breadth must enrich interaction depth.');
const broadPhenotype = generateSoundSpiritPhenotype(broadGenome);
assert(
  broadPhenotype.veinExtra + broadPhenotype.energyPathExtra + broadPhenotype.membraneLayerExtra > 0
    || Math.abs(broadPhenotype.energyRouting) > 0.025,
  'Broad exploration must add bounded structural detail without maximizing every effect.',
);

const representativePhenotypes = [highEnergyGenome, highFrequencyGenome, samplingGenome, diversityGenome, broadGenome]
  .map(generateSoundSpiritPhenotype);
assert(
  representativePhenotypes.some((phenotype) => rgbDistance(phenotype.bodyOuterColor, DEFAULT_SOUND_SPIRIT_PHENOTYPE.bodyOuterColor) > 0.12),
  'Naturally generated individuals must be able to show a clearly different overall body tint.',
);
assert(
  new Set(representativePhenotypes.map((phenotype) => `${phenotype.bodyOuterColor}:${phenotype.bodyInnerColor}`)).size >= 4,
  'Different valid histories must produce varied deterministic body palettes.',
);
representativePhenotypes.forEach((phenotype) => {
  assert(phenotypeVisualDistance(phenotype, DEFAULT_SOUND_SPIRIT_PHENOTYPE) >= 0.24, 'Every meaningful representative history must meet minimum visual separation.');
});
for (let left = 0; left < representativePhenotypes.length; left += 1) {
  for (let right = left + 1; right < representativePhenotypes.length; right += 1) {
    assert(phenotypeVisualDistance(representativePhenotypes[left], representativePhenotypes[right]) >= 0.1, 'Representative histories must not collapse into the same phenotype.');
  }
}
const farIdentitySignatures = new Set(representativePhenotypes.map((phenotype) => [
  phenotype.crownHeight, phenotype.crownWidth, phenotype.crownEarHeight, phenotype.crownNotchDepth,
  phenotype.wingPose, phenotype.wingSpan, phenotype.wingHeight, phenotype.wingFullness,
].map((value) => value.toFixed(3)).join(':')));
assert(farIdentitySignatures.size === representativePhenotypes.length, 'Representative histories must retain distinct non-color crown and wing identities.');

const frozenRecorder = populateBroadHistory();
const firstBirth = resolveSoundSpiritBirth(frozenRecorder.snapshot());
const frozenPhenotype = firstBirth.phenotype;
const frozenSnapshot = JSON.stringify(frozenPhenotype);
frozenRecorder.observeFrequency(3600, 180);
frozenRecorder.observeAmplitude(0.9, 0.15);
assert(JSON.stringify(frozenPhenotype) === frozenSnapshot, 'Later interactions must not morph an existing phenotype snapshot.');
const secondBirth = resolveSoundSpiritBirth(frozenRecorder.snapshot());
assert(JSON.stringify(secondBirth.phenotype) !== frozenSnapshot, 'A later successful import must resolve the latest accumulated history.');
assert(secondBirth.genome.seed !== firstBirth.genome.seed, 'Intervening meaningful Wave interactions must change the next birth seed.');
const unchangedBirth = resolveSoundSpiritBirth(frozenRecorder.snapshot());
assert(deepEqual(unchangedBirth, secondBirth), 'Re-importing unchanged history must remain deterministic.');
assert(Object.isFrozen(secondBirth) && Object.isFrozen(secondBirth.genome), 'Birth must be an immutable stable snapshot.');

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
const [crownHeightMin, crownHeightMax] = SOUND_SPIRIT_SPECIES_GUARDRAILS.crownHeight;
const [crownWidthMin, crownWidthMax] = SOUND_SPIRIT_SPECIES_GUARDRAILS.crownWidth;
const [wingPoseMin, wingPoseMax] = SOUND_SPIRIT_SPECIES_GUARDRAILS.wingPose;
const [wingFullnessMin, wingFullnessMax] = SOUND_SPIRIT_SPECIES_GUARDRAILS.wingFullness;
const rendererSource = readFileSync('src/visualization/WaveCanvas.tsx', 'utf8');
const appSource = readFileSync('src/App.tsx', 'utf8');
const musicControllerSource = readFileSync('src/music/useMusicAudioController.ts', 'utf8');
const identitySource = readFileSync('src/spirit/soundSpiritIdentity.ts', 'utf8');
assert(rendererSource.includes('addWingSurface(mainGeometry, 0xb9f5ff'), 'The main shell membrane must remain icy white for every phenotype.');
assert(rendererSource.includes('createMasterSpiritMaterial(phenotype.bodyOuterColor'), 'The rendered body shell must receive its phenotype tint.');
assert(DEFAULT_SOUND_SPIRIT_PHENOTYPE.bodyOuterColor === 0x7bd7e8 && DEFAULT_SOUND_SPIRIT_PHENOTYPE.bodyInnerColor === 0xd8fbff, 'Default body materials must retain the exact Golden colors.');
assert(appSource.includes('resolveSoundSpiritBirth(spiritInteractionRef.current.snapshot())'), 'Every successful import must read the current accumulated DNA history.');
assert(musicControllerSource.indexOf('await context.decodeAudioData') < musicControllerSource.indexOf('onSuccessfulLoad(CINEMATIC_BIRTH_DELAY_MS)'), 'Birth must occur only after successful audio decode.');
assert(!identitySource.includes('Math.random'), 'Genome and phenotype resolution must remain fully seeded and deterministic.');

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
    assert(phenotype.wingPose >= wingPoseMin && phenotype.wingPose <= wingPoseMax, 'Wing pose must remain elegant and bounded.');
    assert(phenotype.wingFullness >= wingFullnessMin && phenotype.wingFullness <= wingFullnessMax, 'Wing membrane fullness must remain bounded.');
    assert(phenotype.crownHeight >= crownHeightMin && phenotype.crownHeight <= crownHeightMax, 'Twin-ear crown height must remain bounded.');
    assert(phenotype.crownWidth >= crownWidthMin && phenotype.crownWidth <= crownWidthMax, 'Twin-ear crown width must remain bounded.');
    assert(phenotype.crownEarHeight >= 0.86 && phenotype.crownEarHeight <= 1.18, 'Twin-ear crown must retain bounded biological tips.');
    assert(phenotype.crownEarWidth >= 0.86 && phenotype.crownEarWidth <= 1.16, 'Twin-ear width must remain within the species language.');
    assert(phenotype.crownEarAngle >= -0.12 && phenotype.crownEarAngle <= 0.12, 'Twin-ear opening angle must remain bounded.');
    assert(phenotype.crownTipRoundness >= -0.18 && phenotype.crownTipRoundness <= 0.18, 'Crown tips must remain soft rather than horn-like.');
    assert(phenotype.crownNotchDepth >= -0.012 && phenotype.crownNotchDepth <= 0.018, 'Central crown notch must remain shallow and organic.');
    assert(phenotype.bodyFullness >= bodyFullnessMin && phenotype.bodyFullness <= bodyFullnessMax, 'Body fullness must remain bounded.');
    assert(phenotype.bodyLength >= bodyLengthMin && phenotype.bodyLength <= bodyLengthMax, 'Body length must preserve the Holy Cross silhouette.');
    assert(phenotype.wingAsymmetry >= asymmetryMin && phenotype.wingAsymmetry <= asymmetryMax, 'Controlled asymmetry must remain subtle.');
    assert(phenotype.membraneOpacity >= membraneMin && phenotype.membraneOpacity <= membraneMax, 'Membrane opacity must remain bounded.');
    assert(phenotype.glowIntensity >= glowMin && phenotype.glowIntensity <= glowMax, 'Internal glow must remain bounded.');
    assert(phenotype.veinExtra >= 0 && phenotype.veinExtra <= 2, 'Membrane detail density must remain bounded.');
    assert(phenotype.wingScallop >= -0.055 && phenotype.wingScallop <= 0.055, 'Wing scalloping must remain organic and bounded.');
    assert(phenotype.veinFan >= -0.16 && phenotype.veinFan <= 0.16, 'Vein topology must remain bounded.');
    assert(phenotype.heartLobeWidths.length === 5 && phenotype.heartLobeLengths.length === 5, 'Heart must retain five deterministic lobe proportions.');
    assert([...phenotype.heartLobeWidths, ...phenotype.heartLobeLengths].every((value) => value >= 0.82 && value <= 1.18), 'Heart lobe variation must remain bounded.');
    for (const color of [phenotype.primaryColor, phenotype.secondaryColor, phenotype.accentColor, phenotype.energyColor]) {
      assert(Number.isInteger(color) && color >= 0 && color <= 0xffffff, 'Palette colors must be valid finite RGB values.');
      assert(colorBrightness(color) > 0.38, 'Individual energy colors must remain luminous rather than dark blobs.');
    }
    for (const color of [phenotype.bodyOuterColor, phenotype.bodyInnerColor]) {
      assert(Number.isInteger(color) && color >= 0 && color <= 0xffffff, 'Body colors must be valid finite RGB values.');
      assert(colorBrightness(color) > 0.58, 'Body tints must remain luminous and pearl-like.');
    }
    assert(rgbDistance(phenotype.primaryColor, 0xd8fbff) > 0.16, 'Individual energy color must remain readable against the icy shell.');
  }
}

assert(SOUND_SPIRIT_SPECIES_GUARDRAILS.wingCount === 2, 'The species must always retain two wings.');
assert(SOUND_SPIRIT_SPECIES_GUARDRAILS.wingRootX === 0.145, 'Wing roots must stay at the Golden upper-body position.');
assert(SOUND_SPIRIT_SPECIES_GUARDRAILS.heartPresent, 'The Heart must always be present.');
assert(SOUND_SPIRIT_SPECIES_GUARDRAILS.heartLobeCount === 5, 'The Heart must retain its five-lobed structure.');

console.log('Living Genome and Sound Spirit species guardrail checks passed.');

function colorBrightness(color: number) {
  const red = (color >> 16) & 0xff;
  const green = (color >> 8) & 0xff;
  const blue = color & 0xff;
  return (red * 0.2126 + green * 0.7152 + blue * 0.0722) / 255;
}

function rgbDistance(left: number, right: number) {
  const red = ((left >> 16) & 0xff) - ((right >> 16) & 0xff);
  const green = ((left >> 8) & 0xff) - ((right >> 8) & 0xff);
  const blue = (left & 0xff) - (right & 0xff);
  return Math.hypot(red, green, blue) / 441.67;
}
