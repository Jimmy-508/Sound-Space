export const MUSICAL_HEART_ATTACK_SECONDS = 0.045;
export const MUSICAL_HEART_MINIMUM_LEAD_SECONDS = 0.052;
export const MUSICAL_HEART_CAPTURE_WINDOW_SECONDS = 0.62;
export const MUSICAL_HEART_LATE_TOLERANCE_SECONDS = 0.06;

export interface BeatMapClockState {
  nextIndex: number;
  lastPlaybackTime: number;
}

export interface BeatMapClockFrame {
  nextIndex: number;
  nextBeatTime: number;
  musicalControlActive: boolean;
  pulse: null | {
    beatTime: number;
    attackTime: number;
    attackAge: number;
  };
}

export function createBeatMapClockState(): BeatMapClockState {
  return { nextIndex: 0, lastPlaybackTime: 0 };
}

export function resetBeatMapClock(
  state: BeatMapClockState,
  timestamps: Float32Array,
  playbackTime: number,
  minimumLead = MUSICAL_HEART_MINIMUM_LEAD_SECONDS,
) {
  state.nextIndex = lowerBound(timestamps, Math.max(0, playbackTime) + minimumLead);
  state.lastPlaybackTime = Math.max(0, playbackTime);
}

export function advanceBeatMapClock(
  state: BeatMapClockState,
  timestamps: Float32Array,
  playbackTime: number,
  playing: boolean,
  suspended = false,
): BeatMapClockFrame {
  const currentTime = Math.max(0, playbackTime);
  if (!playing || suspended || !timestamps.length) {
    state.lastPlaybackTime = currentTime;
    return frameFor(state, timestamps, currentTime, null, false);
  }

  if (currentTime + 0.05 < state.lastPlaybackTime || currentTime - state.lastPlaybackTime > 0.35) {
    resetBeatMapClock(state, timestamps, currentTime);
  }
  state.lastPlaybackTime = currentTime;

  while (state.nextIndex < timestamps.length) {
    const beatTime = timestamps[state.nextIndex];
    const attackTime = beatTime - MUSICAL_HEART_ATTACK_SECONDS;
    if (currentTime < attackTime) return frameFor(state, timestamps, currentTime, null, beatTime - currentTime <= MUSICAL_HEART_CAPTURE_WINDOW_SECONDS);
    state.nextIndex += 1;
    if (currentTime <= beatTime + MUSICAL_HEART_LATE_TOLERANCE_SECONDS) {
      return frameFor(state, timestamps, currentTime, {
        beatTime,
        attackTime,
        attackAge: Math.max(0, currentTime - attackTime),
      }, true);
    }
  }

  return frameFor(state, timestamps, currentTime, null, false);
}

export function lowerBound(values: Float32Array, target: number) {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (values[middle] < target) low = middle + 1;
    else high = middle;
  }
  return low;
}

export function sampleHeartContractionEnvelope(age: number, release = 0.33) {
  const end = 0.075 + release;
  if (age <= 0 || age >= end) return 0;
  if (age < MUSICAL_HEART_ATTACK_SECONDS) return smoothstep(0, MUSICAL_HEART_ATTACK_SECONDS, age);
  if (age < 0.075) return 1;
  return 1 - smoothstep(0.075, end, age);
}

function frameFor(
  state: BeatMapClockState,
  timestamps: Float32Array,
  _playbackTime: number,
  pulse: BeatMapClockFrame['pulse'],
  musicalControlActive: boolean,
): BeatMapClockFrame {
  const nextBeatTime = state.nextIndex < timestamps.length ? timestamps[state.nextIndex] : -1;
  return {
    nextIndex: state.nextIndex,
    nextBeatTime,
    musicalControlActive,
    pulse,
  };
}

function smoothstep(start: number, end: number, value: number) {
  const progress = Math.min(1, Math.max(0, (value - start) / Math.max(0.000001, end - start)));
  return progress * progress * (3 - 2 * progress);
}
