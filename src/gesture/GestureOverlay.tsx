import { useEffect, useRef } from 'react';
import { gesturePointToViewport } from './coordinateTransform';
import { HAND_CONNECTIONS } from './gestureEffectsModel';
import { createCompactHandRenderPoints, getHandPalmCenter } from './gestureRenderModel';
import type { GestureInteractionController } from './interactionController';
import type { GestureFrameStore } from './types';

interface TrailPoint {
  x: number;
  y: number;
  timestamp: number;
}

interface GestureOverlayProps {
  store: GestureFrameStore;
  interaction: GestureInteractionController;
}

export function GestureOverlay({ store, interaction }: GestureOverlayProps) {
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
        const renderLandmarks = createCompactHandRenderPoints(hand.landmarks);
        const points = renderLandmarks.map((point) => gesturePointToViewport(point, width, height));
        const palmCore = gesturePointToViewport(getHandPalmCenter(renderLandmarks), width, height);

        context.save();
        context.globalCompositeOperation = 'lighter';
        context.lineCap = 'round';
        context.lineJoin = 'round';

        for (const [from, to] of HAND_CONNECTIONS) {
          const start = points[from];
          const end = points[to];
          const gradient = context.createLinearGradient(start.x, start.y, end.x, end.y);
          gradient.addColorStop(0, `rgba(255, 246, 205, ${0.82 * opacity})`);
          gradient.addColorStop(0.5, `rgba(255, 204, 92, ${0.72 * opacity})`);
          gradient.addColorStop(1, `rgba(255, 155, 52, ${0.58 * opacity})`);
          context.beginPath();
          context.moveTo(start.x, start.y);
          context.lineTo(end.x, end.y);
          context.strokeStyle = `rgba(255, 174, 45, ${0.2 * opacity})`;
          context.shadowColor = 'rgba(255, 183, 57, 0.7)';
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
          const radius = index === 8 ? 5.2 : isTip ? 4.1 : index === 0 ? 4.5 : 3;
          context.beginPath();
          context.arc(point.x, point.y, radius, 0, Math.PI * 2);
          context.fillStyle = `rgba(255, 252, 226, ${0.96 * opacity})`;
          context.shadowColor = index % 2 === 0 ? 'rgba(255, 216, 93, 0.98)' : 'rgba(255, 162, 48, 0.92)';
          context.shadowBlur = isTip ? 18 : 11;
          context.fill();
        });

        context.beginPath();
        context.arc(palmCore.x, palmCore.y, 5.4, 0, Math.PI * 2);
        context.fillStyle = `rgba(255, 239, 180, ${0.62 * opacity})`;
        context.shadowColor = 'rgba(255, 177, 45, 0.94)';
        context.shadowBlur = 18;
        context.fill();

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
          context.fillStyle = `rgba(255, 220, 117, ${Math.max(0, life) * 0.5 * opacity})`;
          context.shadowColor = 'rgba(255, 170, 58, 0.84)';
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

      const pointer = interaction.read().pointer;
      if (pointer) {
        const point = gesturePointToViewport(pointer.point, width, height);
        const spiritStage = document.querySelector<HTMLElement>('.music-stage[data-gesture-zone="spirit"]');
        const spiritRect = spiritStage?.getBoundingClientRect();
        const attractionPointer = Boolean(spiritRect
          && point.x >= spiritRect.left && point.x <= spiritRect.right
          && point.y >= spiritRect.top && point.y <= spiritRect.bottom);
        const interactionState = interaction.read();
        const progress = interactionState.dwellActive ? interactionState.dwellProgress : 0;
        const successPulse = Math.max(0, 1 - (timestamp - interactionState.dwellSuccessAt) / 180);
        context.save();
        context.globalCompositeOperation = 'lighter';
        context.translate(point.x, point.y);
        const breath = 1 + Math.sin(timestamp * 0.0053) * 0.11;
        const stateBoost = attractionPointer ? 1.24 : interactionState.dwellActive ? 1.1 : 1;
        const flashBoost = 1 + successPulse * 0.75;
        const haloRadius = 18 * breath * stateBoost + successPulse * 10;
        const halo = context.createRadialGradient(0, 0, 0, 0, 0, haloRadius);
        halo.addColorStop(0, `rgba(255,255,238,${0.48 + successPulse * 0.38})`);
        halo.addColorStop(0.28, `rgba(255,210,102,${0.2 + successPulse * 0.18})`);
        halo.addColorStop(1, 'rgba(255,174,44,0)');
        context.fillStyle = halo;
        context.fillRect(-haloRadius, -haloRadius, haloRadius * 2, haloRadius * 2);

        context.rotate(timestamp * 0.00032);
        for (let ray = 0; ray < 8; ray += 1) {
          const primary = ray % 2 === 0;
          const phase = primary ? Math.sin(timestamp * 0.0047 + ray * 1.7) : Math.sin(timestamp * 0.011 + ray * 2.3);
          const angle = ray / 8 * Math.PI * 2;
          const inner = primary ? 3.2 : 5.5;
          const baseLength = primary ? 13.5 : 9;
          const outer = (baseLength + phase * (primary ? 3.8 : 2.4)) * stateBoost * flashBoost;
          context.beginPath();
          context.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
          context.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
          context.strokeStyle = `rgba(255, ${primary ? 244 : 207}, ${primary ? 205 : 92}, ${primary ? 0.96 : 0.66})`;
          context.lineWidth = primary ? 1.5 : 0.75;
          context.shadowColor = 'rgba(255, 181, 45, 0.98)';
          context.shadowBlur = primary ? 13 : 8;
          context.stroke();
        }

        const asymmetricAngle = timestamp * 0.0011 + 0.7;
        const asymmetricPulse = Math.max(0, Math.sin(timestamp * 0.0087)) ** 4;
        if (asymmetricPulse > 0.02) {
          context.beginPath();
          context.moveTo(Math.cos(asymmetricAngle) * 12, Math.sin(asymmetricAngle) * 12);
          context.lineTo(Math.cos(asymmetricAngle) * (19 + asymmetricPulse * 8), Math.sin(asymmetricAngle) * (19 + asymmetricPulse * 8));
          context.strokeStyle = `rgba(255, 247, 210, ${asymmetricPulse * 0.9})`;
          context.lineWidth = 1;
          context.stroke();
        }

        context.rotate(-timestamp * 0.00085);
        const dustCount = attractionPointer ? 5 : 3;
        for (let spark = 0; spark < dustCount; spark += 1) {
          const angle = spark / dustCount * Math.PI * 2 + timestamp * (0.0007 + spark * 0.00006);
          const orbit = (attractionPointer ? 21 : 17) + (spark % 2) * 4;
          const twinkle = 0.32 + Math.max(0, Math.sin(timestamp * 0.009 + spark * 2.1)) * 0.68;
            context.beginPath();
          context.arc(Math.cos(angle) * orbit, Math.sin(angle) * orbit, 0.6 + twinkle * 0.75, 0, Math.PI * 2);
          context.fillStyle = `rgba(255, 226, 137, ${twinkle * 0.78})`;
            context.fill();
        }

        if (interactionState.dwellActive) {
          context.beginPath();
          context.arc(0, 0, 20.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
          context.strokeStyle = 'rgba(255, 249, 218, 0.94)';
          context.lineWidth = 2.4;
          context.shadowColor = 'rgba(255, 184, 54, 0.95)';
          context.shadowBlur = 12;
          context.stroke();
        }

        context.beginPath();
        context.arc(0, 0, 2.8 + successPulse * 2.4, 0, Math.PI * 2);
        context.fillStyle = 'rgba(255, 255, 245, 0.99)';
        context.shadowColor = 'rgba(255, 202, 76, 1)';
        context.shadowBlur = 18 + successPulse * 16;
        context.fill();
        context.restore();
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
  }, [interaction, store]);

  return <canvas ref={canvasRef} className="gesture-overlay" aria-hidden="true" />;
}
