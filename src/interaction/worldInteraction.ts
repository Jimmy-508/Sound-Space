import type { GesturePoint } from '../gesture/types';

export type WorldInputSource = 'gesture' | 'mouse' | 'touch';

export type WorldInteractionEvent =
  | {
    type: 'disturbance';
    source: WorldInputSource;
    geometry: 'hand';
    point: GesturePoint;
    previousPoint: GesturePoint;
    landmarks: readonly GesturePoint[];
    previousLandmarks: readonly GesturePoint[];
    velocityX: number;
    velocityY: number;
    speed: number;
    turnIntensity: number;
    timestamp: number;
  }
  | {
    type: 'disturbance';
    source: WorldInputSource;
    geometry: 'pointer';
    point: GesturePoint;
    previousPoint: GesturePoint;
    velocityX: number;
    velocityY: number;
    speed: number;
    turnIntensity: number;
    timestamp: number;
  }
  | { type: 'pulse'; source: WorldInputSource; point: GesturePoint; timestamp: number };

export interface WorldAttractionState {
  source: WorldInputSource;
  point: GesturePoint;
  active: boolean;
  updatedAt: number;
}

const PULSE_COOLDOWN_MS = 950;

export class WorldInteractionController {
  private listeners = new Set<(event: WorldInteractionEvent) => void>();
  private attractions = new Map<WorldInputSource, WorldAttractionState>();
  private lastPulseAt = -Infinity;

  subscribe(listener: (event: WorldInteractionEvent) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  disturb(event: Extract<WorldInteractionEvent, { type: 'disturbance' }>) {
    if (event.speed <= 0) return;
    this.emit(event);
  }

  pulse(source: WorldInputSource, point: GesturePoint, timestamp: number) {
    if (timestamp - this.lastPulseAt < PULSE_COOLDOWN_MS) return false;
    this.lastPulseAt = timestamp;
    this.emit({ type: 'pulse', source, point, timestamp });
    return true;
  }

  setAttraction(source: WorldInputSource, point: GesturePoint, active: boolean, timestamp: number) {
    if (!active) {
      this.attractions.delete(source);
      return;
    }
    this.attractions.set(source, { source, point, active: true, updatedAt: timestamp });
  }

  readAttraction() {
    let current: WorldAttractionState | undefined;
    for (const attraction of this.attractions.values()) {
      if (!current || attraction.updatedAt > current.updatedAt) current = attraction;
    }
    return current;
  }

  clear(source?: WorldInputSource) {
    if (source) this.attractions.delete(source);
    else this.attractions.clear();
  }

  private emit(event: WorldInteractionEvent) {
    for (const listener of this.listeners) listener(event);
  }
}

export const worldInteractionThresholds = {
  pulseCooldownMs: PULSE_COOLDOWN_MS,
  holdMs: 450,
  holdMovementPx: 9,
  doubleTapMs: 340,
  doubleTapDistancePx: 34,
  tapDurationMs: 320,
};
