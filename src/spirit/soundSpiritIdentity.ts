import type { Waveform } from '../types';

export const WAVE_FREQUENCY_MIN = 120;
export const WAVE_FREQUENCY_MAX = 4000;

type ContinuousFeature = 'amplitude' | 'frequency' | 'sampleRate' | 'bitDepth';

interface FeatureSummary {
  minimum: number;
  maximum: number;
  weightedTotal: number;
  weight: number;
  sessions: number;
  regions: Set<number>;
}

interface PendingObservation {
  start: number;
  current: number;
  minimum: number;
  maximum: number;
  startedAt: number;
  lastAt: number;
  timer: ReturnType<typeof setTimeout> | null;
}

export interface SoundSpiritInteractionHistory {
  features: Record<ContinuousFeature, FeatureSummary>;
  waveforms: Set<Waveform>;
  channels: Set<number>;
  samplingCombinations: Set<string>;
  waveformSwitches: number;
  meaningfulSessions: number;
  meaningfulSeconds: number;
  waveExplored: boolean;
  samplingExplored: boolean;
  eventCounts: Map<string, number>;
  orderedEvents: string[];
}

export interface SoundSpiritGenome {
  hasHistory: boolean;
  energy: number;
  frequency: number;
  diversity: number;
  precision: number;
  interactionDepth: number;
  seed: number;
}

export const DEFAULT_SOUND_SPIRIT_GENOME: SoundSpiritGenome = Object.freeze({
  hasHistory: false,
  energy: 0.5,
  frequency: 0.5,
  diversity: 0.5,
  precision: 0.5,
  interactionDepth: 0,
  seed: 1,
});

export interface SoundSpiritPhenotypeConfig {
  key: string;
  isDefault: boolean;
  seed: number;
  energy: number;
  frequency: number;
  diversity: number;
  precision: number;
  interactionDepth: number;
  bodyFullness: number;
  bodyLength: number;
  bodyAsymmetry: number;
  crownHeight: number;
  crownWidth: number;
  crownEarHeight: number;
  crownEarWidth: number;
  crownEarAngle: number;
  crownTipRoundness: number;
  crownNotchDepth: number;
  crownShoulderCurve: number;
  wingSpan: number;
  wingHeight: number;
  wingPose: number;
  wingFullness: number;
  wingSweep: number;
  wingCurvature: number;
  wingScallop: number;
  wingInnerContour: number;
  wingAsymmetry: number;
  membraneOpacity: number;
  membraneLayerExtra: number;
  veinExtra: number;
  veinFan: number;
  veinBranch: number;
  veinOpacity: number;
  rimOpacity: number;
  heartScale: number;
  heartVariation: number;
  heartLobeWidths: readonly [number, number, number, number, number];
  heartLobeLengths: readonly [number, number, number, number, number];
  heartCoreScale: number;
  heartPulse: number;
  heartGlow: number;
  energyOpacity: number;
  energyPathExtra: number;
  energyRouting: number;
  energyRoutePhase: number;
  energyPathEmphasis: number;
  particleRichness: number;
  iridescence: number;
  glowIntensity: number;
  primaryColor: number;
  secondaryColor: number;
  accentColor: number;
  energyColor: number;
  primaryHue: number;
  secondaryHue: number;
  accentHue: number;
}

export const SOUND_SPIRIT_SPECIES_GUARDRAILS = Object.freeze({
  wingCount: 2,
  wingRootX: 0.145,
  heartPresent: true,
  heartLobeCount: 5,
  crownHeight: Object.freeze([0.86, 1.18] as const),
  crownWidth: Object.freeze([0.88, 1.14] as const),
  crownEarHeight: Object.freeze([0.86, 1.18] as const),
  crownEarWidth: Object.freeze([0.86, 1.16] as const),
  crownEarAngle: Object.freeze([-0.12, 0.12] as const),
  crownTipRoundness: Object.freeze([-0.18, 0.18] as const),
  crownNotchDepth: Object.freeze([-0.012, 0.018] as const),
  crownShoulderCurve: Object.freeze([0.88, 1.14] as const),
  wingSpan: Object.freeze([0.84, 1.18] as const),
  wingHeight: Object.freeze([0.86, 1.15] as const),
  wingPose: Object.freeze([-0.14, 0.14] as const),
  wingFullness: Object.freeze([0.88, 1.14] as const),
  wingSweep: Object.freeze([0.92, 1.12] as const),
  wingCurvature: Object.freeze([-0.12, 0.12] as const),
  wingScallop: Object.freeze([-0.055, 0.055] as const),
  wingInnerContour: Object.freeze([-0.05, 0.05] as const),
  wingAsymmetry: Object.freeze([-0.055, 0.055] as const),
  bodyFullness: Object.freeze([0.91, 1.11] as const),
  bodyLength: Object.freeze([0.94, 1.07] as const),
  bodyAsymmetry: Object.freeze([-0.035, 0.035] as const),
  membraneOpacity: Object.freeze([0.88, 1.18] as const),
  veinExtra: Object.freeze([0, 2] as const),
  veinFan: Object.freeze([-0.16, 0.16] as const),
  veinBranch: Object.freeze([-0.14, 0.14] as const),
  veinOpacity: Object.freeze([0.88, 1.35] as const),
  rimOpacity: Object.freeze([0.9, 1.34] as const),
  heartScale: Object.freeze([0.86, 1.2] as const),
  heartVariation: Object.freeze([-0.07, 0.07] as const),
  heartLobeScale: Object.freeze([0.82, 1.18] as const),
  heartCoreScale: Object.freeze([0.88, 1.18] as const),
  heartPulse: Object.freeze([0.84, 1.2] as const),
  heartGlow: Object.freeze([0.82, 1.38] as const),
  energyOpacity: Object.freeze([0.72, 1.48] as const),
  energyRouting: Object.freeze([-0.09, 0.09] as const),
  energyPathEmphasis: Object.freeze([0.82, 1.28] as const),
  particleRichness: Object.freeze([1, 1.42] as const),
  iridescence: Object.freeze([0.9, 1.38] as const),
  glowIntensity: Object.freeze([0.84, 1.34] as const),
});

