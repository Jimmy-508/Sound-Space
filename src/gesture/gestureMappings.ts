import { WAVE_FREQUENCY_MAX, WAVE_FREQUENCY_MIN } from '../spirit/soundSpiritIdentity';
import type { DirectionLock, TwoHandGesture } from './interactionController';

export function mapWaveAmplitude(current: number, deltaY: number) {
  return Math.min(1, Math.max(0, current - deltaY * 3.2));
}

export function mapWaveFrequency(current: number, gesture: TwoHandGesture, rate: number, maximum = WAVE_FREQUENCY_MAX) {
  if (gesture === 'none') return current;
  const direction = gesture === 'close' ? 1 : -1;
  const next = Math.round(current * Math.exp(direction * rate * 2.4) / 10) * 10;
  return Math.min(maximum, Math.max(WAVE_FREQUENCY_MIN, next));
}

export class DiscreteGestureAccumulator {
  private value = 0;

  update(delta: number, threshold = 0.035) {
    this.value += delta;
    if (Math.abs(this.value) < threshold) return 0;
    const direction = Math.sign(this.value);
    this.value = 0;
    return direction;
  }

  reset() {
    this.value = 0;
  }
}

export function resolveSamplingGesture(
  tab: 'sample' | 'quantize' | 'size',
  axis: DirectionLock,
  selectedControl: string | null,
) {
  if (axis === 'y') return tab === 'size' ? 'scroll' : 'none';
  if (axis !== 'x') return 'none';
  if (tab === 'sample') return 'sample-rate';
  if (tab === 'quantize') return 'quantize-depth';
  return selectedControl ?? 'none';
}
