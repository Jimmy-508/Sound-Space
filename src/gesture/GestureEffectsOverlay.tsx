import { useEffect, useRef } from 'react';
import { gesturePointToViewport } from './coordinateTransform';
import type { GestureInteractionController, GestureInteractionEvent } from './interactionController';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  born: number;
  life: number;
  hue: number;
}

interface Shockwave {
  x: number;
  y: number;
  born: number;
  life: number;
}

interface Props {
  controller: GestureInteractionController;
  enabled: boolean;
  scene: 'home' | 'wave' | 'sampling' | 'music' | 'settings';
}

const MAX_BLUE_TEARS = 260;
const MAX_EXPLOSION_PARTICLES = 84;

export function GestureEffectsOverlay({ controller, enabled, scene }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef(scene);
  sceneRef.current = scene;

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    let width = 1;
    let height = 1;
    let frame = 0;
    const blueTears: Particle[] = [];
    const explosionParticles: Particle[] = [];
    const shockwaves: Shockwave[] = [];

    const resize = () => {
      width = Math.max(1, window.innerWidth);
      height = Math.max(1, window.innerHeight);
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const insideMusicStage = (x: number, y: number) => {
      const stage = document.querySelector<HTMLElement>('.music-stage[data-gesture-zone="spirit"]');
      if (!stage) return false;
      const rect = stage.getBoundingClientRect();
      return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    };

    const isAllowed = (event: GestureInteractionEvent) => {
      if (sceneRef.current === 'home') return true;
      if (sceneRef.current !== 'music') return false;
      const point = gesturePointToViewport(event.point, width, height);
      return insideMusicStage(point.x, point.y);
    };

    const unsubscribe = controller.subscribe((event) => {
      if (!isAllowed(event)) return;
      const point = gesturePointToViewport(event.point, width, height);
      if (event.type === 'sweep') {
        const count = Math.min(18, 5 + Math.round(event.speed * 8));
        for (let index = 0; index < count && blueTears.length < MAX_BLUE_TEARS; index += 1) {
          const spread = (Math.random() - 0.5) * 0.9;
          blueTears.push({
            x: point.x + (Math.random() - 0.5) * 24,
            y: point.y + (Math.random() - 0.5) * 20,
            vx: event.velocityX * 20 + spread * 24,
            vy: event.velocityY * 20 + (Math.random() - 0.5) * 22,
            size: 1.2 + Math.random() * 3.8,
            born: event.timestamp,
            life: 520 + Math.random() * 680,
            hue: 188 + Math.random() * 22,
          });
        }
      } else {
        shockwaves.push({ x: point.x, y: point.y, born: event.timestamp, life: 620 });
        for (let index = 0; index < MAX_EXPLOSION_PARTICLES; index += 1) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 95 + Math.random() * 240;
          explosionParticles.push({
            x: point.x,
            y: point.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: 1.2 + Math.random() * 3.4,
            born: event.timestamp,
            life: 300 + Math.random() * 460,
            hue: 38 + Math.random() * 12,
          });
        }
      }
    });

    const drawParticles = (items: Particle[], now: number, blue: boolean) => {
      for (let index = items.length - 1; index >= 0; index -= 1) {
        const particle = items[index];
        const age = now - particle.born;
        if (age >= particle.life) {
          items.splice(index, 1);
          continue;
        }
        const progress = age / particle.life;
        const delta = Math.min(0.032, Math.max(0, (now - Math.max(particle.born, now - 16)) / 1000));
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;
        particle.vx *= 0.985;
        particle.vy = particle.vy * 0.985 - (blue ? 2.4 : 0) * delta;
        const alpha = Math.sin(Math.min(1, progress * 4) * Math.PI / 2) * (1 - progress);
        context.beginPath();
        context.arc(particle.x, particle.y, particle.size * (blue ? 1 + progress * 0.45 : 1 - progress * 0.3), 0, Math.PI * 2);
        context.fillStyle = `hsla(${particle.hue}, 100%, ${blue ? 70 : 76}%, ${alpha * (blue ? 0.72 : 0.88)})`;
        context.shadowColor = blue ? 'rgba(68, 205, 255, 0.9)' : 'rgba(255, 196, 73, 0.92)';
        context.shadowBlur = blue ? 15 : 11;
        context.fill();
      }
    };

    const draw = (now: number) => {
      context.clearRect(0, 0, width, height);
      context.save();
      context.globalCompositeOperation = 'lighter';
      drawParticles(blueTears, now, true);
      drawParticles(explosionParticles, now, false);
      for (let index = shockwaves.length - 1; index >= 0; index -= 1) {
        const wave = shockwaves[index];
        const progress = (now - wave.born) / wave.life;
        if (progress >= 1) {
          shockwaves.splice(index, 1);
          continue;
        }
        const radius = 16 + progress * Math.min(width, height) * 0.24;
        context.beginPath();
        context.arc(wave.x, wave.y, radius, 0, Math.PI * 2);
        context.strokeStyle = `rgba(255, 217, 130, ${(1 - progress) * 0.68})`;
        context.lineWidth = 1.5 + (1 - progress) * 3;
        context.shadowColor = 'rgba(255, 179, 62, 0.92)';
        context.shadowBlur = 22;
        context.stroke();
      }
      context.restore();
      frame = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    frame = requestAnimationFrame(draw);
    return () => {
      unsubscribe();
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('resize', resize);
    };
  }, [controller]);

  useEffect(() => {
    if (!enabled) controller.setDwell(false, 0);
  }, [controller, enabled]);

  return <canvas ref={canvasRef} className="gesture-effects-overlay" aria-hidden="true" />;
}

export const gestureEffectLimits = { blueTears: MAX_BLUE_TEARS, explosionParticles: MAX_EXPLOSION_PARTICLES };
