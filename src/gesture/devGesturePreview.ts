import type { GestureFrameStore, GesturePoint, TrackedHand } from './types';

const createOpenHand = (id: number, centerX: number, centerY: number, scale: number, timestamp: number): TrackedHand => {
  const point = (x: number, y: number, z = 0): GesturePoint => ({ x: centerX + x * scale, y: centerY + y * scale, z });
  const landmarks = [
    point(0, 0.47),
    point(-0.24, 0.28), point(-0.38, 0.1), point(-0.48, -0.06), point(-0.58, -0.18),
    point(-0.22, 0.1), point(-0.28, -0.16), point(-0.31, -0.39), point(-0.32, -0.61),
    point(-0.05, 0.05), point(-0.06, -0.24), point(-0.06, -0.5), point(-0.05, -0.72),
    point(0.13, 0.09), point(0.16, -0.18), point(0.19, -0.41), point(0.22, -0.59),
    point(0.29, 0.18), point(0.37, -0.03), point(0.43, -0.21), point(0.48, -0.35),
  ];
  return {
    id,
    landmarks,
    handedness: id === 1 ? 'Left' : 'Right',
    confidence: 0.96,
    timestamp,
    gesture: 'openPalm',
    lostOpacity: 1,
  };
};

export function startGesturePreview(store: GestureFrameStore, handCount: 1 | 2) {
  let frame = 0;
  let previousUpdate = 0;
  const tick = (timestamp: number) => {
    frame = requestAnimationFrame(tick);
    if (timestamp - previousUpdate < 1000 / 30) return;
    previousUpdate = timestamp;
    const drift = Math.sin(timestamp * 0.00075) * 0.012;
    const hands = handCount === 2
      ? [
          createOpenHand(1, 0.3 + drift, 0.53, 0.25, timestamp),
          createOpenHand(2, 0.7 - drift, 0.55, 0.23, timestamp),
        ]
      : [createOpenHand(1, 0.5 + drift, 0.53, 0.3, timestamp)];
    store.write({ hands, twoHandsPresent: handCount === 2, timestamp });
  };
  frame = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(frame);
    store.clear();
  };
}
