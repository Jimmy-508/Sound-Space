import type { GesturePoint } from './types';

export const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];

export const gestureEffectLimits = {
  blueTears: 320,
  explosionParticles: 112,
  explosionBursts: 3,
};

export interface SweepDisturbance {
  landmarks: readonly GesturePoint[];
  previousLandmarks: readonly GesturePoint[];
  velocityX: number;
  velocityY: number;
  speed: number;
  turnIntensity: number;
}

export interface BlueTearSeed {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  size: number;
  life: number;
  hot: boolean;
  sourceIndex: number;
  streak: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function createBlueTearSeeds(disturbance: SweepDisturbance, random = Math.random): BlueTearSeed[] {
  if (disturbance.speed < 0.32 || disturbance.landmarks.length < 21 || disturbance.previousLandmarks.length < 21) return [];
  const speedIntensity = clamp01((disturbance.speed - 0.32) / 1.45);
  const turbulence = clamp01(disturbance.turnIntensity);
  const count = Math.min(46, 9 + Math.round(speedIntensity * 25 + turbulence * 12));
  const seeds: BlueTearSeed[] = [];

  for (let index = 0; index < count; index += 1) {
    const connectionIndex = index % HAND_CONNECTIONS.length;
    const [fromIndex, toIndex] = HAND_CONNECTIONS[connectionIndex];
    const from = disturbance.landmarks[fromIndex];
    const to = disturbance.landmarks[toIndex];
    const previousFrom = disturbance.previousLandmarks[fromIndex];
    const previousTo = disturbance.previousLandmarks[toIndex];
    const alongBone = random();
    const wakePosition = 0.16 + random() * 0.84;
    const currentX = from.x + (to.x - from.x) * alongBone;
    const currentY = from.y + (to.y - from.y) * alongBone;
    const previousX = previousFrom.x + (previousTo.x - previousFrom.x) * alongBone;
    const previousY = previousFrom.y + (previousTo.y - previousFrom.y) * alongBone;
    const jitter = (0.0015 + speedIntensity * 0.0035) * (random() - 0.5);
    const hot = index % 13 === 0 || turbulence > 0.62 && index % 7 === 0;
    seeds.push({
      x: previousX + (currentX - previousX) * wakePosition + jitter,
      y: previousY + (currentY - previousY) * wakePosition + jitter,
      velocityX: disturbance.velocityX * (0.008 + random() * 0.018) + (random() - 0.5) * 0.012,
      velocityY: disturbance.velocityY * (0.008 + random() * 0.018) + (random() - 0.5) * 0.012,
      size: hot ? 1.1 + random() * 0.8 : 0.38 + random() * 0.72,
      life: 340 + random() * 500 + turbulence * random() * 150,
      hot,
      sourceIndex: toIndex,
      streak: 1.2 + speedIntensity * 3.6 + random() * 1.4,
    });
  }
  return seeds;
}

export function clampEffectCount<T>(items: T[], limit: number) {
  if (items.length > limit) items.splice(0, items.length - limit);
  return items;
}
