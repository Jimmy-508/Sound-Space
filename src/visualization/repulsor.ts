export type RepulsorType = 'pointer' | 'hand' | 'ripple';

export interface Repulsor {
  x: number;
  y: number;
  radius: number;
  strength: number;
  type: RepulsorType;
  velocityX?: number;
  velocityY?: number;
  currentRadius?: number;
  decay?: number;
  updatedAt?: number;
  contact?: boolean;
  active?: boolean;
  source?: 'mouse' | 'touch' | 'hand' | 'system';
  speed?: number;
}

export interface SpiritAttractor {
  x: number;
  y: number;
  strength: number;
  active: boolean;
}

export interface SpiritGestureForces {
  attraction?: SpiritAttractor;
  displacement?: Repulsor;
}

export function computeWavefrontInfluence(surfaceDistance: number, waveRadius: number, thickness: number) {
  const safeThickness = Math.max(0.001, thickness);
  return Math.max(0, 1 - Math.abs(surfaceDistance - waveRadius) / safeThickness);
}

export function computeAttractionSteering(
  deltaX: number,
  deltaY: number,
  strength: number,
  time: number,
  phase: number,
) {
  const distance = Math.max(0.001, Math.hypot(deltaX, deltaY));
  const directionX = deltaX / distance;
  const directionY = deltaY / distance;
  const smoothstep = (start: number, end: number, value: number) => {
    const progress = Math.min(1, Math.max(0, (value - start) / Math.max(0.00001, end - start)));
    return progress * progress * (3 - 2 * progress);
  };
  const approach = smoothstep(0.045, 0.56, distance) * strength;
  const nearTarget = 1 - smoothstep(0.045, 0.23, distance);
  const orbit = Math.sin(time * 1.7 + phase) * nearTarget * 0.018;
  return {
    accelerationX: directionX * approach * 0.12 - directionY * orbit,
    accelerationY: directionY * approach * 0.12 + directionX * orbit,
    curiosity: Math.min(1, strength * 0.78),
    distance,
  };
}