export interface SoundSpiritInteractionRecorder {
  observeAmplitude: (previous: number, value: number) => void;
  observeFrequency: (previousHz: number, valueHz: number) => void;
  observeWaveform: (previous: Waveform, value: Waveform) => void;
  observeSampleRate: (previous: number, value: number) => void;
  observeBitDepth: (previous: number, value: number) => void;
  observeChannels: (previous: number, value: number) => void;
  observeSamplingCombination: (sampleRate: number, bitDepth: number, channels: number) => void;
  snapshot: () => SoundSpiritInteractionHistory;
  reset: () => void;
}

const DEFAULT_COLORS = {
  primary: 0x6ee7ff,
  secondary: 0xa48bff,
  accent: 0xffcf86,
  energy: 0xffb968,
};

export const DEFAULT_SOUND_SPIRIT_PHENOTYPE: SoundSpiritPhenotypeConfig = Object.freeze({
  key: 'default',
  isDefault: true,
  seed: 1,
  energy: 0.5,
  frequency: 0.5,
  diversity: 0.5,
  precision: 0.5,
  interactionDepth: 0,
  bodyFullness: 1,
  bodyLength: 1,
  bodyAsymmetry: 0,
  crownHeight: 1,
  crownWidth: 1,
  crownEarHeight: 1,
  crownEarWidth: 1,
  crownEarAngle: 0,
  crownTipRoundness: 0,
  crownNotchDepth: 0,
  crownShoulderCurve: 1,
  wingSpan: 1,
  wingHeight: 1,
  wingPose: 0,
  wingFullness: 1,
  wingSweep: 1,
  wingCurvature: 0,
  wingScallop: 0,
  wingInnerContour: 0,
  wingAsymmetry: 0,
  membraneOpacity: 1,
  membraneLayerExtra: 0,
  veinExtra: 0,
  veinFan: 0,
  veinBranch: 0,
  veinOpacity: 1,
  rimOpacity: 1,
  heartScale: 1,
  heartVariation: 0,
  heartLobeWidths: Object.freeze([1, 1, 1, 1, 1] as const),
  heartLobeLengths: Object.freeze([1, 1, 1, 1, 1] as const),
  heartCoreScale: 1,
  heartPulse: 1,
  heartGlow: 1,
  energyOpacity: 1,
  energyPathExtra: 0,
  energyRouting: 0,
  energyRoutePhase: 0,
  energyPathEmphasis: 1,
  particleRichness: 1,
  iridescence: 1,
  glowIntensity: 1,
  primaryColor: DEFAULT_COLORS.primary,
  secondaryColor: DEFAULT_COLORS.secondary,
  accentColor: DEFAULT_COLORS.accent,
  energyColor: DEFAULT_COLORS.energy,
  primaryHue: 199,
  secondaryHue: 249,
  accentHue: 292,
});

const meaningfulDelta: Record<ContinuousFeature, number> = {
  amplitude: 0.055,
  frequency: 0.05,
  sampleRate: 0.12,
  bitDepth: 0.16,
};

