import type { GestureFrameStore, GesturePoint, TrackedHand } from './types';

const createOpenHand = (id: number, centerX: number, centerY: number, scale: number, timestamp: number): TrackedHand => {
  const horizontalScale = scale * window.innerHeight / Math.max(1, window.innerWidth);
  const point = (x: number, y: number, z = 0): GesturePoint => ({ x: centerX + x * horizontalScale, y: centerY + y * scale, z });
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

const createPointingHand = (id: number, targetX: number, targetY: number, scale: number, timestamp: number) => {
  const hand = createOpenHand(id, 0.5, 0.53, scale, timestamp);
  const foldFinger = (indices: readonly number[], xOffset: number) => {
    const root = hand.landmarks[indices[0]];
    const offsets = [
      { x: 0, y: 0 },
      { x: xOffset, y: 0.07 * scale },
      { x: xOffset * 1.3, y: 0.16 * scale },
      { x: xOffset * 0.7, y: 0.23 * scale },
    ];
    indices.forEach((index, joint) => {
      hand.landmarks[index] = {
        ...hand.landmarks[index],
        x: root.x + offsets[joint].x,
        y: root.y + offsets[joint].y,
      };
    });
  };
  foldFinger([9, 10, 11, 12], 0.015 * scale);
  foldFinger([13, 14, 15, 16], 0.025 * scale);
  foldFinger([17, 18, 19, 20], 0.035 * scale);
  const deltaX = targetX - hand.landmarks[8].x;
  const deltaY = targetY - hand.landmarks[8].y;
  hand.landmarks = hand.landmarks.map((point) => ({ ...point, x: point.x + deltaX, y: point.y + deltaY }));
  hand.gesture = 'pointing';
  return hand;
};

export type GesturePreviewMode = 'one' | 'two' | 'pointing' | 'sweep' | 'explosion';

export function startGesturePreview(store: GestureFrameStore, mode: GesturePreviewMode) {
  let frame = 0;
  let previousUpdate = 0;
  const tick = (timestamp: number) => {
    frame = requestAnimationFrame(tick);
    if (timestamp - previousUpdate < 1000 / 30) return;
    previousUpdate = timestamp;
    const drift = Math.sin(timestamp * (mode === 'sweep' ? 0.004 : 0.00075)) * (mode === 'sweep' ? 0.2 : 0.012);
    const params = new URLSearchParams(window.location.search);
    const targetX = Math.min(1, Math.max(0, Number(params.get('gestureX') ?? 0.5)));
    const targetY = Math.min(1, Math.max(0, Number(params.get('gestureY') ?? 0.5)));
    const hands = mode === 'pointing'
      ? [createPointingHand(1, targetX + drift, targetY, 0.3, timestamp)]
      : mode === 'two'
      ? [
          createOpenHand(1, 0.3 + drift, 0.53, 0.25, timestamp),
          createOpenHand(2, 0.7 - drift, 0.55, 0.23, timestamp),
        ]
      : [createOpenHand(1, 0.5 + drift, 0.53, 0.3, timestamp)];
    if (mode === 'explosion') hands[0].gesture = Math.floor(timestamp / 900) % 2 === 0 ? 'fist' : 'openPalm';
    store.write({ hands, twoHandsPresent: mode === 'two', timestamp });
  };
  frame = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(frame);
    store.clear();
  };
}
