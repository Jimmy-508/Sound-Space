import type { GesturePoint } from './types';

export const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];

export const gestureEffectLimits = {
  blueTears: 420,
  waterRipples: 40,
  wavefrontSpecksPerBurst: 84,
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
  curve: number;
}

export interface WavefrontTearSeed {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  size: number;
  life: number;
  streak: number;
  curve: number;
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
    const wakePosition = -0.34 + random() * 1.5;
    const currentX = from.x + (to.x - from.x) * alongBone;
    const currentY = from.y + (to.y - from.y) * alongBone;
    const previousX = previousFrom.x + (previousTo.x - previousFrom.x) * alongBone;
    const previousY = previousFrom.y + (previousTo.y - previousFrom.y) * alongBone;
    const boneX = to.x - from.x;
    const boneY = to.y - from.y;
    const boneLength = Math.max(0.001, Math.hypot(boneX, boneY));
    const motionLength = Math.max(0.001, Math.hypot(disturbance.velocityX, disturbance.velocityY));
    const perpendicularX = motionLength > 0.01 ? -disturbance.velocityY / motionLength : -boneY / boneLength;
    const perpendicularY = motionLength > 0.01 ? disturbance.velocityX / motionLength : boneX / boneLength;
    const palmSource = fromIndex === 0 || toIndex === 0 || fromIndex === 5 || fromIndex === 9 || fromIndex === 13 || toIndex === 17;
    const spread = (palmSource ? 0.032 : 0.018) + speedIntensity * (palmSource ? 0.045 : 0.027);
    const lateral = (random() - 0.5) * spread * 2;
    const softJitter = (random() - 0.5) * 0.006;
    const hot = index % 13 === 0 || turbulence > 0.62 && index % 7 === 0;
    seeds.push({
      x: previousX + (currentX - previousX) * wakePosition + perpendicularX * lateral + softJitter,
      y: previousY + (currentY - previousY) * wakePosition + perpendicularY * lateral + softJitter,
      velocityX: disturbance.velocityX * (0.008 + random() * 0.018) + (random() - 0.5) * 0.012,
      velocityY: disturbance.velocityY * (0.008 + random() * 0.018) + (random() - 0.5) * 0.012,
      size: hot ? 1.1 + random() * 0.8 : 0.38 + random() * 0.72,
      life: 340 + random() * 500 + turbulence * random() * 150,
      hot,
      sourceIndex: toIndex,
      streak: 1.2 + speedIntensity * 3.6 + random() * 1.4,
      curve: (random() - 0.5) * (1.4 + turbulence * 2.8),
    });
  }
  return seeds;
}

export function createWavefrontTearSeeds(
  x: number,
  y: number,
  radius: number,
  count: number,
  random = Math.random,
): WavefrontTearSeed[] {
  return Array.from({ length: Math.max(0, count) }, (_, index) => {
    const angle = index / Math.max(1, count) * Math.PI * 2 + (random() - 0.5) * 0.22;
    const radialOffset = (random() - 0.5) * 7;
    const sourceRadius = Math.max(4, radius + radialOffset);
    const tangent = (random() - 0.5) * 18;
    const outward = 8 + random() * 20;
    return {
      x: x + Math.cos(angle) * sourceRadius,
      y: y + Math.sin(angle) * sourceRadius,
      velocityX: Math.cos(angle) * outward - Math.sin(angle) * tangent,
      velocityY: Math.sin(angle) * outward + Math.cos(angle) * tangent,
      size: 0.45 + random() * 0.85,
      life: 260 + random() * 360,
      streak: 1.5 + random() * 3.5,
      curve: (random() - 0.5) * 1.8,
    };
  });
}

export function clampEffectCount<T>(items: T[], limit: number) {
  if (items.length > limit) items.splice(0, items.length - limit);
  return items;
}
