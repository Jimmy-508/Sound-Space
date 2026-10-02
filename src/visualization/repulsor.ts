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
}
