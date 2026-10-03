import type { GesturePoint } from './types';

export interface ViewportPoint {
  x: number;
  y: number;
  z: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function cameraPointToGesturePoint(point: GesturePoint, mirror = true): GesturePoint {
  return {
    x: clamp01(mirror ? 1 - point.x : point.x),
    y: clamp01(point.y),
    z: Number.isFinite(point.z) ? point.z : 0,
    visibility: point.visibility,
  };
}

export function gesturePointToViewport(
  point: GesturePoint,
  width: number,
  height: number,
): ViewportPoint {
  return {
    x: clamp01(point.x) * width,
    y: clamp01(point.y) * height,
    z: point.z,
  };
}
