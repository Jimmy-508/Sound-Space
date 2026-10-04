import { useEffect, useRef } from 'react';
import { gesturePointToViewport } from './coordinateTransform';
import { clampEffectCount, createBlueTearSeeds, createPointerTearSeeds, createWavefrontTearSeeds, gestureEffectLimits } from './gestureEffectsModel';
import type { WorldInteractionController, WorldInteractionEvent } from '../interaction/worldInteraction';
import { AdaptiveEmissionBudget } from '../interaction/adaptiveEmissionBudget';

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
  controller: WorldInteractionController;
  scene: 'home' | 'wave' | 'sampling' | 'music' | 'settings';
  blueTearsEnabled: boolean;
}

export function GestureEffectsOverlay({ controller, scene, blueTearsEnabled }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const blueTearsEnabledRef = useRef(blueTearsEnabled);
  blueTearsEnabledRef.current = blueTearsEnabled;

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    let width = 1;
    let height = 1;
    let frame = 0;
    let running = false;
    let lastDraw = performance.now();
    const blueTears: Particle[] = [];
    const explosionBursts: ExplosionBurst[] = [];
    const waterRipples: WaterRipple[] = [];
    const emissionBudget = new AdaptiveEmissionBudget();
    let effectsEnabledLastFrame = blueTearsEnabledRef.current;
    let gestureEmissionWindowStartedAt = performance.now();
    let gestureEmissionsInWindow = 0;
    let gestureEmissionsPerSecond = 0;
    let musicStageRect: DOMRect | null = null;
    let musicStageRectMeasuredAt = -Infinity;

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
      musicStageRect = null;
    };
    const invalidateMusicStageRect = () => { musicStageRect = null; };

    const insideMusicStage = (x: number, y: number) => {
      const now = performance.now();
      if (!musicStageRect || now - musicStageRectMeasuredAt > 500) {
        musicStageRect = document.querySelector<HTMLElement>('.music-stage[data-gesture-zone="spirit"]')?.getBoundingClientRect() ?? null;
        musicStageRectMeasuredAt = now;
      }
      return Boolean(musicStageRect
        && x >= musicStageRect.left && x <= musicStageRect.right
        && y >= musicStageRect.top && y <= musicStageRect.bottom);
    };

    const isAllowed = (event: WorldInteractionEvent) => {
      if (sceneRef.current === 'home') return true;
      if (sceneRef.current !== 'music') return false;
      const point = gesturePointToViewport(event.point, width, height);
      return insideMusicStage(point.x, point.y);
    };

    function startLoop() {
      if (running) return;
      running = true;
      lastDraw = performance.now();
      frame = requestAnimationFrame(draw);
    }

    const unsubscribe = controller.subscribe((event) => {
      if (!isAllowed(event)) return;
      const point = gesturePointToViewport(event.point, width, height);
      if (event.type === 'disturbance') {
        if (!blueTearsEnabledRef.current) return;
        if (event.source === 'gesture') gestureEmissionsInWindow += 1;
        const seeds = event.geometry === 'hand' ? createBlueTearSeeds(event) : createPointerTearSeeds(event);
        const emissionCount = emissionBudget.count(seeds.length, event.source === 'gesture' ? 'gesture' : 'pointer');
        for (let seedIndex = 0; seedIndex < emissionCount; seedIndex += 1) {
          const seed = seeds[Math.floor(seedIndex * seeds.length / Math.max(1, emissionCount))];
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
        const rippleCount = 1 + Math.round(Math.min(3, event.speed * 1.05));
        const palm = event.geometry === 'hand' ? event.landmarks[9] ?? event.point : event.point;
        for (let index = 0; index < rippleCount; index += 1) {
          const source = event.geometry === 'hand' && index > 0 ? event.landmarks[index % 2 ? 5 : 17] ?? palm : palm;
          waterRipples.push({
            x: source.x * width,
            y: source.y * height,
            born: event.timestamp + index * 28,
            life: 380 + Math.random() * 260,
            radius: 26 + event.speed * 22 + Math.random() * 26,
            rotation: Math.atan2(event.velocityY, event.velocityX) + (Math.random() - 0.5) * 0.8,
            arc: Math.PI * (0.7 + Math.random() * 0.75),
            wobble: 2 + Math.random() * 4,
          });
        }
        clampEffectCount(blueTears, gestureEffectLimits.blueTears);
        clampEffectCount(waterRipples, gestureEffectLimits.waterRipples);
        startLoop();
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
      startLoop();
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

      if (blueTearsEnabledRef.current && now >= burst.nextEmission && burst.emitted < gestureEffectLimits.wavefrontSpecksPerBurst) {
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

    function draw(now: number) {
      const drawContext = context!;
      const frameTime = Math.max(0, now - lastDraw);
      const delta = Math.min(0.032, frameTime / 1000);
      lastDraw = now;
      emissionBudget.update(frameTime);
      if (effectsEnabledLastFrame && !blueTearsEnabledRef.current) {
        blueTears.length = 0;
        waterRipples.length = 0;
      }
      effectsEnabledLastFrame = blueTearsEnabledRef.current;
      if (now - gestureEmissionWindowStartedAt >= 1000) {
        gestureEmissionsPerSecond = gestureEmissionsInWindow * 1000 / Math.max(1, now - gestureEmissionWindowStartedAt);
        gestureEmissionsInWindow = 0;
        gestureEmissionWindowStartedAt = now;
      }
      drawContext.clearRect(0, 0, width, height);
      drawContext.save();
      drawContext.globalCompositeOperation = 'lighter';
      if (blueTearsEnabledRef.current) {
        drawParticles(blueTears, now, delta);
        for (let index = waterRipples.length - 1; index >= 0; index -= 1) {
          if (!drawRipplePath(waterRipples[index], now)) waterRipples.splice(index, 1);
        }
      }
      for (let index = explosionBursts.length - 1; index >= 0; index -= 1) {
        if (!drawExplosion(explosionBursts[index], now)) explosionBursts.splice(index, 1);
      }
      drawContext.restore();
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        (window as typeof window & { __soundSpaceInteractionStats?: unknown }).__soundSpaceInteractionStats = {
          frameTimeMs: frameTime,
          blueTears: blueTears.length,
          waterRipples: waterRipples.length,
          explosionBursts: explosionBursts.length,
          adaptiveEmissionFactor: emissionBudget.read(),
          gestureEmissionFactor: emissionBudget.read('gesture'),
          gestureEmissionsPerSecond,
          ...controller.getPerformanceSnapshot(),
        };
      }
      if (explosionBursts.length || (blueTearsEnabledRef.current && (blueTears.length || waterRipples.length))) {
        frame = requestAnimationFrame(draw);
      } else {
        running = false;
      }
    }

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('scroll', invalidateMusicStageRect, { passive: true });
    window.visualViewport?.addEventListener('resize', resize);
    return () => {
      unsubscribe();
      cancelAnimationFrame(frame);
      clearEffects();
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', invalidateMusicStageRect);
      window.visualViewport?.removeEventListener('resize', resize);
    };
  }, [controller]);

  return <canvas ref={canvasRef} className="gesture-effects-overlay" aria-hidden="true" />;
}
