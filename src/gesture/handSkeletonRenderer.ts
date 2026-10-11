import { gesturePointToViewport } from './coordinateTransform';
import type { GesturePoint, TrackedHand } from './types';

export const HAND_LANDMARK_COUNT = 21;

export const HAND_SKELETON_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];

const FINGERTIPS = new Set([4, 8, 12, 16, 20]);

export function mapHandLandmarksToViewport(
  landmarks: readonly GesturePoint[],
  width: number,
  height: number,
  target: Float32Array = new Float32Array(HAND_LANDMARK_COUNT * 2),
) {
  if (landmarks.length !== HAND_LANDMARK_COUNT) {
    throw new RangeError(`Expected ${HAND_LANDMARK_COUNT} hand landmarks, received ${landmarks.length}.`);
  }
  if (target.length < HAND_LANDMARK_COUNT * 2) {
    throw new RangeError('The hand skeleton coordinate buffer is too small.');
  }

  landmarks.forEach((landmark, index) => {
    const point = gesturePointToViewport(landmark, width, height);
    target[index * 2] = point.x;
    target[index * 2 + 1] = point.y;
  });
  return target;
}

export class HandSkeletonRenderer {
  private readonly coordinateBuffers = new Map<number, Float32Array>();
  private readonly liveHandIds = new Set<number>();

  render(context: CanvasRenderingContext2D, hands: readonly TrackedHand[], width: number, height: number) {
    this.liveHandIds.clear();
    for (const hand of hands) {
      const opacity = Math.min(1, Math.max(0, hand.confidence * hand.lostOpacity));
      if (opacity <= 0.01 || hand.landmarks.length !== HAND_LANDMARK_COUNT) continue;

      this.liveHandIds.add(hand.id);
      let coordinates = this.coordinateBuffers.get(hand.id);
      if (!coordinates) {
        coordinates = new Float32Array(HAND_LANDMARK_COUNT * 2);
        this.coordinateBuffers.set(hand.id, coordinates);
      }
      mapHandLandmarksToViewport(hand.landmarks, width, height, coordinates);
      this.drawHand(context, coordinates, opacity);
    }

    for (const id of this.coordinateBuffers.keys()) {
      if (!this.liveHandIds.has(id)) this.coordinateBuffers.delete(id);
    }
  }

  clear() {
    this.coordinateBuffers.clear();
    this.liveHandIds.clear();
  }

  private drawHand(context: CanvasRenderingContext2D, points: Float32Array, opacity: number) {
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.lineCap = 'round';
    context.lineJoin = 'round';

    context.beginPath();
    for (const [from, to] of HAND_SKELETON_CONNECTIONS) {
      context.moveTo(points[from * 2], points[from * 2 + 1]);
      context.lineTo(points[to * 2], points[to * 2 + 1]);
    }
    context.strokeStyle = `rgba(255, 174, 45, ${0.18 * opacity})`;
    context.shadowColor = 'rgba(255, 183, 57, 0.68)';
    context.shadowBlur = 12;
    context.lineWidth = 4;
    context.stroke();

    context.strokeStyle = `rgba(255, 226, 139, ${0.84 * opacity})`;
    context.shadowBlur = 4;
    context.lineWidth = 1.25;
    context.stroke();

    for (let index = 0; index < HAND_LANDMARK_COUNT; index += 1) {
      const radius = index === 0 ? 3.5 : FINGERTIPS.has(index) ? 3.2 : 2.35;
      context.beginPath();
      context.arc(points[index * 2], points[index * 2 + 1], radius, 0, Math.PI * 2);
      context.fillStyle = `rgba(255, 250, 218, ${0.94 * opacity})`;
      context.shadowColor = 'rgba(255, 199, 71, 0.9)';
      context.shadowBlur = FINGERTIPS.has(index) ? 11 : 7;
      context.fill();
    }
    context.restore();
  }
}