export function createSoundSpiritInteractionRecorder(debounceMs = 480): SoundSpiritInteractionRecorder {
  let history = createEmptyHistory();
  const pending = new Map<ContinuousFeature, PendingObservation>();

  const recordOrderedEvent = (token: string) => {
    const repetitions = history.eventCounts.get(token) ?? 0;
    history.eventCounts.set(token, repetitions + 1);
    if (history.orderedEvents.length < 128) history.orderedEvents.push(token);
    return 1 / Math.pow(repetitions + 1, 1.35);
  };

  const commit = (feature: ContinuousFeature) => {
    const observation = pending.get(feature);
    if (!observation) return;
    if (observation.timer) clearTimeout(observation.timer);
    pending.delete(feature);
    const range = observation.maximum - observation.minimum;
    const delta = Math.abs(observation.current - observation.start);
    if (Math.max(range, delta) < meaningfulDelta[feature]) return;

    const summary = history.features[feature];
    const startRegion = regionOf(observation.start);
    const endRegion = regionOf(observation.current);
    const lowRegion = regionOf(observation.minimum);
    const highRegion = regionOf(observation.maximum);
    for (let region = lowRegion; region <= highRegion; region += 1) summary.regions.add(region);
    const noveltyWeight = recordOrderedEvent(`${feature}:${startRegion}>${endRegion}:${lowRegion}-${highRegion}`);
    const sessionWeight = 0.35 + Math.min(0.65, range * 1.8 + delta * 0.7);
    summary.minimum = Math.min(summary.minimum, observation.minimum);
    summary.maximum = Math.max(summary.maximum, observation.maximum);
    summary.weightedTotal += ((observation.minimum + observation.maximum) * 0.5) * sessionWeight * noveltyWeight;
    summary.weight += sessionWeight * noveltyWeight;
    summary.sessions += noveltyWeight;
    history.meaningfulSessions += noveltyWeight;
    history.meaningfulSeconds += Math.min(2.5, Math.max(0.18, (observation.lastAt - observation.startedAt) / 1000)) * noveltyWeight;
    if (feature === 'amplitude' || feature === 'frequency') history.waveExplored = true;
    else history.samplingExplored = true;
  };

  const observe = (feature: ContinuousFeature, previous: number, value: number) => {
    const now = performance.now();
    let observation = pending.get(feature);
    if (observation && now - observation.lastAt > debounceMs * 1.6) {
      commit(feature);
      observation = undefined;
    }
    if (!observation) {
      observation = {
        start: clamp01(previous),
        current: clamp01(value),
        minimum: Math.min(clamp01(previous), clamp01(value)),
        maximum: Math.max(clamp01(previous), clamp01(value)),
        startedAt: now,
        lastAt: now,
        timer: null,
      };
      pending.set(feature, observation);
    } else {
      observation.current = clamp01(value);
      observation.minimum = Math.min(observation.minimum, clamp01(value));
      observation.maximum = Math.max(observation.maximum, clamp01(value));
      observation.lastAt = now;
    }
    if (observation.timer) clearTimeout(observation.timer);
    observation.timer = setTimeout(() => commit(feature), debounceMs);
  };

  const meaningfulChoice = (lab: 'wave' | 'sampling', token: string) => {
    const noveltyWeight = recordOrderedEvent(token);
    history.meaningfulSessions += noveltyWeight;
    history.meaningfulSeconds += 0.22 * noveltyWeight;
    if (lab === 'wave') history.waveExplored = true;
    else history.samplingExplored = true;
  };

  return {
    observeAmplitude: (previous, value) => observe('amplitude', previous, value),
    observeFrequency: (previousHz, valueHz) => observe('frequency', normalizeFrequency(previousHz), normalizeFrequency(valueHz)),
    observeWaveform: (previous, value) => {
      if (previous === value) return;
      history.waveforms.add(previous);
      history.waveforms.add(value);
      history.waveformSwitches += 1;
      meaningfulChoice('wave', `waveform:${previous}>${value}`);
    },
    observeSampleRate: (previous, value) => observe('sampleRate', normalizeSampleRate(previous), normalizeSampleRate(value)),
    observeBitDepth: (previous, value) => observe('bitDepth', normalizeBitDepth(previous), normalizeBitDepth(value)),
    observeChannels: (previous, value) => {
      if (previous === value) return;
      history.channels.add(previous);
      history.channels.add(value);
      meaningfulChoice('sampling', `channels:${previous}>${value}`);
    },
    observeSamplingCombination: (sampleRate, bitDepth, channels) => {
      const combination = `${sampleRate}:${bitDepth}:${channels}`;
      if (!history.samplingCombinations.has(combination)) recordOrderedEvent(`sampling:${combination}`);
      history.samplingCombinations.add(combination);
    },
    snapshot: () => {
      [...pending.keys()].forEach(commit);
      return cloneHistory(history);
    },
    reset: () => {
      pending.forEach((observation) => observation.timer && clearTimeout(observation.timer));
      pending.clear();
      history = createEmptyHistory();
    },
  };
}

