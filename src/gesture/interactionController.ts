import type { GestureFrame, GestureFrameStore, GesturePoint, TrackedHand } from './types';

const POINTER_HOLD_MS = 300;
const TWO_HAND_HOLD_MS = 170;
const TWO_HAND_DEAD_ZONE = 0.0032;
const HAND_MOTION_THRESHOLD = 0.0014;
const FIST_DEAD_ZONE = 0.026;
const AXIS_DOMINANCE = 1.28;
const EXPLOSION_WINDOW_MS = 520;
const EXPLOSION_COOLDOWN_MS = 950;
const OPEN_ARM_STABLE_MS = 220;
const OPEN_ARM_WINDOW_MS = 1800;
const FIST_CHARGE_STABLE_MS = 120;
const SWEEP_COOLDOWN_AFTER_EXPLOSION_MS = 720;
const SWEEP_SPEED_THRESHOLD = 0.32;

export type DirectionLock = 'none' | 'x' | 'y';
export type TwoHandGesture = 'none' | 'spread' | 'close';

export interface GestureInteractionState {
  pointer?: { handId: number; point: GesturePoint };
  fist?: { handId: number; point: GesturePoint; deltaX: number; deltaY: number; axis: DirectionLock };
  twoHand: { gesture: TwoHandGesture; rate: number; center: GesturePoint };
  dwellProgress: number;
  dwellActive: boolean;
  dwellSuccessAt: number;
  timestamp: number;
}

export type GestureInteractionEvent =
  | {
    type: 'sweep';
    handId: number;
    point: GesturePoint;
    landmarks: readonly GesturePoint[];
    previousLandmarks: readonly GesturePoint[];
    velocityX: number;
    velocityY: number;
    speed: number;
    turnIntensity: number;
    timestamp: number;
  }
  | { type: 'explosion'; handId: number; point: GesturePoint; timestamp: number };

interface FistSession {
  handId: number;
  anchor: GesturePoint;
  last: GesturePoint;
  axis: DirectionLock;
}

interface OpenMotion {
  point: GesturePoint;
  landmarks: GesturePoint[];
  velocityX: number;
  velocityY: number;
  timestamp: number;
  lastEmission: number;
}

type ExplosionStage = 'openCandidate' | 'openArmed' | 'fistCandidate' | 'fistCharged' | 'blockedOpen' | 'cooldown';

interface ExplosionSequence {
  stage: ExplosionStage;
  since: number;
  deadline: number;
  leftOpen: boolean;
}

const copyLandmarks = (landmarks: readonly GesturePoint[]) => landmarks.map((point) => ({ ...point }));

const emptyState = (): GestureInteractionState => ({
  twoHand: { gesture: 'none', rate: 0, center: { x: 0.5, y: 0.5, z: 0 } },
  dwellProgress: 0,
  dwellActive: false,
  dwellSuccessAt: -Infinity,
  timestamp: 0,
});

const palmCenter = (hand: TrackedHand): GesturePoint => {
  const indices = [0, 5, 9, 13, 17];
  return indices.reduce((center, index) => ({
    x: center.x + hand.landmarks[index].x / indices.length,
    y: center.y + hand.landmarks[index].y / indices.length,
    z: center.z + hand.landmarks[index].z / indices.length,
  }), { x: 0, y: 0, z: 0 });
};

const distance = (a: GesturePoint, b: GesturePoint) => Math.hypot(a.x - b.x, a.y - b.y);

export function isPalmFacingCamera(hand: TrackedHand) {
  if (hand.landmarks.length < 18) return false;
  const palmWidth = distance(hand.landmarks[5], hand.landmarks[17]);
  const palmHeight = distance(hand.landmarks[0], hand.landmarks[9]);
  const zSpread = Math.abs(hand.landmarks[9].z - hand.landmarks[0].z);
  return palmWidth > 0.045 && palmHeight > 0.055 && zSpread < 0.12;
}

export function getPalmSide(hand: TrackedHand) {
  if (hand.landmarks.length < 18) return 0;
  const dx = hand.landmarks[5].x - hand.landmarks[17].x;
  const dy = hand.landmarks[5].y - hand.landmarks[17].y;
  return dx / Math.max(0.0001, Math.hypot(dx, dy));
}

export class GestureInteractionController {
  private state = emptyState();
  private enabled = false;
  private frameRequest = 0;
  private lastFrameTimestamp = -1;
  private pointerCandidate?: { handId: number; since: number };
  private fistSession?: FistSession;
  private openMotion = new Map<number, OpenMotion>();
  private explosionSequences = new Map<number, ExplosionSequence>();
  private lastExplosionAt = -Infinity;
  private listeners = new Set<(event: GestureInteractionEvent) => void>();
  private twoHandPose: 'none' | 'palmsForward' | 'palmsFacing' = 'none';
  private twoHandPoseSince = 0;
  private twoHandSession: TwoHandGesture = 'none';
  private twoHandDistance?: number;
  private twoHandCenters = new Map<number, GesturePoint>();
  private smoothedTwoHandRate = 0;

