import { useEffect, useRef } from 'react';
import { gesturePointToViewport } from './coordinateTransform';
import { clampEffectCount, createBlueTearSeeds, gestureEffectLimits } from './gestureEffectsModel';
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
  streak: number;
  hot: boolean;
}

interface ExplosionBurst {
  x: number;
  y: number;
  born: number;
  life: number;
  rotation: number;
}

interface Props {
  controller: GestureInteractionController;
  enabled: boolean;
  scene: 'home' | 'wave' | 'sampling' | 'music' | 'settings';
}

export function GestureEffectsOverlay({ controller, enabled, scene }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef(scene);
  const enabledRef = useRef(enabled);
  sceneRef.current = scene;
  enabledRef.current = enabled;

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    let width = 1;
    let height = 1;
    let frame = 0;
    let lastDraw = performance.now();
    let clearedWhileDisabled = false;
    const blueTears: Particle[] = [];
    const explosionParticles: Particle[] = [];
    const explosionBursts: ExplosionBurst[] = [];

    const clearEffects = () => {
      blueTears.length = 0;
      explosionParticles.length = 0;
      explosionBursts.length = 0;
      context.clearRect(0, 0, width, height);
    };

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
      if (!enabledRef.current) return false;
      if (sceneRef.current === 'home') return true;
      if (sceneRef.current !== 'music') return false;
      const point = gesturePointToViewport(event.point, width, height);
      return insideMusicStage(point.x, point.y);
    };

    const unsubscribe = controller.subscribe((event) => {
      if (!isAllowed(event)) return;
      const point = gesturePointToViewport(event.point, width, height);
      if (event.type === 'sweep') {
        const seeds = createBlueTearSeeds(event);
        for (const seed of seeds) {
          blueTears.push({
            x: seed.x * width,
            y: seed.y * height,
            vx: seed.velocityX * width,
            vy: seed.velocityY * height,
            size: seed.size,
            born: event.timestamp,
            life: seed.life,
            hue: 188 + Math.random() * 18,
            streak: seed.streak,
            hot: seed.hot,
          });
        }
        clampEffectCount(blueTears, gestureEffectLimits.blueTears);
        return;
      }

      explosionBursts.push({ x: point.x, y: point.y, born: event.timestamp, life: 900, rotation: Math.random() * Math.PI });
      clampEffectCount(explosionBursts, gestureEffectLimits.explosionBursts);
      for (let index = 0; index < gestureEffectLimits.explosionParticles; index += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 150 + Math.random() * 430;
        const hot = index % 9 === 0;
        explosionParticles.push({
          x: point.x,
          y: point.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: hot ? 1.6 + Math.random() * 1.6 : 0.7 + Math.random() * 1.3,
          born: event.timestamp,
          life: 260 + Math.random() * 560,
          hue: 36 + Math.random() * 14,
          streak: 5 + Math.random() * 13,
          hot,
        });
      }
      clampEffectCount(explosionParticles, gestureEffectLimits.explosionParticles);
    });

    const drawParticles = (items: Particle[], now: number, delta: number, blue: boolean) => {
      for (let index = items.length - 1; index >= 0; index -= 1) {
        const particle = items[index];
        const age = now - particle.born;
        if (age >= particle.life) {
          items.splice(index, 1);
          continue;
        }
        const progress = age / particle.life;
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;
        particle.vx *= blue ? 0.982 : 0.975;
        particle.vy = particle.vy * (blue ? 0.982 : 0.975) - (blue ? 1.2 : 0) * delta;
        const ignition = Math.min(1, age / (blue ? 42 : 24));
        const shimmer = blue ? 0.76 + Math.sin(age * 0.045 + index) * 0.24 : 1;
        const alpha = ignition * (1 - progress) * shimmer;
        const speed = Math.max(0.001, Math.hypot(particle.vx, particle.vy));
        const tailX = particle.x - particle.vx / speed * particle.streak;
        const tailY = particle.y - particle.vy / speed * particle.streak;
        context.beginPath();
        context.moveTo(tailX, tailY);
        context.lineTo(particle.x, particle.y);
        context.strokeStyle = blue
          ? `hsla(${particle.hue}, 100%, ${particle.hot ? 91 : 70}%, ${alpha * (particle.hot ? 0.9 : 0.48)})`
          : `hsla(${particle.hue}, 100%, ${particle.hot ? 94 : 72}%, ${alpha * 0.88})`;
        context.lineWidth = particle.size;
        context.shadowColor = blue ? 'rgba(65, 211, 255, 0.9)' : 'rgba(255, 192, 64, 0.96)';
        context.shadowBlur = blue ? particle.size * 3.5 : particle.size * 5;
        context.stroke();
        if (particle.hot) {
          context.beginPath();
          context.arc(particle.x, particle.y, particle.size * 0.62, 0, Math.PI * 2);
          context.fillStyle = blue ? `rgba(225, 253, 255, ${alpha})` : `rgba(255, 252, 225, ${alpha})`;
          context.fill();
        }
      }
    };

    const drawExplosion = (burst: ExplosionBurst, now: number) => {
      const age = now - burst.born;
      const progress = age / burst.life;
      if (progress >= 1) return false;
      const shortFlash = Math.max(0, 1 - age / 125);
      const afterglow = Math.max(0, 1 - progress);
      const maximumRadius = Math.min(width, height) * 0.34;
      if (shortFlash > 0) {
        const radius = 16 + (1 - shortFlash) * 78;
        const gradient = context.createRadialGradient(burst.x, burst.y, 0, burst.x, burst.y, radius);
        gradient.addColorStop(0, `rgba(255,255,246,${shortFlash})`);
        gradient.addColorStop(0.16, `rgba(255,224,137,${shortFlash * 0.92})`);
        gradient.addColorStop(1, 'rgba(255,151,45,0)');
        context.fillStyle = gradient;
        context.fillRect(burst.x - radius, burst.y - radius, radius * 2, radius * 2);
      }
      context.save();
      context.translate(burst.x, burst.y);
      context.rotate(burst.rotation + progress * 0.2);
      const rayAlpha = Math.max(0, 1 - age / 360);
      for (let ray = 0; ray < 18; ray += 1) {
        const angle = ray / 18 * Math.PI * 2 + Math.sin(ray * 9.1) * 0.08;
        const inner = 12 + progress * 24;
        const outer = inner + (38 + (ray % 4) * 13) * (0.45 + progress);
        context.beginPath();
        context.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
        context.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
        context.strokeStyle = `rgba(255, ${ray % 3 ? 190 : 242}, ${ray % 3 ? 76 : 194}, ${rayAlpha * 0.78})`;
        context.lineWidth = ray % 5 === 0 ? 2.4 : 1;
        context.shadowColor = 'rgba(255, 184, 49, 0.95)';
        context.shadowBlur = 14;
        context.stroke();
      }
      context.restore();
      for (let ring = 0; ring < 2; ring += 1) {
        const ringProgress = Math.min(1, Math.max(0, progress * 1.28 - ring * 0.13));
        if (ringProgress <= 0 || ringProgress >= 1) continue;
        const radius = 18 + ringProgress * maximumRadius;
        context.beginPath();
        context.arc(burst.x, burst.y, radius, 0, Math.PI * 2);
        context.strokeStyle = `rgba(255, ${ring ? 188 : 231}, ${ring ? 72 : 155}, ${(1 - ringProgress) * (ring ? 0.35 : 0.72)})`;
        context.lineWidth = ring ? 1.2 : 2.4;
        context.shadowColor = 'rgba(255, 190, 70, 0.9)';
        context.shadowBlur = 22;
        context.stroke();
      }
      const rippleRadius = 28 + progress * maximumRadius * 0.72;
      context.beginPath();
      context.arc(burst.x, burst.y, rippleRadius, -0.18 * Math.PI, 1.42 * Math.PI);
      context.strokeStyle = `rgba(255, 246, 215, ${afterglow * 0.2})`;
      context.lineWidth = 7 * afterglow;
      context.shadowColor = 'rgba(255, 204, 96, 0.58)';
      context.shadowBlur = 28;
      context.stroke();
      return true;
    };

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      const delta = Math.min(0.032, Math.max(0, (now - lastDraw) / 1000));
      lastDraw = now;
      if (!enabledRef.current) {
        if (!clearedWhileDisabled) clearEffects();
        clearedWhileDisabled = true;
        return;
      }
      clearedWhileDisabled = false;
      context.clearRect(0, 0, width, height);
      context.save();
      context.globalCompositeOperation = 'lighter';
      drawParticles(blueTears, now, delta, true);
      drawParticles(explosionParticles, now, delta, false);
      for (let index = explosionBursts.length - 1; index >= 0; index -= 1) {
        if (!drawExplosion(explosionBursts[index], now)) explosionBursts.splice(index, 1);
      }
      context.restore();
    };

    resize();
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    frame = requestAnimationFrame(draw);
    return () => {
      unsubscribe();
      cancelAnimationFrame(frame);
      clearEffects();
      window.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('resize', resize);
    };
  }, [controller]);

  useEffect(() => {
    if (!enabled) controller.setDwell(false, 0);
  }, [controller, enabled]);

  return <canvas ref={canvasRef} className="gesture-effects-overlay" aria-hidden="true" />;
}