export function resolveSoundSpiritGenome(history: SoundSpiritInteractionHistory): SoundSpiritGenome {
  const meaningful = history.meaningfulSessions;
  if (meaningful === 0) {
    return DEFAULT_SOUND_SPIRIT_GENOME;
  }

  const amplitude = weightedMean(history.features.amplitude, 0.5);
  const frequencyMean = weightedMean(history.features.frequency, 0.5);
  const sampleRate = weightedMean(history.features.sampleRate, 0.5);
  const bitDepth = weightedMean(history.features.bitDepth, 0.5);
  const amplitudeRange = exploredRange(history.features.amplitude);
  const frequencyRange = exploredRange(history.features.frequency);
  const samplingRange = exploredRange(history.features.sampleRate);
  const bitDepthRange = exploredRange(history.features.bitDepth);
  const amplitudeRegions = regionBreadth(history.features.amplitude);
  const frequencyRegions = regionBreadth(history.features.frequency);
  const waveformBreadth = Math.min(1, history.waveforms.size / 3);
  const channelBreadth = Math.min(1, history.channels.size / 2);
  const combinationBreadth = 1 - Math.exp(-history.samplingCombinations.size / 4.2);
  const crossLab = history.waveExplored && history.samplingExplored ? 1 : 0;
  const energy = history.features.amplitude.sessions > 0
    ? clamp01(amplitude * 0.35 + amplitudeRange * 0.4 + amplitudeRegions * 0.2
      + (1 - Math.exp(-history.features.amplitude.sessions / 3)) * 0.05)
    : 0.5;
  const frequency = history.features.frequency.sessions > 0
    ? clamp01(frequencyMean * 0.5 + frequencyRange * 0.28 + frequencyRegions * 0.22)
    : 0.5;
  const diversity = clamp01(
    waveformBreadth * 0.21 + amplitudeRange * 0.14 + frequencyRange * 0.17
    + samplingRange * 0.12 + bitDepthRange * 0.11 + channelBreadth * 0.08
    + combinationBreadth * 0.1 + crossLab * 0.07,
  );
  const precision = history.features.sampleRate.sessions > 0 || history.features.bitDepth.sessions > 0
    ? clamp01(sampleRate * 0.4 + bitDepth * 0.25 + Math.min(1, (samplingRange + bitDepthRange) * 0.8) * 0.35)
    : 0.5;
  const breadth = [
    history.features.amplitude.sessions,
    history.features.frequency.sessions,
    history.waveforms.size > 1 ? 1 : 0,
    history.features.sampleRate.sessions,
    history.features.bitDepth.sessions,
    history.channels.size > 1 ? 1 : 0,
  ].filter(Boolean).length / 6;
  const sessionDepth = 1 - Math.exp(-meaningful / 8);
  const timeDepth = 1 - Math.exp(-history.meaningfulSeconds / 12);
  const interactionDepth = clamp01(sessionDepth * 0.48 + timeDepth * 0.22 + breadth * 0.22 + crossLab * 0.08);
  const signature = stableHistorySignature(history, energy, frequency, diversity, precision, interactionDepth);

  return {
    hasHistory: true,
    energy,
    frequency,
    diversity,
    precision,
    interactionDepth,
    seed: hashText(signature) || 1,
  };
}

