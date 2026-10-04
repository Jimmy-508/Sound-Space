import type { GesturePoint } from './types';

export function getHandPalmCenter(points: readonly GesturePoint[]) {
  const indices = [0, 5, 9, 13, 17];
  return indices.reduce((center, index) => ({
    x: center.x + points[index].x / indices.length,
    y: center.y + points[index].y / indices.length,
    z: center.z + points[index].z / indices.length,
  }), { x: 0, y: 0, z: 0 });
}

export function createCompactHandRenderPoints(points: readonly GesturePoint[]) {
  return points.map((point) => ({ ...point }));
}
