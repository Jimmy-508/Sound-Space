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
  wingSpan: number;
  wingHeight: number;
  wingSweep: number;
  wingCurvature: number;
  wingAsymmetry: number;
  membraneOpacity: number;
  membraneLayerExtra: number;
  veinExtra: number;
  veinOpacity: number;
  rimOpacity: number;
  heartScale: number;
  heartVariation: number;
  heartGlow: number;
  energyOpacity: number;
  energyPathExtra: number;
  energyRouting: number;
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
  wingSpan: Object.freeze([0.88, 1.15] as const),
  wingHeight: Object.freeze([0.9, 1.12] as const),
  wingSweep: Object.freeze([0.92, 1.12] as const),
  wingCurvature: Object.freeze([-0.12, 0.12] as const),
  wingAsymmetry: Object.freeze([-0.055, 0.055] as const),
  bodyFullness: Object.freeze([0.91, 1.11] as const),
  bodyLength: Object.freeze([0.94, 1.07] as const),
  bodyAsymmetry: Object.freeze([-0.035, 0.035] as const),
  membraneOpacity: Object.freeze([0.88, 1.18] as const),
  veinExtra: Object.freeze([0, 2] as const),
  veinOpacity: Object.freeze([0.88, 1.35] as const),
  rimOpacity: Object.freeze([0.9, 1.34] as const),
  heartScale: Object.freeze([0.86, 1.2] as const),
  heartVariation: Object.freeze([-0.07, 0.07] as const),
  heartGlow: Object.freeze([0.82, 1.38] as const),
  energyOpacity: Object.freeze([0.72, 1.48] as const),
  energyRouting: Object.freeze([-0.09, 0.09] as const),
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
  wingSpan: 1,
  wingHeight: 1,
  wingSweep: 1,
  wingCurvature: 0,
  wingAsymmetry: 0,
  membraneOpacity: 1,
  membraneLayerExtra: 0,
  veinExtra: 0,
  veinOpacity: 1,
  rimOpacity: 1,
  heartScale: 1,
  heartVariation: 0,
  heartGlow: 1,
  energyOpacity: 1,
  energyPathExtra: 0,
  energyRouting: 0,
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
  const energy = clamp01(
    amplitude * 0.35 + amplitudeRange * 0.4 + amplitudeRegions * 0.2
    + (1 - Math.exp(-history.features.amplitude.sessions / 3)) * 0.05,
  );
  const frequency = clamp01(frequencyMean * 0.72 + frequencyRange * 0.16 + frequencyRegions * 0.12);
  const diversity = clamp01(
    waveformBreadth * 0.21 + amplitudeRange * 0.14 + frequencyRange * 0.17
    + samplingRange * 0.12 + bitDepthRange * 0.11 + channelBreadth * 0.08
    + combinationBreadth * 0.1 + crossLab * 0.07,
  );
  const precision = clamp01(sampleRate * 0.58 + bitDepth * 0.34 + Math.min(1, (samplingRange + bitDepthRange) * 0.8) * 0.08);
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
  const random = seededRandom(genome.seed);
  const energy = clamp01(genome.energy);
  const frequency = clamp01(genome.frequency);
  const diversity = clamp01(genome.diversity);
  const precision = clamp01(genome.precision);
  const depth = clamp01(genome.interactionDepth);
  const energyBias = energy - 0.5;
  const frequencyBias = frequency - 0.5;
  const individuality = (random() * 2 - 1) * diversity;
  const routeIndividuality = (random() * 2 - 1) * diversity;
  const richness = clamp01(depth * 0.7 + diversity * 0.18 + precision * 0.12);
  const cool = mixHex(0xb36dff, 0x64efff, frequency);
  const secondary = mixHex(0xf06fd5, 0x778dff, clamp01(frequency * 0.72 + individuality * 0.08 + 0.12));
  const accent = mixHex(0xff9fca, 0xffd28a, clamp01(energy * 0.76 + diversity * 0.24));
  const energyColor = mixHex(0xff9f91, 0xffc269, clamp01(energy * 0.82 + precision * 0.18));
  const seedDetail = (random() - 0.5) * 0.018 * diversity;

  return {
    key: `personal-${genome.seed}-${roundKey(energy)}-${roundKey(frequency)}-${roundKey(diversity)}-${roundKey(precision)}-${roundKey(depth)}`,
    isDefault: false,
    seed: genome.seed,
    energy,
    frequency,
    diversity,
    precision,
    interactionDepth: depth,
    bodyFullness: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.bodyFullness, 1 + energyBias * 0.2 + seedDetail),
    bodyLength: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.bodyLength, 1 - frequencyBias * 0.06 + depth * 0.035),
    bodyAsymmetry: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.bodyAsymmetry, individuality * 0.035),
    wingSpan: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.wingSpan, 1 + frequencyBias * 0.24 + diversity * 0.025),
    wingHeight: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.wingHeight, 1 - frequencyBias * 0.18 + (0.5 - energy) * 0.035),
    wingSweep: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.wingSweep, 1 + frequencyBias * 0.1 + depth * 0.045 + routeIndividuality * 0.025),
    wingCurvature: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.wingCurvature, frequencyBias * 0.16 + routeIndividuality * 0.055),
    wingAsymmetry: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.wingAsymmetry, individuality * 0.055),
    membraneOpacity: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.membraneOpacity, 0.94 + precision * 0.12 + richness * 0.1),
    membraneLayerExtra: richness > 0.72 ? 1 : 0,
    veinExtra: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.veinExtra, Math.floor(precision * 1.45 + richness * 1.35)),
    veinOpacity: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.veinOpacity, 0.92 + precision * 0.24 + richness * 0.16),
    rimOpacity: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.rimOpacity, 0.94 + precision * 0.18 + depth * 0.18),
    heartScale: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.heartScale, 1 + energyBias * 0.31 + precision * energy * 0.05),
    heartVariation: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.heartVariation, individuality * (0.04 + depth * 0.03)),
    heartGlow: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.heartGlow, 0.9 + energy * 0.35 + precision * energy * 0.13),
    energyOpacity: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.energyOpacity, 0.78 + energy * 0.5 + diversity * energy * 0.2),
    energyPathExtra: Math.min(2, Math.floor(diversity * 1.2 + richness * 1.35)),
    energyRouting: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.energyRouting, routeIndividuality * (0.055 + depth * 0.035)),
    particleRichness: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.particleRichness, 1 + depth * 0.28 + diversity * 0.14),
    iridescence: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.iridescence, 0.94 + diversity * 0.2 + precision * 0.14 + depth * 0.1),
    glowIntensity: clamp(...SOUND_SPIRIT_SPECIES_GUARDRAILS.glowIntensity, 0.9 + energy * 0.26 + depth * 0.15 + precision * 0.05),
    primaryColor: cool,
    secondaryColor: secondary,
    accentColor: accent,
    energyColor,
    primaryHue: mix(282, 188, frequency),
    secondaryHue: mix(318, 222, clamp01(frequency * 0.75 + diversity * 0.16)),
    accentHue: mix(326, 42, clamp01(energy * 0.82 + diversity * 0.18)),
  };
}

export function createSoundSpiritPhenotype(history: SoundSpiritInteractionHistory) {
  return generateSoundSpiritPhenotype(resolveSoundSpiritGenome(history));
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
