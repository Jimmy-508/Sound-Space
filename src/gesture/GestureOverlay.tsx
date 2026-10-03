import { useEffect, useRef } from 'react';
import { gesturePointToViewport } from './coordinateTransform';
import type { GestureFrameStore } from './types';

const CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];

interface TrailPoint {
  x: number;
  y: number;
  timestamp: number;
}

interface GestureOverlayProps {
  store: GestureFrameStore;
}

export function GestureOverlay({ store }: GestureOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const trails = new Map<number, TrailPoint[]>();
    let frame = 0;
    let width = 1;
    let height = 1;

    const resize = () => {
      width = Math.max(1, window.innerWidth);
      height = Math.max(1, window.innerHeight);
      const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const draw = (timestamp: number) => {
      context.clearRect(0, 0, width, height);
      const snapshot = store.read();
      const liveIds = new Set(snapshot.hands.map((hand) => hand.id));

      for (const hand of snapshot.hands) {
        const opacity = Math.min(1, Math.max(0, hand.confidence * hand.lostOpacity));
        if (opacity <= 0.01 || hand.landmarks.length !== 21) continue;
        const points = hand.landmarks.map((point) => gesturePointToViewport(point, width, height));

        context.save();
        context.globalCompositeOperation = 'lighter';
        context.lineCap = 'round';
        context.lineJoin = 'round';

        for (const [from, to] of CONNECTIONS) {
          const start = points[from];
          const end = points[to];
          const gradient = context.createLinearGradient(start.x, start.y, end.x, end.y);
          gradient.addColorStop(0, `rgba(105, 221, 255, ${0.7 * opacity})`);
          gradient.addColorStop(1, `rgba(188, 132, 255, ${0.62 * opacity})`);
          context.beginPath();
          context.moveTo(start.x, start.y);
          context.lineTo(end.x, end.y);
          context.strokeStyle = `rgba(91, 126, 255, ${0.16 * opacity})`;
          context.shadowColor = 'rgba(72, 194, 255, 0.62)';
          context.shadowBlur = 13;
          context.lineWidth = 4;
          context.stroke();
          context.strokeStyle = gradient;
          context.shadowBlur = 5;
          context.lineWidth = 1.15;
          context.stroke();
        }

        points.forEach((point, index) => {
          const isTip = [4, 8, 12, 16, 20].includes(index);
          const radius = index === 8 ? 4.9 : isTip ? 3.7 : index === 0 ? 4.2 : 2.6;
          context.beginPath();
          context.arc(point.x, point.y, radius, 0, Math.PI * 2);
          context.fillStyle = `rgba(229, 252, 255, ${0.92 * opacity})`;
          context.shadowColor = index % 2 === 0 ? 'rgba(71, 224, 255, 0.95)' : 'rgba(190, 126, 255, 0.9)';
          context.shadowBlur = isTip ? 18 : 11;
          context.fill();
        });

        const indexTip = points[8];
        const trail = trails.get(hand.id) ?? [];
        const last = trail[trail.length - 1];
        if (hand.lostOpacity > 0.9 && (!last || Math.hypot(indexTip.x - last.x, indexTip.y - last.y) > 2.5)) {
          trail.push({ x: indexTip.x, y: indexTip.y, timestamp });
        }
        while (trail.length && timestamp - trail[0].timestamp > 190) trail.shift();
        trails.set(hand.id, trail);

        trail.forEach((point, index) => {
          const life = 1 - (timestamp - point.timestamp) / 190;
          context.beginPath();
          context.arc(point.x, point.y, 1 + (index / Math.max(1, trail.length)) * 1.5, 0, Math.PI * 2);
          context.fillStyle = `rgba(118, 229, 255, ${Math.max(0, life) * 0.46 * opacity})`;
          context.shadowColor = 'rgba(105, 184, 255, 0.8)';
          context.shadowBlur = 8;
          context.fill();
        });
        context.restore();
      }

      for (const id of trails.keys()) {
        if (!liveIds.has(id)) {
          const trail = trails.get(id) ?? [];
          while (trail.length && timestamp - trail[0].timestamp > 190) trail.shift();
          if (!trail.length) trails.delete(id);
        }
      }
      frame = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('resize', resize);
    };
  }, [store]);

  return <canvas ref={canvasRef} className="gesture-overlay" aria-hidden="true" />;
}