  constructor(private readonly frames: GestureFrameStore) {}

  start() {
    if (this.frameRequest) return;
    this.frameRequest = requestAnimationFrame(this.tick);
  }

  stop() {
    cancelAnimationFrame(this.frameRequest);
    this.frameRequest = 0;
    this.reset();
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) this.reset();
  }

  read() {
    return this.state;
  }

  subscribe(listener: (event: GestureInteractionEvent) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setDwell(active: boolean, progress: number) {
    this.state.dwellActive = active;
    this.state.dwellProgress = Math.min(1, Math.max(0, progress));
  }

  flashDwellSuccess(now: number) {
    this.state.dwellSuccessAt = now;
  }

  update(frame: GestureFrame, now: number, enabled = this.enabled) {
    if (!enabled) {
      this.reset();
      return this.state;
    }

    const hands = frame.hands.filter((hand) => hand.lostOpacity > 0.45);
    const openHands = hands.filter((hand) => hand.gesture === 'openPalm').sort((a, b) => palmCenter(a).x - palmCenter(b).x);
    const twoHand = openHands.length >= 2 ? this.updateTwoHand(openHands.slice(0, 2), now) : this.clearTwoHand();
    let pointer: GestureInteractionState['pointer'];
    let fist: GestureInteractionState['fist'];

    if (twoHand.gesture !== 'none') {
      this.pointerCandidate = undefined;
      this.fistSession = undefined;
      this.explosionSequences.clear();
    } else {
      pointer = this.updatePointer(hands, now);
      fist = pointer ? undefined : this.updateFist(hands, now);
      this.updateOpenActions(hands, now);
    }

    this.state = {
      ...this.state,
      pointer,
      fist,
      twoHand,
      timestamp: frame.timestamp,
    };
    return this.state;
  }

  reset() {
    this.lastFrameTimestamp = -1;
    this.pointerCandidate = undefined;
    this.fistSession = undefined;
    this.openMotion.clear();
    this.explosionSequences.clear();
    this.clearTwoHand();
    this.state = emptyState();
  }

  private tick = () => {
    this.frameRequest = requestAnimationFrame(this.tick);
    if (!this.enabled) return;
    const frame = this.frames.read();
    if (!frame.timestamp || frame.timestamp === this.lastFrameTimestamp) return;
    this.lastFrameTimestamp = frame.timestamp;
    this.update(frame, performance.now());
  };

  private updatePointer(hands: TrackedHand[], now: number) {
    const hand = hands.find((candidate) => candidate.gesture === 'pointing');
    if (!hand) {
      this.pointerCandidate = undefined;
      return undefined;
    }
    if (this.pointerCandidate?.handId !== hand.id) {
      this.pointerCandidate = { handId: hand.id, since: now };
      return undefined;
    }
    if (now - this.pointerCandidate.since < POINTER_HOLD_MS) return undefined;
    return { handId: hand.id, point: hand.landmarks[8] };
  }

  private updateFist(hands: TrackedHand[], now: number) {
    const hand = hands.find((candidate) => candidate.gesture === 'fist');
    if (!hand) {
      this.fistSession = undefined;
      return undefined;
    }
    const center = palmCenter(hand);
    if (!this.fistSession || this.fistSession.handId !== hand.id) {
      this.fistSession = { handId: hand.id, anchor: center, last: center, axis: 'none' };
      return { handId: hand.id, point: center, deltaX: 0, deltaY: 0, axis: 'none' as const };
    }
    const session = this.fistSession;
    const anchorX = center.x - session.anchor.x;
    const anchorY = center.y - session.anchor.y;
    if (session.axis === 'none' && Math.hypot(anchorX, anchorY) >= FIST_DEAD_ZONE) {
      if (Math.abs(anchorX) > Math.abs(anchorY) * AXIS_DOMINANCE) session.axis = 'x';
      if (Math.abs(anchorY) > Math.abs(anchorX) * AXIS_DOMINANCE) session.axis = 'y';
    }
    const deltaX = session.axis === 'x' ? center.x - session.last.x : 0;
    const deltaY = session.axis === 'y' ? center.y - session.last.y : 0;
    session.last = center;
    return { handId: hand.id, point: center, deltaX, deltaY, axis: session.axis };
  }

  private updateOpenActions(hands: TrackedHand[], now: number) {
    const visibleIds = new Set(hands.map((hand) => hand.id));
    this.updateExplosionSequences(hands, now);
    for (const hand of hands) {
      if (hand.gesture !== 'openPalm') {
        if (hand.gesture !== 'fist') this.openMotion.delete(hand.id);
        continue;
      }
      const center = palmCenter(hand);
      const previous = this.openMotion.get(hand.id);
      if (!previous) {
        this.openMotion.set(hand.id, { point: center, landmarks: copyLandmarks(hand.landmarks), velocityX: 0, velocityY: 0, timestamp: now, lastEmission: -Infinity });
        continue;
      }
      const elapsed = Math.max(0.008, (now - previous.timestamp) / 1000);
      const velocityX = (center.x - previous.point.x) / elapsed;
      const velocityY = (center.y - previous.point.y) / elapsed;
      const speed = Math.hypot(velocityX, velocityY);
      const turnIntensity = Math.min(1, Math.hypot(velocityX - previous.velocityX, velocityY - previous.velocityY) / 1.4);
      const canEmit = now - this.lastExplosionAt >= SWEEP_COOLDOWN_AFTER_EXPLOSION_MS && now - previous.lastEmission >= 42;
      if (speed >= SWEEP_SPEED_THRESHOLD && canEmit) {
        previous.lastEmission = now;
        this.emit({
          type: 'sweep',
          handId: hand.id,
          point: center,
          landmarks: copyLandmarks(hand.landmarks),
          previousLandmarks: previous.landmarks,
          velocityX,
          velocityY,
          speed,
          turnIntensity,
          timestamp: now,
        });
      }
      previous.point = center;
      previous.landmarks = copyLandmarks(hand.landmarks);
      previous.velocityX = velocityX;
      previous.velocityY = velocityY;
      previous.timestamp = now;
    }
    for (const id of this.openMotion.keys()) if (!visibleIds.has(id)) this.openMotion.delete(id);
    for (const id of this.explosionSequences.keys()) if (!visibleIds.has(id)) this.explosionSequences.delete(id);
  }

  private updateExplosionSequences(hands: TrackedHand[], now: number) {
    for (const hand of hands) {
      const gesture = hand.gesture;
      const sequence = this.explosionSequences.get(hand.id);
      if (!sequence) {
        if (gesture === 'openPalm' && now - this.lastExplosionAt >= EXPLOSION_COOLDOWN_MS) {
          this.explosionSequences.set(hand.id, { stage: 'openCandidate', since: now, deadline: now + OPEN_ARM_STABLE_MS, leftOpen: false });
        }
        continue;
      }

      if (sequence.stage === 'cooldown' || sequence.stage === 'blockedOpen') {
        if (gesture !== 'openPalm') sequence.leftOpen = true;
        if (sequence.leftOpen && now >= sequence.deadline) this.explosionSequences.delete(hand.id);
        continue;
      }

      if (sequence.stage === 'openCandidate') {
        if (gesture !== 'openPalm') {
          this.explosionSequences.delete(hand.id);
        } else if (now >= sequence.deadline) {
          sequence.stage = 'openArmed';
          sequence.since = now;
          sequence.deadline = now + OPEN_ARM_WINDOW_MS;
        }
        continue;
      }

      if (sequence.stage === 'openArmed') {
        if (now > sequence.deadline || (gesture !== 'openPalm' && gesture !== 'fist')) {
          this.explosionSequences.delete(hand.id);
        } else if (gesture === 'fist') {
          sequence.stage = 'fistCandidate';
          sequence.since = now;
          sequence.deadline = now + FIST_CHARGE_STABLE_MS;
        }
        continue;
      }

      if (sequence.stage === 'fistCandidate') {
        if (gesture !== 'fist') {
          this.explosionSequences.delete(hand.id);
        } else if (now >= sequence.deadline) {
          sequence.stage = 'fistCharged';
          sequence.since = now;
          sequence.deadline = now + EXPLOSION_WINDOW_MS;
        }
        continue;
      }

      if (now > sequence.deadline) {
        sequence.stage = 'blockedOpen';
        sequence.deadline = now;
        sequence.leftOpen = gesture !== 'openPalm';
        continue;
      }
      if (gesture !== 'openPalm') {
        if (gesture !== 'fist') this.explosionSequences.delete(hand.id);
        continue;
      }
      if (now - this.lastExplosionAt < EXPLOSION_COOLDOWN_MS) continue;
      const center = palmCenter(hand);
      this.lastExplosionAt = now;
      this.openMotion.set(hand.id, { point: center, landmarks: copyLandmarks(hand.landmarks), velocityX: 0, velocityY: 0, timestamp: now, lastEmission: now });
      this.emit({ type: 'explosion', handId: hand.id, point: center, timestamp: now });
      sequence.stage = 'cooldown';
      sequence.since = now;
      sequence.deadline = now + EXPLOSION_COOLDOWN_MS;
      sequence.leftOpen = false;
    }
  }

  private updateTwoHand(hands: TrackedHand[], now: number) {
    const centers = hands.map(palmCenter);
    const palmsForward = hands.every(isPalmFacingCamera);
    const palmSides = hands.map(getPalmSide);
    const oppositeSides = Math.sign(palmSides[0]) !== Math.sign(palmSides[1]);
    const inwardTolerance = palmSides.every((side) => Math.abs(side) <= 0.22);
    const pose = palmsForward ? 'palmsForward' : oppositeSides || inwardTolerance ? 'palmsFacing' : 'none';
    const center = { x: (centers[0].x + centers[1].x) / 2, y: (centers[0].y + centers[1].y) / 2, z: 0 };
    const currentDistance = distance(centers[0], centers[1]);

    if (pose === 'none') return this.clearTwoHand(center);
    if (pose !== this.twoHandPose) {
      this.twoHandPose = pose;
      this.twoHandPoseSince = now;
      this.twoHandSession = 'none';
      this.twoHandDistance = currentDistance;
      this.twoHandCenters.set(hands[0].id, centers[0]);
      this.twoHandCenters.set(hands[1].id, centers[1]);
      return { gesture: 'none' as const, rate: 0, center };
    }

    const previousDistance = this.twoHandDistance ?? currentDistance;
    const distanceDelta = currentDistance - previousDistance;
    const leftPrevious = this.twoHandCenters.get(hands[0].id) ?? centers[0];
    const rightPrevious = this.twoHandCenters.get(hands[1].id) ?? centers[1];
    const leftDeltaX = centers[0].x - leftPrevious.x;
    const rightDeltaX = centers[1].x - rightPrevious.x;
    this.twoHandDistance = currentDistance;
    this.twoHandCenters.set(hands[0].id, centers[0]);
    this.twoHandCenters.set(hands[1].id, centers[1]);

    if (now - this.twoHandPoseSince < TWO_HAND_HOLD_MS) return { gesture: 'none' as const, rate: 0, center };
    if (this.twoHandSession === 'none') {
      const separating = distanceDelta > TWO_HAND_DEAD_ZONE && leftDeltaX < -HAND_MOTION_THRESHOLD && rightDeltaX > HAND_MOTION_THRESHOLD;
      const approaching = distanceDelta < -TWO_HAND_DEAD_ZONE * 0.82
        && (leftDeltaX > HAND_MOTION_THRESHOLD * 0.55 || rightDeltaX < -HAND_MOTION_THRESHOLD * 0.55);
      if (pose === 'palmsForward' && separating) this.twoHandSession = 'spread';
      if (pose === 'palmsFacing' && approaching) this.twoHandSession = 'close';
    }

    if (this.twoHandSession === 'spread' && (pose !== 'palmsForward' || distanceDelta < -TWO_HAND_DEAD_ZONE * 1.35)) this.twoHandSession = 'none';
    if (this.twoHandSession === 'close' && (pose !== 'palmsFacing' || distanceDelta > TWO_HAND_DEAD_ZONE * 1.35)) this.twoHandSession = 'none';
    const rawRate = this.twoHandSession === 'spread'
      ? 0.0028 + Math.min(1, Math.max(0, (currentDistance - 0.22) / 0.48)) * 0.0105
      : this.twoHandSession === 'close'
        ? 0.0028 + Math.min(1, Math.max(0, (0.74 - currentDistance) / 0.52)) * 0.0115
        : 0;
    this.smoothedTwoHandRate += (rawRate - this.smoothedTwoHandRate) * 0.34;
    return { gesture: this.twoHandSession, rate: this.smoothedTwoHandRate, center };
  }

  private clearTwoHand(center = { x: 0.5, y: 0.5, z: 0 }) {
    this.twoHandPose = 'none';
    this.twoHandPoseSince = 0;
    this.twoHandSession = 'none';
    this.twoHandDistance = undefined;
    this.twoHandCenters.clear();
    this.smoothedTwoHandRate = 0;
    return { gesture: 'none' as const, rate: 0, center };
  }

  private emit(event: GestureInteractionEvent) {
    for (const listener of this.listeners) listener(event);
  }
}

export const gestureThresholds = {
  dwellMs: 720,
  dwellCooldownMs: 1000,
  fistDeadZone: FIST_DEAD_ZONE,
  explosionWindowMs: EXPLOSION_WINDOW_MS,
  explosionCooldownMs: EXPLOSION_COOLDOWN_MS,
  openArmStableMs: OPEN_ARM_STABLE_MS,
  openArmWindowMs: OPEN_ARM_WINDOW_MS,
  fistChargeStableMs: FIST_CHARGE_STABLE_MS,
};
