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
    producerId?: number | string;
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
    producerId?: number | string;
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
  private disturbanceEnabled = true;
  private pendingDisturbances = new Map<string, Extract<WorldInteractionEvent, { type: 'disturbance' }>>();
  private pendingFrame = 0;
  private inputEvents = 0;
  private consumedEvents = 0;

  constructor(private readonly scheduleFrame: (callback: FrameRequestCallback) => number = (callback) => {
    if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(callback);
    return setTimeout(() => callback(performance.now()), 16) as unknown as number;
  }) {}

  subscribe(listener: (event: WorldInteractionEvent) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  disturb(event: Extract<WorldInteractionEvent, { type: 'disturbance' }>) {
    if (!this.disturbanceEnabled || event.speed <= 0) return;
    this.inputEvents += 1;
    if (event.source === 'gesture') {
      this.consumedEvents += 1;
      this.emit(event);
      return;
    }
    const key = `${event.source}:${event.producerId ?? 'primary'}`;
    const previous = this.pendingDisturbances.get(key);
    this.pendingDisturbances.set(key, previous
      ? {
        ...event,
        previousPoint: previous.previousPoint,
        ...(event.geometry === 'hand' && previous.geometry === 'hand'
          ? { previousLandmarks: previous.previousLandmarks }
          : {}),
      } as Extract<WorldInteractionEvent, { type: 'disturbance' }>
      : event);
    if (!this.pendingFrame) this.pendingFrame = this.scheduleFrame(() => this.flushDisturbances());
  }

  setDisturbanceEnabled(enabled: boolean) {
    this.disturbanceEnabled = enabled;
    if (!enabled) this.pendingDisturbances.clear();
  }

  flushDisturbances() {
    this.pendingFrame = 0;
    if (!this.disturbanceEnabled) {
      this.pendingDisturbances.clear();
      return;
    }
    for (const event of this.pendingDisturbances.values()) {
      this.consumedEvents += 1;
      this.emit(event);
    }
    this.pendingDisturbances.clear();
  }

  getPerformanceSnapshot() {
    return {
      inputEvents: this.inputEvents,
      consumedEvents: this.consumedEvents,
      pendingEvents: this.pendingDisturbances.size,
    };
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
    if (source) {
      this.attractions.delete(source);
      for (const key of this.pendingDisturbances.keys()) {
        if (key.startsWith(`${source}:`)) this.pendingDisturbances.delete(key);
      }
    } else {
      this.attractions.clear();
      this.pendingDisturbances.clear();
    }
  }

  private emit(event: WorldInteractionEvent) {
    for (const listener of this.listeners) listener(event);
  }
}

export const worldInteractionThresholds = {
  pulseCooldownMs: PULSE_COOLDOWN_MS,
  holdMs: 450,
  mouseHoldMovementPx: 9,
  touchHoldMovementPx: 22,
  attractionCancelMousePx: 14,
  attractionCancelTouchPx: 36,
  doubleTapMs: 340,
  tripleTapGraceMs: 340,
  doubleTapDistancePx: 34,
  tapDurationMs: 320,
};
