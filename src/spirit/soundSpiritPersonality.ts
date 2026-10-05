import type { SoundSpiritGenome } from './soundSpiritIdentity';

export interface SoundSpiritPersonality {
  key: string;
  isDefault: boolean;
  vitality: number;
  curiosity: number;
  caution: number;
  grace: number;
  rhythmAffinity: number;
  independence: number;
  idleSpeed: number;
  wanderRadius: number;
  turnResponsiveness: number;
  pathCurvature: number;
  verticalDrift: number;
  glideBias: number;
  attractionStrength: number;
  preferredDistance: number;
  lingerDuration: number;
  sweepResponse: number;
  explosionResponse: number;
  recoveryRate: number;
  wingRate: number;
  wingPower: number;
  rhythmResponse: number;
  followThrough: number;
}

export const PERSONALITY_GUARDRAILS = Object.freeze({
  dimension: Object.freeze([0.18, 0.82] as const),
  idleSpeed: Object.freeze([0.84, 1.18] as const),
  wanderRadius: Object.freeze([0.86, 1.16] as const),
  turnResponsiveness: Object.freeze([0.84, 1.18] as const),
  pathCurvature: Object.freeze([0.86, 1.16] as const),
  verticalDrift: Object.freeze([0.88, 1.14] as const),
  glideBias: Object.freeze([0.88, 1.14] as const),
  attractionStrength: Object.freeze([0.86, 1.18] as const),
  preferredDistance: Object.freeze([0.88, 1.14] as const),
  lingerDuration: Object.freeze([0.84, 1.18] as const),
  sweepResponse: Object.freeze([0.86, 1.18] as const),
  explosionResponse: Object.freeze([0.88, 1.2] as const),
  recoveryRate: Object.freeze([0.86, 1.16] as const),
  wingRate: Object.freeze([0.88, 1.15] as const),
  wingPower: Object.freeze([0.88, 1.17] as const),
  rhythmResponse: Object.freeze([0.84, 1.2] as const),
  followThrough: Object.freeze([0.88, 1.15] as const),
});

export const DEFAULT_SOUND_SPIRIT_PERSONALITY: SoundSpiritPersonality = Object.freeze({
  key: 'default',
  isDefault: true,
  vitality: 0.5,
  curiosity: 0.5,
  caution: 0.5,
  grace: 0.5,
  rhythmAffinity: 0.5,
  independence: 0.5,
  idleSpeed: 1,
  wanderRadius: 1,
  turnResponsiveness: 1,
  pathCurvature: 1,
  verticalDrift: 1,
  glideBias: 1,
  attractionStrength: 1,
  preferredDistance: 1,
  lingerDuration: 1,
  sweepResponse: 1,
  explosionResponse: 1,
  recoveryRate: 1,
  wingRate: 1,
  wingPower: 1,
  rhythmResponse: 1,
  followThrough: 1,
});

type DimensionName = 'vitality' | 'curiosity' | 'caution' | 'grace' | 'rhythmAffinity' | 'independence';

