export interface AudioOnsetInput {
  bass: number;
  mid: number;
  treble: number;
  spectralFlux: number;
  playing: boolean;
}

export interface AudioOnsetEvent {
  detected: boolean;
  strength: number;
  lowStrength: number;
  highStrength: number;
}

export interface AudioOnsetDetectorState {
  baseline: number;
  deviation: number;
  fluxBaseline: number;
  fluxDeviation: number;
  previousSignal: number;
  lastOnsetAt: number;
  lastUpdateAt: number;
}

export const AUDIO_ONSET_REFRACTORY_MS = 180;

export function createAudioOnsetDetectorState(): AudioOnsetDetectorState {
  return {
    baseline: 0.035,
    deviation: 0.014,
    fluxBaseline: 0.0025,
    fluxDeviation: 0.0012,
    previousSignal: 0,
    lastOnsetAt: -Infinity,
    lastUpdateAt: 0,
  };
}

export function detectAudioOnset(
  state: AudioOnsetDetectorState,
  input: AudioOnsetInput,
  now: number,
): AudioOnsetEvent {
  const deltaTime = Math.min(0.08, Math.max(0.001, (now - (state.lastUpdateAt || now - 32)) / 1000));
  state.lastUpdateAt = now;
  const signal = input.bass * 0.56 + input.mid * 0.29 + input.treble * 0.15;
  const rise = Math.max(0, signal - state.previousSignal);
  const signalThreshold = state.baseline + Math.max(0.016, state.deviation * 1.42);
  const fluxThreshold = state.fluxBaseline + Math.max(0.001, state.fluxDeviation * 1.25);
  const signalExcess = Math.max(0, signal - signalThreshold);
  const fluxExcess = Math.max(0, input.spectralFlux - fluxThreshold);
  const transientEvidence = rise / Math.max(0.012, state.deviation * 0.72)
    + signalExcess / Math.max(0.035, state.deviation * 2.2)
    + fluxExcess / Math.max(0.0035, state.fluxDeviation * 2.4);
  const detected = input.playing
    && signal > 0.018
    && now - state.lastOnsetAt >= AUDIO_ONSET_REFRACTORY_MS
    && transientEvidence > 1.08
    && (signal > signalThreshold || input.spectralFlux > fluxThreshold)
    && (rise > Math.max(0.008, state.deviation * 0.22) || input.spectralFlux > fluxThreshold);

  let strength = 0;
  let lowStrength = 0;
  let highStrength = 0;
  if (detected) {
    strength = clamp01(0.1 + rise * 1.2 + signalExcess * 0.72 + fluxExcess * 2.1);
    const total = Math.max(0.001, input.bass + input.mid + input.treble);
    const lowShare = input.bass / total;
    const highShare = (input.mid * 0.58 + input.treble * 0.42) / total;
    lowStrength = strength * (0.62 + lowShare * 0.38);
    highStrength = strength * (0.5 + Math.min(1, highShare) * 0.5);
    state.lastOnsetAt = now;
  }

  const distance = Math.abs(signal - state.baseline);
  const baselineRate = signal > state.baseline ? 0.72 : 2.8;
  state.baseline += (signal - state.baseline) * (1 - Math.exp(-deltaTime * baselineRate));
  state.deviation += (distance - state.deviation) * (1 - Math.exp(-deltaTime * 1.9));
  const fluxDistance = Math.abs(input.spectralFlux - state.fluxBaseline);
  state.fluxBaseline += (input.spectralFlux - state.fluxBaseline) * (1 - Math.exp(-deltaTime * 1.45));
  state.fluxDeviation += (fluxDistance - state.fluxDeviation) * (1 - Math.exp(-deltaTime * 1.8));
  state.previousSignal = signal;

  return { detected, strength, lowStrength, highStrength };
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}
