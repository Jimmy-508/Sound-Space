import { WAVE_FREQUENCY_MAX, WAVE_FREQUENCY_MIN } from '../spirit/soundSpiritIdentity';

export const DEVICE_FRIENDLY_WAVE_FREQUENCY_MAX = 1200;

export function getEffectiveWaveFrequencyMax(deviceFriendlyEnabled: boolean) {
  return deviceFriendlyEnabled ? DEVICE_FRIENDLY_WAVE_FREQUENCY_MAX : WAVE_FREQUENCY_MAX;
}

export function clampWaveFrequency(value: number, maximum: number) {
  if (!Number.isFinite(value)) return WAVE_FREQUENCY_MIN;
  return Math.min(maximum, Math.max(WAVE_FREQUENCY_MIN, value));
}

export function waveFrequencyToSlider(frequency: number, maximum: number, sliderMaximum: number) {
  const clamped = clampWaveFrequency(frequency, maximum);
  return Math.round(Math.log(clamped / WAVE_FREQUENCY_MIN) / Math.log(maximum / WAVE_FREQUENCY_MIN) * sliderMaximum);
}

export function waveSliderToFrequency(value: number, maximum: number, sliderMaximum: number) {
  const frequency = WAVE_FREQUENCY_MIN * (maximum / WAVE_FREQUENCY_MIN) ** (value / sliderMaximum);
  return clampWaveFrequency(Math.round(frequency / 10) * 10, maximum);
}
