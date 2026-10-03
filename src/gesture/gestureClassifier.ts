import type { GestureName, GesturePoint } from './types';

const distance = (a: GesturePoint, b: GesturePoint) => Math.hypot(a.x - b.x, a.y - b.y);

const isExtended = (points: GesturePoint[], tip: number, pip: number) => {
  const wrist = points[0];
  return distance(points[tip], wrist) > distance(points[pip], wrist) * 1.14;
};

export function classifyGesture(points: GesturePoint[]): GestureName {
  if (points.length !== 21) return 'none';

  const index = isExtended(points, 8, 6);
  const middle = isExtended(points, 12, 10);
  const ring = isExtended(points, 16, 14);
  const pinky = isExtended(points, 20, 18);
  const extendedCount = [index, middle, ring, pinky].filter(Boolean).length;

  if (extendedCount >= 4) return 'openPalm';
  if (index && !middle && !ring && !pinky) return 'pointing';
  if (extendedCount === 0) return 'fist';
  return 'none';
}

export class GestureStabilizer {
  private stable: GestureName = 'none';
  private candidate: GestureName = 'none';
  private candidateSince = 0;

  update(next: GestureName, timestamp: number) {
    if (next === this.stable) {
      this.candidate = next;
      this.candidateSince = timestamp;
      return this.stable;
    }

    if (next !== this.candidate) {
      this.candidate = next;
      this.candidateSince = timestamp;
      return this.stable;
    }

    const holdTime = next === 'none' ? 90 : 120;
    if (timestamp - this.candidateSince >= holdTime) this.stable = next;
    return this.stable;
  }
}
