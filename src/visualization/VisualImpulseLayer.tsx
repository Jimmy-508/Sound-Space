import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

const impulsePoolSize = 6;
const particleCount = 14;

interface VisualImpulse {
  active: boolean;
  x: number;
  y: number;
  startedAt: number;
  seed: number;
}

export interface VisualImpulseHandle {
  trigger: (x: number, y: number) => void;
}

export const VisualImpulseLayer = forwardRef<VisualImpulseHandle>(function VisualImpulseLayer(_, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const impulsesRef = useRef<VisualImpulse[]>(Array.from({ length: impulsePoolSize }, () => ({
    active: false,
    x: 0,
    y: 0,
    startedAt: 0,
    seed: 0,
  })));
  const cursorRef = useRef(0);

  useImperativeHandle(ref, () => ({
    trigger(x, y) {
      const impulse = impulsesRef.current[cursorRef.current];
      impulse.active = true;
      impulse.x = x;
      impulse.y = y;
      impulse.startedAt = performance.now();
      impulse.seed = Math.random() * Math.PI * 2;
      cursorRef.current = (cursorRef.current + 1) % impulsePoolSize;
    },
  }), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    let frame = 0;
    let width = 1;
    let height = 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio, 1.75);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const render = (now: number) => {
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = 'lighter';
      for (const impulse of impulsesRef.current) {
        if (!impulse.active) continue;
        const age = (now - impulse.startedAt) / 980;
        if (age >= 1) {
          impulse.active = false;
          continue;
        }
        const ease = 1 - Math.pow(1 - age, 3);
        const fade = Math.pow(1 - age, 1.7);
        const centerX = impulse.x * width;
        const centerY = impulse.y * height;
        const baseRadius = 18 + Math.min(width, height) * 0.19 * ease;

        drawRing(context, centerX, centerY, baseRadius, fade * 0.82, 1.6, '178, 246, 255');
        drawRing(context, centerX, centerY, baseRadius * (0.68 + age * 0.18), fade * 0.5, 5.5, '91, 207, 255');
        drawRing(context, centerX, centerY, baseRadius * 1.28, fade * 0.22, 12, '155, 137, 255');

        const halo = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, baseRadius * 1.45);
        halo.addColorStop(0, `rgba(218, 255, 255, ${fade * 0.2})`);
        halo.addColorStop(0.24, `rgba(82, 212, 255, ${fade * 0.1})`);
        halo.addColorStop(1, 'rgba(79, 100, 255, 0)');
        context.fillStyle = halo;
        context.beginPath();
        context.arc(centerX, centerY, baseRadius * 1.45, 0, Math.PI * 2);
        context.fill();

        for (let index = 0; index < particleCount; index += 1) {
          const angle = impulse.seed + index / particleCount * Math.PI * 2 + Math.sin(index * 2.17) * 0.26;
          const distance = baseRadius * (0.38 + (index % 5) * 0.13) * ease;
          const particleFade = fade * (0.32 + (index % 3) * 0.18);
          context.fillStyle = `rgba(204, 250, 255, ${particleFade})`;
          context.beginPath();
          context.arc(centerX + Math.cos(angle) * distance, centerY + Math.sin(angle) * distance, 0.8 + (index % 3) * 0.45, 0, Math.PI * 2);
          context.fill();
        }
      }
      context.globalCompositeOperation = 'source-over';
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="visual-impulse-layer" aria-hidden="true" />;
});

function drawRing(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  opacity: number,
  width: number,
  color: string,
) {
  context.strokeStyle = `rgba(${color}, ${opacity})`;
  context.lineWidth = width;
  context.shadowColor = `rgba(${color}, ${opacity * 0.8})`;
  context.shadowBlur = width * 3.4;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.stroke();
  context.shadowBlur = 0;
}