export function generateSoundSpiritPhenotype(genome: SoundSpiritGenome): SoundSpiritPhenotypeConfig {
  if (!genome.hasHistory) return DEFAULT_SOUND_SPIRIT_PHENOTYPE;
  const energy = clamp01(genome.energy);
  const frequency = clamp01(genome.frequency);
  const diversity = clamp01(genome.diversity);
  const precision = clamp01(genome.precision);
  const depth = clamp01(genome.interactionDepth);
  const genes = { energy, frequency, diversity, precision, depth };
  const traitPlan = deriveTraitPlan(genes, genome.seed);
  const geometryRandom = seededRandom(genome.seed ^ 0x91e10da5);
  const lobeRandom = seededRandom(genome.seed ^ 0x4f1bbcdc);
  const energyDirection = geneDirection(energy, geometryRandom);
  const frequencyDirection = geneDirection(frequency, geometryRandom);
  const diversityDirection = geneDirection(diversity, geometryRandom);
  const precisionDirection = geneDirection(precision, geometryRandom);
  const depthDirection = geneDirection(depth, geometryRandom);
  const geometryBias = geometryRandom() * 2 - 1;
  const routeBias = geometryRandom() * 2 - 1;
  const crownBias = geometryRandom() * 2 - 1;
  const poseBias = geometryRandom() * 2 - 1;
  const richness = clamp01(depth * 0.42 + diversity * 0.25 + precision * 0.33);
  const palette = deriveIndividualPalette(genes, genome.seed);
  const lobeVariation = 0.055 + traitPlan.diversity * 0.105 + traitPlan.energy * 0.035;
  const heartLobeWidths = createLobeFactors(lobeRandom, lobeVariation, diversityDirection * 0.035);
  const heartLobeLengths = createLobeFactors(lobeRandom, lobeVariation * 1.08, -diversityDirection * 0.025);

  let phenotype: SoundSpiritPhenotypeConfig = {
    key: `personal-${genome.seed}-${roundKey(energy)}-${roundKey(frequency)}-${roundKey(diversity)}-${roundKey(precision)}-${roundKey(depth)}`,
    isDefault: false,
    seed: genome.seed,
    energy,
    frequency,
    diversity,
    precision,
    interactionDepth: depth,
    bodyFullness: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.bodyFullness, 1 + energyDirection * (0.035 + traitPlan.energy * 0.07) + geometryBias * 0.012),
    bodyLength: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.bodyLength, 1 - frequencyDirection * (0.018 + traitPlan.frequency * 0.025) + depthDirection * (0.012 + traitPlan.depth * 0.04)),
    bodyAsymmetry: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.bodyAsymmetry, diversityDirection * (0.008 + traitPlan.diversity * 0.027)),
    crownHeight: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.crownHeight, 1 + crownBias * (0.055 + traitPlan.diversity * 0.07) + energyDirection * traitPlan.energy * 0.025),
    crownWidth: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.crownWidth, 1 - crownBias * (0.04 + traitPlan.frequency * 0.055) + geometryBias * 0.02),
    crownEarHeight: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.crownEarHeight, 1 + crownBias * (0.07 + traitPlan.diversity * 0.055)),
    crownEarWidth: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.crownEarWidth, 1 + geometryBias * (0.055 + traitPlan.frequency * 0.05)),
    crownEarAngle: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.crownEarAngle, poseBias * (0.035 + traitPlan.diversity * 0.075)),
    crownTipRoundness: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.crownTipRoundness, -crownBias * (0.05 + traitPlan.precision * 0.11)),
    crownNotchDepth: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.crownNotchDepth, (crownBias * 0.007 + diversityDirection * traitPlan.diversity * 0.009)),
    crownShoulderCurve: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.crownShoulderCurve, 1 + poseBias * (0.045 + traitPlan.frequency * 0.065)),
    wingSpan: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.wingSpan, 1 + frequencyDirection * (0.06 + traitPlan.frequency * 0.115) + geometryBias * 0.018),
    wingHeight: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.wingHeight, 1 - frequencyDirection * (0.04 + traitPlan.frequency * 0.07) + precisionDirection * traitPlan.precision * 0.045),
    wingPose: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.wingPose, poseBias * (0.045 + traitPlan.frequency * 0.065 + traitPlan.diversity * 0.035)),
    wingFullness: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.wingFullness, 1 + geometryBias * (0.04 + traitPlan.precision * 0.075)),
    wingSweep: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.wingSweep, 1 + frequencyDirection * traitPlan.frequency * 0.045 + diversityDirection * (0.025 + traitPlan.diversity * 0.065) + depthDirection * traitPlan.depth * 0.025),
    wingCurvature: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.wingCurvature, frequencyDirection * (0.025 + traitPlan.frequency * 0.045) + routeBias * (0.025 + traitPlan.diversity * 0.05)),
    wingScallop: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.wingScallop, diversityDirection * (0.014 + traitPlan.diversity * 0.036) + geometryBias * 0.008),
    wingInnerContour: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.wingInnerContour, precisionDirection * traitPlan.precision * 0.025 + routeBias * (0.012 + traitPlan.diversity * 0.02)),
    wingAsymmetry: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.wingAsymmetry, diversityDirection * (0.012 + traitPlan.diversity * 0.04)),
    membraneOpacity: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.membraneOpacity, 1 + precisionDirection * (0.045 + traitPlan.precision * 0.105) + depthDirection * traitPlan.depth * 0.025),
    membraneLayerExtra: traitPlan.precision > 0.52 || (traitPlan.depth > 0.58 && precision > 0.42) ? 1 : 0,
    veinExtra: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.veinExtra, Math.round(traitPlan.precision * 1.35 + traitPlan.depth * 0.75)),
    veinFan: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.veinFan, frequencyDirection * (0.035 + traitPlan.frequency * 0.08) + routeBias * traitPlan.diversity * 0.045),
    veinBranch: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.veinBranch, precisionDirection * (0.025 + traitPlan.precision * 0.075) + geometryBias * traitPlan.diversity * 0.04),
    veinOpacity: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.veinOpacity, 1 + precisionDirection * (0.08 + traitPlan.precision * 0.2) + traitPlan.frequency * 0.05),
    rimOpacity: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.rimOpacity, 1 + precisionDirection * traitPlan.precision * 0.16 + energyDirection * traitPlan.energy * 0.12),
    heartScale: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.heartScale, 1 + energyDirection * (0.065 + traitPlan.energy * 0.125) + diversityDirection * traitPlan.diversity * 0.025),
    heartVariation: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.heartVariation, diversityDirection * (0.018 + traitPlan.diversity * 0.05)),
    heartLobeWidths,
    heartLobeLengths,
    heartCoreScale: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.heartCoreScale, 1 + energyDirection * traitPlan.energy * 0.12 + geometryBias * 0.035),
    heartPulse: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.heartPulse, 1 + energyDirection * (0.055 + traitPlan.energy * 0.13)),
    heartGlow: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.heartGlow, 1 + energyDirection * (0.1 + traitPlan.energy * 0.25) + depthDirection * traitPlan.depth * 0.06),
    energyOpacity: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.energyOpacity, 1 + energyDirection * (0.1 + traitPlan.energy * 0.3) + depthDirection * traitPlan.depth * 0.08),
    energyPathExtra: Math.min(2, Math.round(traitPlan.depth * 1.25 + traitPlan.diversity * 0.85)),
    energyRouting: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.energyRouting, routeBias * (0.028 + traitPlan.diversity * 0.055 + traitPlan.depth * 0.025)),
    energyRoutePhase: geometryRandom() * Math.PI * 2,
    energyPathEmphasis: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.energyPathEmphasis, 1 + energyDirection * traitPlan.energy * 0.18 + depthDirection * (0.06 + traitPlan.depth * 0.14)),
    particleRichness: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.particleRichness, 1 + depthDirection * (0.06 + traitPlan.depth * 0.3) + diversity * 0.05),
    iridescence: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.iridescence, 1 + precisionDirection * traitPlan.precision * 0.2 + diversityDirection * traitPlan.diversity * 0.12),
    glowIntensity: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.glowIntensity, 1 + energyDirection * (0.07 + traitPlan.energy * 0.2) + depthDirection * traitPlan.depth * 0.08),
    primaryColor: palette.primary,
    secondaryColor: palette.secondary,
    accentColor: palette.accent,
    energyColor: palette.energy,
    primaryHue: hexHue(palette.primary),
    secondaryHue: hexHue(palette.secondary),
    accentHue: hexHue(palette.accent),
  };

  if (phenotypeSilhouetteDistance(phenotype, DEFAULT_SOUND_SPIRIT_PHENOTYPE) < 0.24
    || phenotypeVisualDistance(phenotype, DEFAULT_SOUND_SPIRIT_PHENOTYPE) < 0.24) {
    phenotype = enforceMinimumVisualSeparation(phenotype, traitPlan.dominant, genome.seed);
  }
  return phenotype;
}

