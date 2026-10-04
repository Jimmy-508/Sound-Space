import { useEffect, useRef } from 'react';
import { gesturePointToViewport } from './coordinateTransform';
import { clampEffectCount, createBlueTearSeeds, createWavefrontTearSeeds, gestureEffectLimits } from './gestureEffectsModel';
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
  curve: number;
}

interface ExplosionBurst {
  x: number;
  y: number;
  born: number;
  life: number;
  rotation: number;
  nextEmission: number;
  emitted: number;
}

interface WaterRipple {
  x: number;
  y: number;
  born: number;
  life: number;
  radius: number;
  rotation: number;
  arc: number;
  wobble: number;
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
    const explosionBursts: ExplosionBurst[] = [];
    const waterRipples: WaterRipple[] = [];

    const clearEffects = () => {
      blueTears.length = 0;
      explosionBursts.length = 0;
      waterRipples.length = 0;
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
            curve: seed.curve,
          });
        }
        const rippleCount = 1 + Math.round(Math.min(2, event.speed * 0.9));
        const palm = event.landmarks[9] ?? event.point;
        for (let index = 0; index < rippleCount; index += 1) {
          const source = index === 0 ? palm : event.landmarks[index % 2 ? 5 : 17] ?? palm;
          waterRipples.push({
            x: source.x * width,
            y: source.y * height,
            born: event.timestamp + index * 28,
            life: 380 + Math.random() * 260,
            radius: 18 + event.speed * 16 + Math.random() * 20,
            rotation: Math.atan2(event.velocityY, event.velocityX) + (Math.random() - 0.5) * 0.8,
            arc: Math.PI * (0.7 + Math.random() * 0.75),
            wobble: 2 + Math.random() * 4,
          });
        }
        clampEffectCount(blueTears, gestureEffectLimits.blueTears);
        clampEffectCount(waterRipples, gestureEffectLimits.waterRipples);
        return;
      }

      explosionBursts.push({
        x: point.x,
        y: point.y,
        born: event.timestamp,
        life: 1120,
        rotation: Math.random() * Math.PI,
        nextEmission: event.timestamp + 46,
        emitted: 0,
      });
      clampEffectCount(explosionBursts, gestureEffectLimits.explosionBursts);
    });

    const drawParticles = (items: Particle[], now: number, delta: number) => {
      for (let index = items.length - 1; index >= 0; index -= 1) {
        const particle = items[index];
        const age = now - particle.born;
        if (age >= particle.life) {
          items.splice(index, 1);
          continue;
        }
        const progress = age / particle.life;
        const velocityAngle = particle.curve * delta;
        const previousVx = particle.vx;
        particle.vx = previousVx * Math.cos(velocityAngle) - particle.vy * Math.sin(velocityAngle);
        particle.vy = previousVx * Math.sin(velocityAngle) + particle.vy * Math.cos(velocityAngle);
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;
        particle.vx *= 0.982;
        particle.vy = particle.vy * 0.982 - 1.2 * delta;
        const ignition = Math.min(1, age / 42);
        const shimmer = 0.76 + Math.sin(age * 0.045 + index) * 0.24;
        const alpha = ignition * (1 - progress) * shimmer;
        const speed = Math.max(0.001, Math.hypot(particle.vx, particle.vy));
        const tailX = particle.x - particle.vx / speed * particle.streak;
        const tailY = particle.y - particle.vy / speed * particle.streak;
        context.beginPath();
        context.moveTo(tailX, tailY);
        context.lineTo(particle.x, particle.y);
        context.strokeStyle = `hsla(${particle.hue}, 100%, ${particle.hot ? 91 : 70}%, ${alpha * (particle.hot ? 0.9 : 0.48)})`;
        context.lineWidth = particle.size;
        context.shadowColor = 'rgba(65, 211, 255, 0.9)';
        context.shadowBlur = particle.size * 3.5;
        context.stroke();
        if (particle.hot) {
          context.beginPath();
          context.arc(particle.x, particle.y, particle.size * 0.62, 0, Math.PI * 2);
          context.fillStyle = `rgba(225, 253, 255, ${alpha})`;
          context.fill();
        }
      }
    };

    const drawRipplePath = (ripple: WaterRipple, now: number) => {
      const progress = (now - ripple.born) / ripple.life;
      if (progress < 0) return true;
      if (progress >= 1) return false;
      const radius = ripple.radius * (0.35 + progress * 1.45);
      context.beginPath();
      const steps = 28;
      for (let step = 0; step <= steps; step += 1) {
        const angle = ripple.rotation - ripple.arc / 2 + ripple.arc * step / steps;
        const localRadius = radius + Math.sin(step * 0.9 + ripple.rotation) * ripple.wobble * (1 - progress);
        const x = ripple.x + Math.cos(angle) * localRadius;
        const y = ripple.y + Math.sin(angle) * localRadius * 0.64;
        if (step === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.strokeStyle = `rgba(79, 221, 255, ${(1 - progress) * 0.3})`;
      context.lineWidth = 0.7 + (1 - progress) * 0.7;
      context.shadowColor = 'rgba(62, 198, 255, 0.5)';
      context.shadowBlur = 7;
      context.stroke();
      return true;
    };

    const drawPressureRing = (burst: ExplosionBurst, progress: number, ring: number, maximumRadius: number) => {
      const ringProgress = Math.min(1, Math.max(0, progress * 1.18 - ring * 0.105));
      if (ringProgress <= 0 || ringProgress >= 1) return;
      const radius = 12 + ringProgress * maximumRadius * (1 - ring * 0.055);
      const start = burst.rotation + ring * 0.73;
      const arc = ring === 0 ? Math.PI * 2 : Math.PI * (1.2 + ring * 0.14);
      const steps = ring === 0 ? 72 : 48;
      context.beginPath();
      for (let step = 0; step <= steps; step += 1) {
        const angle = start + arc * step / steps;
        const wobble = Math.sin(angle * (3 + ring) + burst.rotation) * (2.4 + ring * 0.8) * (1 - ringProgress * 0.55);
        const x = burst.x + Math.cos(angle) * (radius + wobble);
        const y = burst.y + Math.sin(angle) * (radius + wobble) * (0.96 + Math.sin(burst.rotation) * 0.035);
        if (step === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.strokeStyle = ring === 0
        ? `rgba(191, 250, 255, ${(1 - ringProgress) * 0.78})`
        : `rgba(${ring % 2 ? 74 : 113}, ${ring % 2 ? 216 : 237}, 255, ${(1 - ringProgress) * 0.43})`;
      context.lineWidth = ring === 0 ? 1.8 : 0.9 + ring * 0.18;
      context.shadowColor = 'rgba(61, 212, 255, 0.82)';
      context.shadowBlur = ring === 0 ? 15 : 9;
      context.stroke();
    };

    const drawExplosion = (burst: ExplosionBurst, now: number) => {
      const age = now - burst.born;
      const progress = age / burst.life;
      if (progress >= 1) return false;
      const shortFlash = Math.max(0, 1 - age / 125);
      const maximumRadius = Math.min(width, height) * 0.4;
      if (shortFlash > 0) {
        const radius = 16 + (1 - shortFlash) * 78;
        const gradient = context.createRadialGradient(burst.x, burst.y, 0, burst.x, burst.y, radius);
        gradient.addColorStop(0, `rgba(255,255,246,${shortFlash})`);
        gradient.addColorStop(0.12, `rgba(255,246,214,${shortFlash * 0.94})`);
        gradient.addColorStop(0.38, `rgba(151,239,255,${shortFlash * 0.56})`);
        gradient.addColorStop(1, 'rgba(61,199,255,0)');
        context.fillStyle = gradient;
        context.fillRect(burst.x - radius, burst.y - radius, radius * 2, radius * 2);
      }
      for (let ring = 0; ring < 4; ring += 1) drawPressureRing(burst, progress, ring, maximumRadius);

      if (now >= burst.nextEmission && burst.emitted < gestureEffectLimits.wavefrontSpecksPerBurst) {
        const leadingRadius = 12 + Math.min(1, progress * 1.18) * maximumRadius;
        const remaining = gestureEffectLimits.wavefrontSpecksPerBurst - burst.emitted;
        const seeds = createWavefrontTearSeeds(burst.x, burst.y, leadingRadius, Math.min(6, remaining));
        for (const seed of seeds) {
          blueTears.push({
            x: seed.x,
            y: seed.y,
            vx: seed.velocityX,
            vy: seed.velocityY,
            size: seed.size,
            born: now,
            life: seed.life,
            hue: 187 + Math.random() * 18,
            streak: seed.streak,
            hot: burst.emitted % 17 === 0,
            curve: seed.curve,
          });
        }
        burst.emitted += seeds.length;
        burst.nextEmission = now + 46;
        clampEffectCount(blueTears, gestureEffectLimits.blueTears);
      }
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
      drawParticles(blueTears, now, delta);
      for (let index = waterRipples.length - 1; index >= 0; index -= 1) {
        if (!drawRipplePath(waterRipples[index], now)) waterRipples.splice(index, 1);
      }
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
