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
  birthRing: number;
  transformationFlash: number;
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
  birthRing: 0,
  transformationFlash: 0,
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
    energyReveal: ease(0.68, 2.08, elapsed),
    bodyReveal: ease(0.78, 1.78, elapsed),
    crownReveal: ease(1.02, 1.88, elapsed),
    wingRootReveal: ease(1.38, 2.04, elapsed),
    wingMembraneReveal: ease(1.58, 2.65, elapsed),
    wingRimReveal: ease(1.86, 2.82, elapsed),
    awakening: ease(2.48, SOUND_SPIRIT_BIRTH_DURATION_SECONDS, elapsed),
    livingMotion: ease(2.7, SOUND_SPIRIT_BIRTH_DURATION_SECONDS, elapsed),
    heartPulse: Math.min(1, pulse(elapsed, 0.72, 0.105) + pulse(elapsed, 2.82, 0.14) * 0.72),
    convergence: ease(0.02, 0.58, elapsed) * (1 - ease(1.02, 1.56, elapsed)),
    focusGlow: ease(0.08, 0.62, elapsed) * (1 - ease(2.42, 3.08, elapsed)),
    birthRing: Math.min(1, pulse(elapsed, 0.76, 0.18) + pulse(elapsed, 2.58, 0.21) * 0.9),
    transformationFlash: pulse(elapsed, 2.58, 0.17),
    revealEnergy: ease(0.42, 1.94, elapsed) * (1 - ease(2.28, 3.12, elapsed)),
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