type TraitName = 'energy' | 'frequency' | 'diversity' | 'precision' | 'depth';
type TraitWeights = Record<TraitName, number> & { dominant: TraitName };

function deriveTraitPlan(genes: Record<TraitName, number>, seed: number): TraitWeights {
  const random = seededRandom(seed ^ 0x7f4a7c15);
  const distances = Object.fromEntries(
    (Object.keys(genes) as TraitName[]).map((name) => [name, Math.abs(genes[name] - 0.5) * 2]),
  ) as Record<TraitName, number>;
  const average = Object.values(distances).reduce((sum, value) => sum + value, 0) / 5;
  const ranked = (Object.keys(genes) as TraitName[])
    .map((name) => ({
      name,
      score: distances[name] * 0.36 + genes[name] * 0.44
        + Math.max(0, distances[name] - average) * 0.1 + random() * 0.15,
    }))
    .sort((left, right) => right.score - left.score);
  const weights = { energy: 0, frequency: 0, diversity: 0, precision: 0, depth: 0 };
  const dominantCount = 2 + (seed & 1);
  const rankWeights = [0.92, 0.7, 0.48];
  (Object.keys(weights) as TraitName[]).forEach((name) => { weights[name] = 0.08 + distances[name] * 0.08; });
  ranked.slice(0, dominantCount).forEach(({ name }, index) => { weights[name] += rankWeights[index]; });
  const budget = Object.values(weights).reduce((sum, value) => sum + value, 0);
  const scale = Math.min(1, 2.25 / budget);
  (Object.keys(weights) as TraitName[]).forEach((name) => { weights[name] *= scale; });
  return { ...weights, dominant: ranked[0].name };
}

const PALETTE_ANCHORS = [
  [0x22d9ff, 0x6758ff, 0xff54b8, 0xff9660],
  [0x24efd4, 0x318dff, 0xffd15c, 0xffaa45],
  [0x358cff, 0x8b55ff, 0xff568c, 0xff825f],
  [0x9d72ff, 0x35d9ff, 0xf05aff, 0xffb454],
  [0x20e4c5, 0x5968ff, 0xff45cb, 0xff745e],
  [0x6554ff, 0x29c8ff, 0xffa83d, 0xff6f55],
] as const;

function deriveIndividualPalette(genes: Record<TraitName, number>, seed: number) {
  const random = seededRandom(seed ^ 0xc2b2ae35);
  const position = fract(random() * 0.72 + genes.frequency * 0.14 + genes.diversity * 0.09 + genes.energy * 0.07 + genes.precision * 0.05);
  const scaled = position * PALETTE_ANCHORS.length;
  const index = Math.floor(scaled) % PALETTE_ANCHORS.length;
  const next = (index + 1) % PALETTE_ANCHORS.length;
  const amount = smoothMix(scaled - Math.floor(scaled));
  return {
    primary: mixHex(PALETTE_ANCHORS[index][0], PALETTE_ANCHORS[next][0], amount),
    secondary: mixHex(PALETTE_ANCHORS[index][1], PALETTE_ANCHORS[next][1], amount),
    accent: mixHex(PALETTE_ANCHORS[index][2], PALETTE_ANCHORS[next][2], amount),
    energy: mixHex(PALETTE_ANCHORS[index][3], PALETTE_ANCHORS[next][3], amount),
  };
}

function createLobeFactors(random: () => number, variation: number, bias: number): readonly [number, number, number, number, number] {
  return Object.freeze(Array.from({ length: 5 }, (_, index) => clamp(
    ...SOUND_SPIRIT_SPECIES_GUARDRAILS.heartLobeScale,
    1 + (random() * 2 - 1) * variation + bias * (index - 2) * 0.32,
  )) as [number, number, number, number, number]);
}

function geneDirection(value: number, random: () => number) {
  if (Math.abs(value - 0.5) < 0.08) return random() < 0.5 ? -1 : 1;
  return value < 0.5 ? -1 : 1;
}

