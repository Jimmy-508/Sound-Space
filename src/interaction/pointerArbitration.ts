import type { WorldInputSource } from './worldInteraction';
import { worldInteractionThresholds } from './worldInteraction';

export type PointerIntentState = 'pending' | 'drag' | 'attraction';

export interface PointerIntent {
  source: Extract<WorldInputSource, 'mouse' | 'touch'>;
  state: PointerIntentState;
  startX: number;
  startY: number;
  x: number;
  y: number;
  worldX: number;
  worldY: number;
  startedAt: number;
}

export function movementTolerance(source: PointerIntent['source']) {
  return source === 'touch' ? worldInteractionThresholds.touchHoldMovementPx : worldInteractionThresholds.mouseHoldMovementPx;
}

export function attractionCancelTolerance(source: PointerIntent['source']) {
  return source === 'touch' ? worldInteractionThresholds.attractionCancelTouchPx : worldInteractionThresholds.attractionCancelMousePx;
}

export function updatePointerIntent(intent: PointerIntent, x: number, y: number) {
  intent.x = x;
  intent.y = y;
  const distance = Math.hypot(x - intent.startX, y - intent.startY);
  if (intent.state === 'pending' && distance > movementTolerance(intent.source)) intent.state = 'drag';
  else if (intent.state === 'attraction' && distance > attractionCancelTolerance(intent.source)) intent.state = 'drag';
  return intent.state;
}

export class TouchSessionArbiter {
  private activePointers = new Set<number>();
  private pinchLocked = false;

  begin(pointerId: number) {
    this.activePointers.add(pointerId);
    const enteredPinch = this.activePointers.size >= 2 && !this.pinchLocked;
    if (this.activePointers.size >= 2) this.pinchLocked = true;
    return { enteredPinch, pinchLocked: this.pinchLocked, activeCount: this.activePointers.size };
  }

  release(pointerId: number) {
    this.activePointers.delete(pointerId);
    if (this.activePointers.size === 0) this.pinchLocked = false;
    return { pinchLocked: this.pinchLocked, activeCount: this.activePointers.size };
  }

  canArmAttraction() {
    return !this.pinchLocked && this.activePointers.size <= 1;
  }

  isPinchLocked() {
    return this.pinchLocked;
  }

  reset() {
    this.activePointers.clear();
    this.pinchLocked = false;
  }
}

export function cancelTouchIntentsForPinch(intents: Map<number, PointerIntent>) {
  let cancelledAttraction = false;
  for (const [pointerId, candidate] of intents) {
    if (candidate.source !== 'touch') continue;
    if (candidate.state === 'attraction') cancelledAttraction = true;
    intents.delete(pointerId);
  }
  return cancelledAttraction;
}

interface TapCandidate {
  count: number;
  x: number;
  y: number;
  lastAt: number;
  doubleDueAt: number;
}

export class TapSequenceArbiter {
  private candidates = new Map<Extract<WorldInputSource, 'mouse' | 'touch'>, TapCandidate>();

  tap(source: Extract<WorldInputSource, 'mouse' | 'touch'>, x: number, y: number, timestamp: number) {
    const previous = this.candidates.get(source);
    const related = previous
      && timestamp - previous.lastAt <= worldInteractionThresholds.doubleTapMs
      && Math.hypot(x - previous.x, y - previous.y) <= worldInteractionThresholds.doubleTapDistancePx;
    const count = related ? previous.count + 1 : 1;
    if (count >= 3) {
      this.candidates.delete(source);
      return 'triple' as const;
    }
    this.candidates.set(source, {
      count,
      x,
      y,
      lastAt: timestamp,
      doubleDueAt: count === 2 ? timestamp + worldInteractionThresholds.tripleTapGraceMs : Infinity,
    });
    return count === 2 ? 'double-pending' as const : 'single' as const;
  }

  consumeDue(source: Extract<WorldInputSource, 'mouse' | 'touch'>, timestamp: number) {
    const candidate = this.candidates.get(source);
    if (!candidate || candidate.count !== 2 || timestamp < candidate.doubleDueAt) return undefined;
    this.candidates.delete(source);
    return { x: candidate.x, y: candidate.y };
  }

  clear(source?: Extract<WorldInputSource, 'mouse' | 'touch'>) {
    if (source) this.candidates.delete(source);
    else this.candidates.clear();
  }
}
