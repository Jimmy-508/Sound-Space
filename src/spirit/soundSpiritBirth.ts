export type SoundSpiritBirthState = 'UNBORN' | 'HEART' | 'FORMING' | 'UNFOLDING' | 'AWAKENING' | 'ALIVE';

export interface SoundSpiritBirthFrame {
  state: SoundSpiritBirthState;
  progress: number;
  heartReveal: number;
  bodyReveal: number;
  crownReveal: number;
  energyReveal: number;
  wingRootReveal: number;
  wingMembraneReveal: number;
  wingRimReveal: number;
  awakening: number;
  livingMotion: number;
  heartPulse: number;
  convergence: number;
  focusGlow: number;
  lightAbsorption: number;
  externalLight: number;
  centralAccumulation: number;
  formationFront: number;
  wingVeinReveal: number;
  overexposure: number;
  revealEnergy: number;
  interactionLocked: boolean;
}

export const SOUND_SPIRIT_BIRTH_DURATION_SECONDS = 4;

export const ALIVE_SOUND_SPIRIT_BIRTH_FRAME: SoundSpiritBirthFrame = Object.freeze({
  state: 'ALIVE',
  progress: 1,
  heartReveal: 1,
  bodyReveal: 1,
  crownReveal: 1,
  energyReveal: 1,
  wingRootReveal: 1,
  wingMembraneReveal: 1,
  wingRimReveal: 1,
  awakening: 1,
  livingMotion: 1,
  heartPulse: 0,
  convergence: 0,
  focusGlow: 0,
  lightAbsorption: 0,
  externalLight: 0,
  centralAccumulation: 0,
  formationFront: 0,
  wingVeinReveal: 1,
  overexposure: 0,
  revealEnergy: 0,
  interactionLocked: false,
});

export function getSoundSpiritBirthFrame(elapsedSeconds: number): SoundSpiritBirthFrame {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds >= SOUND_SPIRIT_BIRTH_DURATION_SECONDS) {
    return ALIVE_SOUND_SPIRIT_BIRTH_FRAME;
  }
  const elapsed = Math.max(0, elapsedSeconds);
  const state: SoundSpiritBirthState = elapsed < 0.45
    ? 'UNBORN'
    : elapsed < 1.25
      ? 'HEART'
      : elapsed < 2.25
        ? 'FORMING'
        : elapsed < 3.35
          ? 'UNFOLDING'
          : 'AWAKENING';

  return {
    state,
    progress: ease(0, SOUND_SPIRIT_BIRTH_DURATION_SECONDS, elapsed),
    heartReveal: ease(0.72, 1.48, elapsed),
    energyReveal: ease(0.88, 3.45, elapsed),
    bodyReveal: ease(1.22, 2.48, elapsed),
    crownReveal: ease(1.58, 2.58, elapsed),
    wingRootReveal: ease(2.02, 2.46, elapsed),
    wingVeinReveal: ease(2.16, 3.04, elapsed),
    wingRimReveal: ease(2.52, 3.38, elapsed),
    wingMembraneReveal: ease(2.84, 3.58, elapsed),
    awakening: ease(3.5, SOUND_SPIRIT_BIRTH_DURATION_SECONDS, elapsed),
    livingMotion: ease(3.62, SOUND_SPIRIT_BIRTH_DURATION_SECONDS, elapsed),
    heartPulse: Math.min(1, pulse(elapsed, 1.18, 0.12) + pulse(elapsed, 3.64, 0.11) * 0.42),
    convergence: ease(0.02, 0.56, elapsed) * (1 - ease(2.2, 3.48, elapsed)),
    focusGlow: ease(0.3, 1.06, elapsed) * (1 - ease(3.54, 3.88, elapsed)),
    lightAbsorption: ease(0.04, 2.35, elapsed),
    externalLight: ease(0.02, 0.3, elapsed) * (1 - ease(3.18, 3.78, elapsed)),
    centralAccumulation: ease(0.42, 1.36, elapsed) * (1 - ease(3.48, 3.88, elapsed)),
    formationFront: ease(1.02, 3.38, elapsed) * (1 - ease(3.58, 3.9, elapsed)),
    overexposure: pulse(elapsed, 3.64, 0.07),
    revealEnergy: ease(0.62, 1.56, elapsed) * (1 - ease(3.56, 3.9, elapsed)),
    interactionLocked: true,
  };
}

export function isSoundSpiritBirthInteractionLocked(token: number, startedAt: number, now = performance.now()) {
  return token > 0 && getSoundSpiritBirthFrame((now - startedAt) / 1000).interactionLocked;
}

function ease(start: number, end: number, value: number) {
  const progress = Math.min(1, Math.max(0, (value - start) / Math.max(0.00001, end - start)));
  return progress * progress * (3 - 2 * progress);
}

function pulse(value: number, center: number, width: number) {
  const distance = (value - center) / width;
  return Math.exp(-distance * distance);
}