function enforceMinimumVisualSeparation(phenotype: SoundSpiritPhenotypeConfig, dominant: TraitName, seed: number) {
  const geneValue = dominant === 'depth' ? phenotype.interactionDepth : phenotype[dominant];
  const direction = Math.abs(Number(geneValue) - 0.5) < 0.08 ? (seed & 2 ? 1 : -1) : Number(geneValue) < 0.5 ? -1 : 1;
  if (dominant === 'energy') {
    return { ...phenotype, heartScale: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.heartScale, 1 + direction * 0.14), heartGlow: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.heartGlow, 1 + direction * 0.24) };
  }
  if (dominant === 'frequency') {
    return { ...phenotype, wingSpan: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.wingSpan, 1 + direction * 0.16), wingHeight: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.wingHeight, 1 - direction * 0.11), wingPose: direction * 0.09 };
  }
  if (dominant === 'diversity') {
    return { ...phenotype, wingSweep: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.wingSweep, 1 + direction * 0.09), wingScallop: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.wingScallop, direction * 0.045), crownEarHeight: 1 + direction * 0.14, crownNotchDepth: direction * 0.012 };
  }
  if (dominant === 'precision') {
    return { ...phenotype, wingHeight: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.wingHeight, 1 + direction * 0.09), membraneLayerExtra: direction > 0 ? 1 : 0, veinExtra: direction > 0 ? 2 : 0 };
  }
  return { ...phenotype, bodyLength: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.bodyLength, 1 + direction * 0.06), wingSweep: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.wingSweep, 1 - direction * 0.08), energyPathExtra: direction > 0 ? 2 : 1 };
}

export function phenotypeVisualDistance(left: SoundSpiritPhenotypeConfig, right: SoundSpiritPhenotypeConfig) {
  const silhouette = phenotypeSilhouetteDistance(left, right);
  const structure = averageDifference(left, right, [
    ['veinFan', 0.16], ['veinBranch', 0.14], ['energyRouting', 0.09], ['membraneOpacity', 0.18],
    ['veinExtra', 2], ['energyPathExtra', 2], ['energyPathEmphasis', 0.28],
  ]);
  const heart = (tupleDistance(left.heartLobeWidths, right.heartLobeWidths, 0.18)
    + tupleDistance(left.heartLobeLengths, right.heartLobeLengths, 0.18)
    + Math.abs(left.heartCoreScale - right.heartCoreScale) / 0.18) / 3;
  const palette = (
    colorDistance(left.primaryColor, right.primaryColor) + colorDistance(left.secondaryColor, right.secondaryColor)
    + colorDistance(left.accentColor, right.accentColor) + colorDistance(left.energyColor, right.energyColor)
  ) / 4;
  return clamp01(silhouette * 0.38 + structure * 0.25 + heart * 0.2 + palette * 0.17);
}

function phenotypeSilhouetteDistance(left: SoundSpiritPhenotypeConfig, right: SoundSpiritPhenotypeConfig) {
  return averageDifference(left, right, [
    ['crownHeight', 0.18], ['crownWidth', 0.14], ['crownEarHeight', 0.18], ['crownNotchDepth', 0.018],
    ['wingSpan', 0.18], ['wingHeight', 0.15], ['wingPose', 0.14], ['wingFullness', 0.14],
    ['wingSweep', 0.12], ['wingCurvature', 0.12], ['wingScallop', 0.055],
    ['bodyLength', 0.07], ['bodyFullness', 0.11], ['heartScale', 0.2],
  ]);
}

export function createSoundSpiritPhenotype(history: SoundSpiritInteractionHistory) {
  return resolveSoundSpiritBirth(history).phenotype;
}

export interface SoundSpiritBirthSnapshot {
  genome: SoundSpiritGenome;
  phenotype: SoundSpiritPhenotypeConfig;
}

export function resolveSoundSpiritBirth(history: SoundSpiritInteractionHistory): SoundSpiritBirthSnapshot {
  const resolved = resolveSoundSpiritGenome(history);
  const genome = resolved === DEFAULT_SOUND_SPIRIT_GENOME ? resolved : Object.freeze({ ...resolved });
  return Object.freeze({ genome, phenotype: generateSoundSpiritPhenotype(genome) });
}

export function createLocalSpiritPreviewPhenotype(preset: string | null) {
  if (!preset || preset === 'default') return DEFAULT_SOUND_SPIRIT_PHENOTYPE;
  const base: SoundSpiritGenome = {
    hasHistory: true,
    energy: 0.5,
    frequency: 0.5,
    diversity: 0.45,
    precision: 0.5,
    interactionDepth: 0.48,
    seed: hashText(`local-preview:${preset}`),
  };
  if (preset === 'energy') return generateSoundSpiritPhenotype({ ...base, energy: 0.96 });
  if (preset === 'frequency') return generateSoundSpiritPhenotype({ ...base, frequency: 0.96 });
  if (preset === 'diversity') return generateSoundSpiritPhenotype({ ...base, diversity: 0.96, interactionDepth: 0.72 });
  if (preset === 'precision') return generateSoundSpiritPhenotype({ ...base, precision: 0.96, interactionDepth: 0.72 });
  if (preset === 'depth') return generateSoundSpiritPhenotype({ ...base, diversity: 0.9, precision: 0.9, interactionDepth: 0.98 });
  return DEFAULT_SOUND_SPIRIT_PHENOTYPE;
}

export function normalizeFrequency(value: number) {
  return clamp01(Math.log(value / WAVE_FREQUENCY_MIN) / Math.log(WAVE_FREQUENCY_MAX / WAVE_FREQUENCY_MIN));
}

function normalizeSampleRate(value: number) {
  return clamp01(Math.log(value / 8000) / Math.log(96000 / 8000));
}

