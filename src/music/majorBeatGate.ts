import type { AudioOnsetEvent } from './audioOnsetDetector';

export interface MajorBeatGateState {
  prominenceBaseline: number;
  prominenceDeviation: number;
  energyBaseline: number;
  energyDeviation: number;
  previousEnergy: number;
  confidence: number;
  lastMajorBeatAt: number;
  lastUpdateAt: number;
  expectedInterval: number;
  lastProminence: number;
  lastThreshold: number;
  lastPeriodicSupport: number;
  lastAccepted: boolean;
}

export interface MajorBeatEvent {
  detected: boolean;
  strength: number;
  confidence: number;
  prominence: number;
  threshold: number;
  periodicSupport: number;
  fastPath: boolean;
}

export const MAJOR_BEAT_RECOVERY_MS = 280;

export function createMajorBeatGateState(): MajorBeatGateState {
  return {
    prominenceBaseline: 0.085,
    prominenceDeviation: 0.028,
    energyBaseline: 0.035,
    energyDeviation: 0.014,
    previousEnergy: 0,
    confidence: 0,
    lastMajorBeatAt: -Infinity,
    lastUpdateAt: 0,
    expectedInterval: 0,
    lastProminence: 0,
    lastThreshold: 0.58,
    lastPeriodicSupport: 0,
    lastAccepted: false,
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
  state.confidence *= Math.exp(-deltaSeconds * (playing ? 0.38 : 1.3));

  const energyDistance = Math.abs(overallEnergy - state.energyBaseline);
  const energyRise = Math.max(0, overallEnergy - state.previousEnergy);
  const energyScale = Math.max(0.009, state.energyDeviation * 1.05);
  const energyProminence = Math.max(0, (overallEnergy - state.energyBaseline) / energyScale);
  const riseProminence = energyRise / Math.max(0.006, state.energyDeviation * 0.55);
  const energyRate = overallEnergy > state.energyBaseline ? 0.34 : 1.7;
  state.energyBaseline += (overallEnergy - state.energyBaseline) * (1 - Math.exp(-deltaSeconds * energyRate));
  state.energyDeviation += (energyDistance - state.energyDeviation) * (1 - Math.exp(-deltaSeconds * 1.25));
  state.previousEnergy = overallEnergy;
  state.lastAccepted = false;

  if (!playing || !onset.detected) return snapshot(state, false, 0, false);

  const eventSignal = onset.strength * 0.48 + onset.lowStrength * 0.36 + onset.highStrength * 0.16;
  const eventScale = Math.max(0.022, state.prominenceDeviation * 1.05);
  const eventProminence = Math.max(0, (eventSignal - state.prominenceBaseline) / eventScale);
  const lowProminence = Math.max(0, (onset.lowStrength - state.prominenceBaseline * 0.78) / eventScale);
  const prominence = Math.min(2.5,
    eventProminence * 0.5
      + Math.min(2.2, riseProminence) * 0.24
      + Math.min(2.2, energyProminence) * 0.16
      + Math.min(2.2, lowProminence) * 0.1,
  );
  const threshold = Math.min(0.92, Math.max(0.48, 0.62 + state.prominenceDeviation * 1.8 - state.confidence * 0.1));
  const interval = now - state.lastMajorBeatAt;
  const recovered = interval >= MAJOR_BEAT_RECOVERY_MS;
  const periodicSupport = state.expectedInterval > 0
    ? Math.exp(-Math.pow((interval - state.expectedInterval) / Math.max(135, state.expectedInterval * 0.44), 2))
    : 0;
  const clearlyStrongLocalPeak = prominence >= threshold
    && (eventProminence > 1.02 || lowProminence > 0.94)
    && (riseProminence > 0.34 || energyProminence > 0.46 || lowProminence > 0.92);
  const overwhelmingPeak = prominence > threshold + 0.52
    && (eventProminence > 1.2 || lowProminence > 1.3);
  const fastPath = clearlyStrongLocalPeak || overwhelmingPeak;
  const supportedPulse = state.confidence > 0.16
    && periodicSupport > 0.2
    && prominence > threshold * 0.7
    && (eventProminence > 0.34 || lowProminence > 0.48);
  const detected = recovered && overallEnergy > 0.006 && (fastPath || supportedPulse);

  const eventDistance = Math.abs(eventSignal - state.prominenceBaseline);
  const baselineRate = eventSignal > state.prominenceBaseline ? 0.09 : 0.18;
  state.prominenceBaseline += (eventSignal - state.prominenceBaseline) * baselineRate;
  state.prominenceDeviation += (eventDistance - state.prominenceDeviation) * 0.12;
  state.lastProminence = prominence;
  state.lastThreshold = threshold;
  state.lastPeriodicSupport = periodicSupport;

  if (!detected) return snapshot(state, false, 0, fastPath);
  if (Number.isFinite(state.lastMajorBeatAt) && interval >= MAJOR_BEAT_RECOVERY_MS && interval <= 1800) {
    state.expectedInterval = state.expectedInterval > 0
      ? state.expectedInterval * 0.7 + interval * 0.3
      : interval;
  }
  state.lastMajorBeatAt = now;
  state.lastAccepted = true;
  const strength = clamp01(0.48 + prominence * 0.34 + onset.lowStrength * 0.22);
  state.confidence = clamp01(state.confidence + 0.2 + periodicSupport * 0.2 + Math.min(1, prominence) * 0.12);
  return snapshot(state, true, strength, fastPath);
}

function snapshot(state: MajorBeatGateState, detected: boolean, strength: number, fastPath: boolean): MajorBeatEvent {
  return {
    detected,
    strength,
    confidence: clamp01(state.confidence),
    prominence: state.lastProminence,
    threshold: state.lastThreshold,
    periodicSupport: state.lastPeriodicSupport,
    fastPath,
  };
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}
