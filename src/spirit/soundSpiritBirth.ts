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
  formationFront: number;
  wingVeinReveal: number;
  overexposure: number;
  revealEnergy: number;
  interactionLocked: boolean;
}

export const SOUND_SPIRIT_BIRTH_DURATION_SECONDS = 3.5;

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
  const state: SoundSpiritBirthState = elapsed < 0.35
    ? 'UNBORN'
    : elapsed < 0.9
      ? 'HEART'
      : elapsed < 1.65
        ? 'FORMING'
        : elapsed < 2.55
          ? 'UNFOLDING'
          : 'AWAKENING';

  return {
    state,
    progress: ease(0, SOUND_SPIRIT_BIRTH_DURATION_SECONDS, elapsed),
    heartReveal: ease(0.35, 0.98, elapsed),
    energyReveal: ease(0.66, 2.46, elapsed),
    bodyReveal: ease(0.9, 1.76, elapsed),
    crownReveal: ease(1.14, 1.88, elapsed),
    wingRootReveal: ease(1.48, 1.92, elapsed),
    wingVeinReveal: ease(1.64, 2.36, elapsed),
    wingRimReveal: ease(1.96, 2.62, elapsed),
    wingMembraneReveal: ease(2.2, 2.88, elapsed),
    awakening: ease(2.86, SOUND_SPIRIT_BIRTH_DURATION_SECONDS, elapsed),
    livingMotion: ease(2.96, SOUND_SPIRIT_BIRTH_DURATION_SECONDS, elapsed),
    heartPulse: Math.min(1, pulse(elapsed, 0.76, 0.11) + pulse(elapsed, 2.86, 0.13) * 0.5),
    convergence: ease(0.04, 0.62, elapsed) * (1 - ease(0.98, 1.48, elapsed)),
    focusGlow: ease(0.14, 0.76, elapsed) * (1 - ease(2.92, 3.28, elapsed)),
    lightAbsorption: ease(0.18, 0.94, elapsed) * (1 - ease(1.08, 1.58, elapsed)),
    formationFront: ease(0.72, 2.78, elapsed) * (1 - ease(2.94, 3.24, elapsed)),
    overexposure: pulse(elapsed, 2.88, 0.09),
    revealEnergy: ease(0.46, 1.3, elapsed) * (1 - ease(2.92, 3.28, elapsed)),
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