function normalizeBitDepth(value: number) {
  return clamp01((value - 1) / 31);
}

function createEmptyFeature(): FeatureSummary {
  return { minimum: 1, maximum: 0, weightedTotal: 0, weight: 0, sessions: 0, regions: new Set() };
}

function createEmptyHistory(): SoundSpiritInteractionHistory {
  return {
    features: {
      amplitude: createEmptyFeature(),
      frequency: createEmptyFeature(),
      sampleRate: createEmptyFeature(),
      bitDepth: createEmptyFeature(),
    },
    waveforms: new Set(),
    channels: new Set(),
    samplingCombinations: new Set(),
    waveformSwitches: 0,
    meaningfulSessions: 0,
    meaningfulSeconds: 0,
    waveExplored: false,
    samplingExplored: false,
    eventCounts: new Map(),
    orderedEvents: [],
  };
}

function cloneHistory(history: SoundSpiritInteractionHistory): SoundSpiritInteractionHistory {
  return {
    features: {
      amplitude: cloneFeature(history.features.amplitude),
      frequency: cloneFeature(history.features.frequency),
      sampleRate: cloneFeature(history.features.sampleRate),
      bitDepth: cloneFeature(history.features.bitDepth),
    },
    waveforms: new Set(history.waveforms),
    channels: new Set(history.channels),
    samplingCombinations: new Set(history.samplingCombinations),
    waveformSwitches: history.waveformSwitches,
    meaningfulSessions: history.meaningfulSessions,
    meaningfulSeconds: history.meaningfulSeconds,
    waveExplored: history.waveExplored,
    samplingExplored: history.samplingExplored,
    eventCounts: new Map(history.eventCounts),
    orderedEvents: [...history.orderedEvents],
  };
}

function cloneFeature(feature: FeatureSummary): FeatureSummary {
  return { ...feature, regions: new Set(feature.regions) };
}

function weightedMean(summary: FeatureSummary, fallback: number) {
  return summary.weight > 0 ? clamp01(summary.weightedTotal / summary.weight) : fallback;
}

function exploredRange(summary: FeatureSummary) {
  return summary.sessions > 0 ? clamp01(summary.maximum - summary.minimum) : 0;
}

function regionBreadth(summary: FeatureSummary) {
  return summary.regions.size / 4;
}

function regionOf(value: number) {
  return Math.min(3, Math.floor(clamp01(value) * 4));
}

function stableHistorySignature(
  history: SoundSpiritInteractionHistory,
  energy: number,
  frequency: number,
  diversity: number,
  precision: number,
  depth: number,
) {
  return [
    roundKey(energy), roundKey(frequency), roundKey(diversity), roundKey(precision), roundKey(depth),
    history.waveforms.size, history.channels.size, history.samplingCombinations.size,
    ...[...history.waveforms].sort(),
    ...[...history.channels].sort(),
    ...[...history.samplingCombinations].sort(),
    ...history.orderedEvents,
  ].join('|');
}

function mixHex(from: number, to: number, amount: number) {
  const mixChannel = (shift: number) => Math.round(mix((from >> shift) & 0xff, (to >> shift) & 0xff, amount));
  return (mixChannel(16) << 16) | (mixChannel(8) << 8) | mixChannel(0);
}

function averageDifference(
  left: SoundSpiritPhenotypeConfig,
  right: SoundSpiritPhenotypeConfig,
  dimensions: Array<[keyof SoundSpiritPhenotypeConfig, number]>,
) {
  return dimensions.reduce((sum, [key, range]) => (
    sum + Math.min(1, Math.abs(Number(left[key]) - Number(right[key])) / range)
  ), 0) / dimensions.length;
}

function tupleDistance(left: readonly number[], right: readonly number[], range: number) {
  return left.reduce((sum, value, index) => sum + Math.min(1, Math.abs(value - right[index]) / range), 0) / left.length;
}

function colorDistance(left: number, right: number) {
  const red = ((left >> 16) & 0xff) - ((right >> 16) & 0xff);
  const green = ((left >> 8) & 0xff) - ((right >> 8) & 0xff);
  const blue = (left & 0xff) - (right & 0xff);
  return Math.min(1, Math.hypot(red, green, blue) / 260);
}

function hexHue(color: number) {
  const red = ((color >> 16) & 0xff) / 255;
  const green = ((color >> 8) & 0xff) / 255;
  const blue = (color & 0xff) / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  if (maximum === minimum) return 0;
  const delta = maximum - minimum;
  const hue = maximum === red
    ? ((green - blue) / delta) % 6
    : maximum === green
      ? (blue - red) / delta + 2
      : (red - green) / delta + 4;
  return (hue * 60 + 360) % 360;
}

function smoothMix(value: number) {
  return value * value * (3 - 2 * value);
}

function fract(value: number) {
  return value - Math.floor(value);
}

function mix(from: number, to: number, amount: number) {
  return from + (to - from) * clamp01(amount);
}

function clamp(minimum: number, maximum: number, value: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function clamp01(value: number) {
  return clamp(0, 1, Number.isFinite(value) ? value : 0.5);
}

function roundKey(value: number) {
  return Math.round(value * 1000);
}

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}