export function generateSoundSpiritPersonality(genome: SoundSpiritGenome): SoundSpiritPersonality {
  if (!genome.hasHistory) return DEFAULT_SOUND_SPIRIT_PERSONALITY;
  const random = seededRandom(genome.seed ^ 0x3c6ef372);
  const e = centered(genome.energy);
  const f = centered(genome.frequency);
  const d = centered(genome.diversity);
  const p = centered(genome.precision);
  const depth = centered(genome.interactionDepth);
  const raw: Record<DimensionName, number> = {
    vitality: dimension(0.5 + e * 0.2 + f * 0.055 + depth * 0.08 + variation(random, 0.1)),
    curiosity: dimension(0.5 + d * 0.17 + depth * 0.11 + f * 0.045 + variation(random, 0.11)),
    caution: dimension(0.5 + p * 0.11 + f * 0.07 - e * 0.055 + variation(random, 0.12)),
    grace: dimension(0.5 + p * 0.2 + depth * 0.07 - Math.abs(d) * 0.025 + variation(random, 0.085)),
    rhythmAffinity: dimension(0.5 + p * 0.13 + e * 0.12 + depth * 0.075 + variation(random, 0.095)),
    independence: dimension(0.5 + d * 0.14 + f * 0.06 - depth * 0.035 + variation(random, 0.12)),
  };
  const dimensions = applyTraitBudget(raw, genome.seed);
  const vitality = centered(dimensions.vitality);
  const curiosity = centered(dimensions.curiosity);
  const caution = centered(dimensions.caution);
  const grace = centered(dimensions.grace);
  const rhythm = centered(dimensions.rhythmAffinity);
  const independence = centered(dimensions.independence);

  return Object.freeze({
    key: `personality-${genome.seed}-${dimensionKey(dimensions)}`,
    isDefault: false,
    ...dimensions,
    idleSpeed: bounded('idleSpeed', 1 + vitality * 0.115 + f * 0.025),
    wanderRadius: bounded('wanderRadius', 1 + independence * 0.09 + d * 0.045),
    turnResponsiveness: bounded('turnResponsiveness', 1 + f * 0.075 + grace * 0.065),
    pathCurvature: bounded('pathCurvature', 1 + d * 0.075 + curiosity * 0.045),
    verticalDrift: bounded('verticalDrift', 1 + vitality * 0.045 + grace * 0.055),
    glideBias: bounded('glideBias', 1 + grace * 0.075 - vitality * 0.045),
    attractionStrength: bounded('attractionStrength', 1 + curiosity * 0.12 - independence * 0.04),
    preferredDistance: bounded('preferredDistance', 1 + independence * 0.085 - curiosity * 0.045),
    lingerDuration: bounded('lingerDuration', 1 + curiosity * 0.085 - independence * 0.11),
    sweepResponse: bounded('sweepResponse', 1 + caution * 0.13 + vitality * 0.035),
    explosionResponse: bounded('explosionResponse', 1 + caution * 0.11 + vitality * 0.075),
    recoveryRate: bounded('recoveryRate', 1 + vitality * 0.055 + grace * 0.075 - caution * 0.035),
    wingRate: bounded('wingRate', 1 + vitality * 0.075 + f * 0.045),
    wingPower: bounded('wingPower', 1 + vitality * 0.1 + rhythm * 0.035),
    rhythmResponse: bounded('rhythmResponse', 1 + rhythm * 0.17),
    followThrough: bounded('followThrough', 1 + grace * 0.105),
  });
}

export function personalityDistance(left: SoundSpiritPersonality, right: SoundSpiritPersonality) {
  const dimensions: DimensionName[] = ['vitality', 'curiosity', 'caution', 'grace', 'rhythmAffinity', 'independence'];
  return dimensions.reduce((sum, name) => sum + Math.abs(left[name] - right[name]), 0) / dimensions.length;
}

function applyTraitBudget(raw: Record<DimensionName, number>, seed: number) {
  const names = Object.keys(raw) as DimensionName[];
  const signatureCount = 2 + (seed & 1);
  const ranked = [...names].sort((left, right) => Math.abs(raw[right] - 0.5) - Math.abs(raw[left] - 0.5));
  return Object.fromEntries(names.map((name) => {
    const strength = ranked.indexOf(name) < signatureCount ? 1 : 0.32;
    return [name, dimension(0.5 + (raw[name] - 0.5) * strength)];
  })) as Record<DimensionName, number>;
}

function dimensionKey(values: Record<DimensionName, number>) {
  return Object.values(values).map((value) => Math.round(value * 1000)).join('-');
}

function variation(random: () => number, amount: number) {
  return (random() * 2 - 1) * amount;
}

function centered(value: number) {
  return (Math.min(1, Math.max(0, value)) - 0.5) * 2;
}

function dimension(value: number) {
  return Math.min(PERSONALITY_GUARDRAILS.dimension[1], Math.max(PERSONALITY_GUARDRAILS.dimension[0], value));
}

function bounded(name: Exclude<keyof typeof PERSONALITY_GUARDRAILS, 'dimension'>, value: number) {
  const [minimum, maximum] = PERSONALITY_GUARDRAILS[name];
  return Math.min(maximum, Math.max(minimum, value));
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
