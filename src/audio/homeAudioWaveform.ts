export const HOME_SFX_RELEASE_SECONDS = 0.42;
const homeSfxAttackSeconds = 0.026;
const homeSfxWindowSamples = 1024;

export function getHomeSfxBlend(elapsedSeconds: number, durationSeconds: number) {
  if (elapsedSeconds < 0 || durationSeconds <= 0) return 0;
  const attack = smoothstep(0, homeSfxAttackSeconds, elapsedSeconds);
  if (elapsedSeconds <= durationSeconds) return attack;
  return 1 - smoothstep(durationSeconds, durationSeconds + HOME_SFX_RELEASE_SECONDS, elapsedSeconds);
}

export function sampleHomeSfxWaveform(
  waveform: Float32Array,
  sampleRate: number,
  durationSeconds: number,
  elapsedSeconds: number,
  horizontalPosition: number,
) {
  if (!waveform.length || sampleRate <= 0 || durationSeconds <= 0) return 0;
  const windowSeconds = Math.min(durationSeconds, homeSfxWindowSamples / sampleRate);
  const halfWindow = windowSeconds * 0.5;
  const center = Math.min(
    Math.max(halfWindow, elapsedSeconds),
    Math.max(halfWindow, durationSeconds - halfWindow),
  );
  const sampleTime = Math.min(durationSeconds, Math.max(0, center + (horizontalPosition - 0.5) * windowSeconds));
  const position = Math.min(waveform.length - 1, sampleTime * sampleRate);
  const index = Math.floor(position);
  const next = Math.min(waveform.length - 1, index + 1);
  const mix = position - index;
  return waveform[index] * (1 - mix) + waveform[next] * mix;
}

export function mixHomeAudioWave(idle: number, music: number | null, sfx: number, sfxBlend: number) {
  if (music !== null) return music + sfx * sfxBlend * 0.2;
  const blend = Math.min(1, Math.max(0, sfxBlend)) * 0.9;
  return idle * (1 - blend) + sfx * blend;
}

function smoothstep(start: number, end: number, value: number) {
  const progress = Math.min(1, Math.max(0, (value - start) / Math.max(0.00001, end - start)));
  return progress * progress * (3 - 2 * progress);
}
