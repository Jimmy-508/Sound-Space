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
