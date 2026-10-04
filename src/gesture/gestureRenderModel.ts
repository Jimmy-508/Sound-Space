import type { GesturePoint } from './types';

const fingerChains: ReadonlyArray<readonly [number, number, number, number]> = [
  [1, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10, 11, 12],
  [13, 14, 15, 16],
  [17, 18, 19, 20],
];

export const compactHandVisualScale = {
  palm: 0.86,
  finger: 0.7,
  thumb: 0.74,
};

export function getHandPalmCenter(points: readonly GesturePoint[]) {
  const indices = [0, 5, 9, 13, 17];
  return indices.reduce((center, index) => ({
    x: center.x + points[index].x / indices.length,
    y: center.y + points[index].y / indices.length,
    z: center.z + points[index].z / indices.length,
  }), { x: 0, y: 0, z: 0 });
}

export function createCompactHandRenderPoints(points: readonly GesturePoint[]) {
  if (points.length !== 21) return points.map((point) => ({ ...point }));
  const palm = getHandPalmCenter(points);
  const rendered = points.map((point) => ({
    ...point,
    x: palm.x + (point.x - palm.x) * compactHandVisualScale.palm,
    y: palm.y + (point.y - palm.y) * compactHandVisualScale.palm,
  }));

  fingerChains.forEach((chain, chainIndex) => {
    const root = points[chain[0]];
    const renderedRoot = rendered[chain[0]];
    const compression = chainIndex === 0 ? compactHandVisualScale.thumb : compactHandVisualScale.finger;
    for (let joint = 1; joint < chain.length; joint += 1) {
      const index = chain[joint];
      rendered[index] = {
        ...points[index],
        x: renderedRoot.x + (points[index].x - root.x) * compression,
        y: renderedRoot.y + (points[index].y - root.y) * compression,
      };
    }
  });
  return rendered;
}
