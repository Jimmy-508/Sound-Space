import type { AudioOnsetEvent } from './audioOnsetDetector';

export interface MajorBeatGateState {
  prominenceBaseline: number;
  prominenceDeviation: number;
  confidence: number;
  lastMajorBeatAt: number;
  lastUpdateAt: number;
  expectedInterval: number;
}

export interface MajorBeatEvent {
  detected: boolean;
  strength: number;
  confidence: number;
}

export const MAJOR_BEAT_RECOVERY_MS = 300;

export function createMajorBeatGateState(): MajorBeatGateState {
  return {
    prominenceBaseline: 0.2,
    prominenceDeviation: 0.08,
    confidence: 0,
    lastMajorBeatAt: -Infinity,
    lastUpdateAt: 0,
    expectedInterval: 0,
  };
}

export function gateMajorBeat(
  state: MajorBeatGateState,
  onset: AudioOnsetEvent,
  overallEnergy: number,
  now: number,
  playing: boolean,
): MajorBeatEvent {
  const deltaSeconds = Math.min(0.12, Math.max(0.001, (now - (state.lastUpdateAt || now - 32)) / 1000));
  state.lastUpdateAt = now;
  const confidenceDecay = playing ? 0.42 : 1.3;
  state.confidence *= Math.exp(-deltaSeconds * confidenceDecay);

  if (!playing || !onset.detected) {
    return { detected: false, strength: 0, confidence: clamp01(state.confidence) };
  }

  const lowProminence = onset.lowStrength * 0.52;
  const broadAccent = onset.strength * 0.38 + onset.highStrength * 0.1;
  const prominence = clamp01(lowProminence + broadAccent);
  const threshold = state.prominenceBaseline + Math.max(0.075, state.prominenceDeviation * 0.9);
  const interval = now - state.lastMajorBeatAt;
  const recovered = interval >= MAJOR_BEAT_RECOVERY_MS;
  const periodicSupport = state.expectedInterval > 0
    ? Math.exp(-Math.pow((interval - state.expectedInterval) / Math.max(140, state.expectedInterval * 0.42), 2))
    : 0;
  const clearlyProminent = prominence > threshold
    && (onset.lowStrength > 0.24 || onset.strength > 0.54 || prominence > 0.68);
  const pulseSupported = state.confidence > 0.24 && periodicSupport > 0.24 && prominence > threshold * 0.88;
  const detected = recovered && overallEnergy > 0.012 && (clearlyProminent || pulseSupported);

  const distance = Math.abs(prominence - state.prominenceBaseline);
  state.prominenceBaseline += (prominence - state.prominenceBaseline) * 0.075;
  state.prominenceDeviation += (distance - state.prominenceDeviation) * 0.11;

  if (!detected) {
    return { detected: false, strength: 0, confidence: clamp01(state.confidence) };
  }

  if (Number.isFinite(state.lastMajorBeatAt) && interval >= MAJOR_BEAT_RECOVERY_MS && interval <= 1800) {
    state.expectedInterval = state.expectedInterval > 0
      ? state.expectedInterval * 0.72 + interval * 0.28
      : interval;
  }
  state.lastMajorBeatAt = now;
  const strength = clamp01(0.18 + prominence * 0.82);
  state.confidence = clamp01(state.confidence + 0.24 + periodicSupport * 0.18 + prominence * 0.1);
  return { detected: true, strength, confidence: state.confidence };
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}
