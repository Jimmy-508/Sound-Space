import { Download, Pause, Play, StopCircle } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type WheelEvent } from 'react';
import { RangeControl } from '../components/RangeControl';
import { SegmentedControl } from '../components/SegmentedControl';
import type { GestureInteractionController } from '../gesture/interactionController';
import { mapPageScrollDelta } from '../gesture/navigationGesture';
import type { MusicSessionState } from '../music/musicSession';
import { audioAccept, type MusicAudioController } from '../music/useMusicAudioController';
import type { PointerPoint } from '../types';
import type { WorldInteractionController } from '../interaction/worldInteraction';
import { worldInteractionThresholds } from '../interaction/worldInteraction';
import { TapSequenceArbiter, TouchSessionArbiter, cancelTouchIntentsForPinch, updatePointerIntent, type PointerIntent } from '../interaction/pointerArbitration';
import { formatTime } from '../utils/format';
import { WaveCanvas } from '../visualization/WaveCanvas';
import type { Repulsor, SpiritGestureForces } from '../visualization/repulsor';
import type { SoundSpiritPhenotypeConfig } from '../spirit/soundSpiritIdentity';
import type { SoundSpiritPersonality } from '../spirit/soundSpiritPersonality';
import { isSoundSpiritBirthInteractionLocked } from '../spirit/soundSpiritBirth';

type ViewMode = 'wave' | 'spectrum';
const masterCreatureScale = 0.7;

interface MusicLabProps {
  session: MusicSessionState;
  onSessionChange: (patch: Partial<MusicSessionState>) => void;
  controller: MusicAudioController;
  spiritPhenotype: SoundSpiritPhenotypeConfig;
  spiritPersonality: SoundSpiritPersonality;
  spiritBirthToken: number;
  spiritBirthStartedAt: number;
  gestureController: GestureInteractionController;
  worldInteraction: WorldInteractionController;
}

export function MusicLab({ session, onSessionChange, controller, spiritPhenotype, spiritPersonality, spiritBirthToken, spiritBirthStartedAt, gestureController, worldInteraction }: MusicLabProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('wave');
  const repulsorsRef = useRef<Repulsor[]>([]);
  const [creatureScale, setCreatureScale] = useState(masterCreatureScale);
  const touchPointersRef = useRef(new Map<number, { x: number; y: number; startX: number; startY: number; startTime: number }>());
  const pinchRef = useRef<{
    distance: number;
    mode: ViewMode;
    zoom?: number;
    anchorFraction?: number;
    creatureScale?: number;
  } | null>(null);
  const gesturePinchedRef = useRef(false);
  const lastRepulsorPointRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const worldPathRef = useRef(new Map<number, { x: number; y: number; time: number; velocityX: number; velocityY: number }>());
  const pointerIntentsRef = useRef(new Map<number, PointerIntent>());
  const tapArbiterRef = useRef(new TapSequenceArbiter());
  const touchSessionRef = useRef(new TouchSessionArbiter());
  const tapTimersRef = useRef(new Map<'mouse' | 'touch', number>());
  const scaleAnimationRef = useRef(0);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const stageRectRef = useRef<DOMRect | null>(null);
  const gestureForcesRef = useRef<SpiritGestureForces>({});
  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;
  const birthRef = useRef({ token: spiritBirthToken, startedAt: spiritBirthStartedAt });
  birthRef.current = { token: spiritBirthToken, startedAt: spiritBirthStartedAt };
  const birthInteractionLocked = () => viewModeRef.current === 'spectrum'
    && isSoundSpiritBirthInteractionLocked(birthRef.current.token, birthRef.current.startedAt);
  const pointer: PointerPoint = { x: 0.5, y: 0.5 };
  const [filePickerReady, setFilePickerReady] = useState(false);

  useLayoutEffect(() => {
    if (spiritBirthToken > 0) setViewMode('spectrum');
  }, [spiritBirthToken]);

  const setRepulsor = (repulsor: Repulsor | null) => {
    if (repulsor) repulsorsRef.current[0] = repulsor;
    else repulsorsRef.current.length = 0;
  };

  const pointInStage = (point: { x: number; y: number }) => {
    const rect = stageRectRef.current;
    const viewportX = point.x * window.innerWidth;
    const viewportY = point.y * window.innerHeight;
    if (!rect) return { x: 0.5, y: 0.5, inside: false };
    return {
      x: (viewportX - rect.left) / Math.max(1, rect.width),
      y: (viewportY - rect.top) / Math.max(1, rect.height),
      inside: viewportX >= rect.left && viewportX <= rect.right && viewportY >= rect.top && viewportY <= rect.bottom,
    };
  };

  useEffect(() => {
    setRepulsor(null);
    lastRepulsorPointRef.current = null;
    touchPointersRef.current.clear();
    pinchRef.current = null;
    gesturePinchedRef.current = false;
    worldPathRef.current.clear();
    pointerIntentsRef.current.clear();
    touchSessionRef.current.reset();
    tapArbiterRef.current.clear();
    worldInteraction.clear('mouse');
    worldInteraction.clear('touch');
  }, [viewMode]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const refresh = () => { stageRectRef.current = stage.getBoundingClientRect(); };
    const observer = new ResizeObserver(refresh);
    observer.observe(stage);
    refresh();
    window.addEventListener('resize', refresh);
    window.addEventListener('scroll', refresh, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', refresh);
      window.removeEventListener('scroll', refresh);
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    let lastTimestamp = -1;
    let displacementUntil = 0;
    let explosionStartedAt = 0;
    let attractionStrength = 0;
    let attractionX = 0.5;
    let attractionY = 0.5;
    let lastFrameTime = performance.now();
    let birthWasLocked = false;
    const unsubscribe = worldInteraction.subscribe((event) => {
      const stage = stageRef.current;
      if (!stage || viewModeRef.current !== 'spectrum') return;
      const local = pointInStage(event.point);
      if (!local.inside) return;
      if (event.type === 'disturbance') {
        if (event.source !== 'gesture') return;
        gestureForcesRef.current.displacement = {
          x: local.x,
          y: local.y,
          radius: 0.28,
          strength: 0.72,
          velocityX: event.velocityX,
          velocityY: event.velocityY,
          type: 'hand',
          updatedAt: event.timestamp,
          contact: true,
          active: true,
          source: 'hand',
          speed: event.speed,
        };
        displacementUntil = event.timestamp + 190;
        explosionStartedAt = 0;
      } else {
        gestureForcesRef.current.displacement = {
          x: local.x,
          y: local.y,
          radius: 0.2,
          currentRadius: 0.035,
          strength: 6.4,
          type: 'ripple',
          updatedAt: event.timestamp,
          contact: true,
          active: true,
          source: 'hand',
          speed: 4.2,
        };
        explosionStartedAt = event.timestamp;
        displacementUntil = event.timestamp + 1120;
      }
    });
    const update = (now: number) => {
      frame = requestAnimationFrame(update);
      const deltaTime = Math.min(0.05, Math.max(0, (now - lastFrameTime) / 1000));
      lastFrameTime = now;
      const stage = stageRef.current;
      const gesture = gestureController.read();
      if (!stage) return;
      if (gesture.timestamp !== lastTimestamp) {
        lastTimestamp = gesture.timestamp;
        if (gesture.fist?.axis === 'y') {
          const local = pointInStage(gesture.fist.point);
          if (!local.inside) window.scrollBy({ top: mapPageScrollDelta(gesture.fist.deltaY), behavior: 'auto' });
        }
      }
      const birthLocked = isSoundSpiritBirthInteractionLocked(birthRef.current.token, birthRef.current.startedAt, now);
      if (viewModeRef.current === 'spectrum' && birthLocked) {
        setRepulsor(null);
        gestureForcesRef.current = {};
        if (!birthWasLocked) worldInteraction.clear();
        birthWasLocked = true;
        return;
      }
      birthWasLocked = false;
      if (viewModeRef.current !== 'spectrum') {
        worldInteraction.clear('gesture');
        gestureForcesRef.current = {};
        return;
      }
      const pointerLocal = gesture.pointer ? pointInStage(gesture.pointer.point) : undefined;
      const currentOwner = worldInteraction.readAttraction();
      if (!currentOwner || currentOwner.source === 'gesture') {
        if (pointerLocal?.inside) worldInteraction.setAttraction('gesture', gesture.pointer!.point, true, now);
        else worldInteraction.clear('gesture');
      }
      for (const candidate of pointerIntentsRef.current.values()) {
        if (candidate.source === 'touch' && !touchSessionRef.current.canArmAttraction()) continue;
        if (candidate.state !== 'pending' || now - candidate.startedAt < worldInteractionThresholds.holdMs) continue;
        candidate.state = 'attraction';
        setRepulsor(null);
        worldInteraction.setAttraction(candidate.source, { x: candidate.worldX, y: candidate.worldY, z: 0 }, true, now);
      }
      const attraction = worldInteraction.readAttraction();
      const attractionLocal = attraction ? pointInStage(attraction.point) : undefined;
      const attractionTarget = attractionLocal?.inside ? 1 : 0;
      if (attractionLocal?.inside) {
        const targetBlend = 1 - Math.exp(-deltaTime * 12);
        attractionX += (attractionLocal.x - attractionX) * targetBlend;
        attractionY += (attractionLocal.y - attractionY) * targetBlend;
      }
      const strengthBlend = 1 - Math.exp(-deltaTime * (attractionTarget ? 10 : 2.8));
      attractionStrength += (attractionTarget - attractionStrength) * strengthBlend;
      gestureForcesRef.current.attraction = attractionStrength > 0.015
        ? { x: attractionX, y: attractionY, strength: attractionStrength * 1.65, active: true }
        : undefined;
      const displacement = gestureForcesRef.current.displacement;
      if (displacement && now >= displacementUntil) gestureForcesRef.current.displacement = undefined;
      if (displacement?.type === 'ripple' && explosionStartedAt) {
        const progress = Math.min(1, (now - explosionStartedAt) / 1120);
        displacement.currentRadius = 0.035 + progress * 0.765;
        displacement.strength = 6.4 * (1 - progress * 0.62);
      }
    };
    frame = requestAnimationFrame(update);
    return () => {
      unsubscribe();
      cancelAnimationFrame(frame);
      gestureForcesRef.current = {};
      worldInteraction.clear();
      for (const timer of tapTimersRef.current.values()) window.clearTimeout(timer);
      cancelAnimationFrame(scaleAnimationRef.current);
    };
  }, [gestureController, worldInteraction]);

  useEffect(() => {
    const ready = () => setFilePickerReady(true);
    const reset = () => setFilePickerReady(false);
    window.addEventListener('soundspace:file-picker-ready', ready);
    window.addEventListener('soundspace:gesture-reset', reset);
    window.addEventListener('soundspace:file-picker-reset', reset);
    return () => {
      window.removeEventListener('soundspace:file-picker-ready', ready);
      window.removeEventListener('soundspace:gesture-reset', reset);
      window.removeEventListener('soundspace:file-picker-reset', reset);
    };
  }, []);

  useEffect(() => {
    if (!filePickerReady) return;
    const timeout = window.setTimeout(() => setFilePickerReady(false), 7000);
    return () => window.clearTimeout(timeout);
  }, [filePickerReady]);

  useEffect(() => {
    if (!session.duration || session.zoom <= 1) {
      if (session.viewStart !== 0) onSessionChange({ viewStart: 0 });
      return;
    }
    const visible = 1 / session.zoom;
    const progress = Math.min(1, Math.max(0, session.current / session.duration));
    let next = session.viewStart;
    if (progress > next + visible * 0.82) next = progress - visible * 0.68;
    if (progress < next) next = progress - visible * 0.18;
    next = Math.min(1 - visible, Math.max(0, next));
    if (Math.abs(next - session.viewStart) > 0.001) onSessionChange({ viewStart: next });
  }, [session.current, session.duration, session.viewStart, session.zoom, onSessionChange]);

  const maxZoom = getMaxZoom(session.duration, session.sampleRate);
  const setZoomAt = (requested: number, anchorLocal: number, baseZoom = session.zoom, baseViewStart = session.viewStart) => {
    const zoom = Math.min(maxZoom, Math.max(1, requested));
    const safeAnchor = Math.min(1, Math.max(0, anchorLocal));
    const anchorFraction = baseViewStart + safeAnchor / Math.max(1, baseZoom);
    const visible = 1 / zoom;
    const viewStart = zoom <= 1 ? 0 : Math.min(1 - visible, Math.max(0, anchorFraction - safeAnchor * visible));
    onSessionChange({ zoom, viewStart });
  };

  const seekAtClientX = (clientX: number, surface: HTMLDivElement) => {
    const rect = surface.getBoundingClientRect();
    const local = Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(1, rect.width)));
    const fraction = Math.min(1, session.viewStart + local / session.zoom);
    const time = fraction * session.duration;
    controller.seek(time);
  };

  const updateSpectrumStimulus = (event: PointerEvent<HTMLDivElement>, contact: boolean) => {
    const rect = stageRectRef.current ?? event.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / Math.max(1, rect.width)));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / Math.max(1, rect.height)));
    const now = performance.now();
    const previous = lastRepulsorPointRef.current;
    const elapsed = Math.max(8, now - (previous?.time ?? now));
    const velocityX = previous ? (x - previous.x) / elapsed * 1000 : 0;
    const velocityY = previous ? (y - previous.y) / elapsed * 1000 : 0;
    const speed = Math.hypot(velocityX, velocityY);
    setRepulsor({
      x,
      y,
      radius: contact ? 0.238 + Math.min(0.154, speed * 0.028) : 0.31,
      strength: contact ? 1.5 + Math.min(2.5, speed * 0.45) : 0.22,
      velocityX,
      velocityY,
      type: 'pointer',
      updatedAt: now,
      contact,
      active: true,
      source: event.pointerType === 'touch' ? 'touch' : 'mouse',
      speed,
    });
    lastRepulsorPointRef.current = { x, y, time: now };
  };

  const viewportPoint = (clientX: number, clientY: number) => ({
    x: Math.min(1, Math.max(0, clientX / Math.max(1, window.innerWidth))),
    y: Math.min(1, Math.max(0, clientY / Math.max(1, window.innerHeight))),
    z: 0,
  });

  const disturbWorld = (event: PointerEvent<HTMLDivElement>) => {
    const now = performance.now();
    const point = viewportPoint(event.clientX, event.clientY);
    const previous = worldPathRef.current.get(event.pointerId);
    if (previous) {
      const elapsed = Math.max(8, now - previous.time) / 1000;
      const velocityX = (point.x - previous.x) / elapsed;
      const velocityY = (point.y - previous.y) / elapsed;
      const speed = Math.hypot(velocityX, velocityY);
      const turnIntensity = Math.min(1, Math.hypot(velocityX - previous.velocityX, velocityY - previous.velocityY) / 1.4);
      worldInteraction.disturb({
        type: 'disturbance',
        source: event.pointerType === 'touch' ? 'touch' : 'mouse',
        geometry: 'pointer',
        point,
        previousPoint: { x: previous.x, y: previous.y, z: 0 },
        velocityX,
        velocityY,
        speed,
        turnIntensity,
        timestamp: now,
        producerId: event.pointerId,
      });
      previous.velocityX = velocityX;
      previous.velocityY = velocityY;
      previous.x = point.x;
      previous.y = point.y;
      previous.time = now;
    } else {
      worldPathRef.current.set(event.pointerId, { x: point.x, y: point.y, time: now, velocityX: 0, velocityY: 0 });
    }
  };

  const startPointerIntent = (event: PointerEvent<HTMLDivElement>) => {
    const point = viewportPoint(event.clientX, event.clientY);
    pointerIntentsRef.current.set(event.pointerId, {
      source: event.pointerType === 'touch' ? 'touch' : 'mouse',
      state: 'pending',
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      worldX: point.x,
      worldY: point.y,
      startedAt: performance.now(),
    });
  };

  const updatePointerSession = (event: PointerEvent<HTMLDivElement>) => {
    const candidate = pointerIntentsRef.current.get(event.pointerId);
    if (!candidate) return undefined;
    const previousState = candidate.state;
    const point = viewportPoint(event.clientX, event.clientY);
    candidate.worldX = point.x;
    candidate.worldY = point.y;
    updatePointerIntent(candidate, event.clientX, event.clientY);
    if (candidate.state === 'drag' && previousState !== 'drag') {
      worldInteraction.clear(candidate.source);
      worldPathRef.current.set(event.pointerId, {
        x: candidate.startX / Math.max(1, window.innerWidth),
        y: candidate.startY / Math.max(1, window.innerHeight),
        time: candidate.startedAt,
        velocityX: 0,
        velocityY: 0,
      });
    }
    return candidate;
  };

  const releasePointerIntent = (event: PointerEvent<HTMLDivElement>) => {
    const candidate = pointerIntentsRef.current.get(event.pointerId);
    if (candidate?.state === 'attraction') worldInteraction.clear(candidate.source);
    pointerIntentsRef.current.delete(event.pointerId);
    worldPathRef.current.delete(event.pointerId);
    return candidate;
  };

  const cancelTouchAttractionForPinch = () => {
    cancelTouchIntentsForPinch(pointerIntentsRef.current);
    worldInteraction.clear('touch');
    setRepulsor(null);
    lastRepulsorPointRef.current = null;
  };

  const resetCreatureScale = () => {
    cancelAnimationFrame(scaleAnimationRef.current);
    setRepulsor(null);
    lastRepulsorPointRef.current = null;
    const from = creatureScale;
    const startedAt = performance.now();
    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / 280);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCreatureScale(from + (masterCreatureScale - from) * eased);
      if (progress < 1) scaleAnimationRef.current = requestAnimationFrame(animate);
    };
    scaleAnimationRef.current = requestAnimationFrame(animate);
  };

  const recordTap = (source: 'mouse' | 'touch', x: number, y: number, timestamp: number) => {
    const action = tapArbiterRef.current.tap(source, x, y, timestamp);
    window.clearTimeout(tapTimersRef.current.get(source));
    if (action === 'triple') {
      resetCreatureScale();
      worldInteraction.clear(source);
      return;
    }
    if (action !== 'double-pending') return;
    tapTimersRef.current.set(source, window.setTimeout(() => {
      const due = tapArbiterRef.current.consumeDue(source, performance.now());
      if (due) worldInteraction.pulse(source, viewportPoint(due.x, due.y), performance.now());
    }, worldInteractionThresholds.tripleTapGraceMs + 8));
  };

  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (viewMode === 'spectrum') {
      if (birthInteractionLocked()) return;
      if (event.pointerType === 'touch') {
        event.currentTarget.setPointerCapture(event.pointerId);
        touchPointersRef.current.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
          startX: event.clientX,
          startY: event.clientY,
          startTime: performance.now(),
        });
        const ownership = touchSessionRef.current.begin(event.pointerId);
        if (ownership.enteredPinch) {
          cancelTouchAttractionForPinch();
          const [first, second] = [...touchPointersRef.current.values()];
          pinchRef.current = {
            distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
            mode: 'spectrum',
            creatureScale,
          };
          return;
        }
        if (touchSessionRef.current.canArmAttraction()) startPointerIntent(event);
        return;
      }
      startPointerIntent(event);
      return;
    }
    if (viewMode !== 'wave' || !session.duration || !session.sourceUrl) return;
    if (event.pointerType !== 'touch') {
      seekAtClientX(event.clientX, event.currentTarget);
      return;
    }
    if (touchPointersRef.current.size === 0) gesturePinchedRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    touchPointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      startTime: performance.now(),
    });
    if (touchPointersRef.current.size === 2) {
      const [first, second] = [...touchPointersRef.current.values()];
      const rect = event.currentTarget.getBoundingClientRect();
      const midpoint = (first.x + second.x) / 2;
      const anchorLocal = Math.min(1, Math.max(0, (midpoint - rect.left) / Math.max(1, rect.width)));
      pinchRef.current = {
        distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
        mode: 'wave',
        zoom: session.zoom,
        anchorFraction: session.viewStart + anchorLocal / session.zoom,
      };
      gesturePinchedRef.current = true;
    }
  };

  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (viewMode === 'spectrum') {
      if (birthInteractionLocked()) {
        setRepulsor(null);
        return;
      }
      const tracked = touchPointersRef.current.get(event.pointerId);
      if (event.pointerType !== 'touch' && !tracked) {
        const session = pointerIntentsRef.current.get(event.pointerId);
        if (session) {
          const intent = updatePointerSession(event);
          if (intent?.state === 'drag') {
            disturbWorld(event);
            updateSpectrumStimulus(event, true);
          }
        } else {
          disturbWorld(event);
          updateSpectrumStimulus(event, false);
        }
        return;
      }
      if (tracked) {
        tracked.x = event.clientX;
        tracked.y = event.clientY;
      }
      if (touchPointersRef.current.size === 2 && pinchRef.current?.mode === 'spectrum') {
        const [first, second] = [...touchPointersRef.current.values()];
        const distance = Math.max(1, Math.hypot(second.x - first.x, second.y - first.y));
        setCreatureScale(clampCreatureScale((pinchRef.current.creatureScale ?? creatureScale) * distance / pinchRef.current.distance));
        setRepulsor(null);
        return;
      }
      if (tracked) {
        const intent = updatePointerSession(event);
        if (intent?.state === 'attraction') {
          worldInteraction.setAttraction(intent.source, { x: intent.worldX, y: intent.worldY, z: 0 }, true, performance.now());
        } else if (intent?.state === 'drag') {
          disturbWorld(event);
          updateSpectrumStimulus(event, true);
        }
      }
      return;
    }
    const tracked = touchPointersRef.current.get(event.pointerId);
    if (!tracked) return;
    tracked.x = event.clientX;
    tracked.y = event.clientY;
    if (touchPointersRef.current.size !== 2 || pinchRef.current?.mode !== 'wave') return;
    const [first, second] = [...touchPointersRef.current.values()];
    const distance = Math.max(1, Math.hypot(second.x - first.x, second.y - first.y));
    const rect = event.currentTarget.getBoundingClientRect();
    const midpointLocal = Math.min(1, Math.max(0, ((first.x + second.x) / 2 - rect.left) / Math.max(1, rect.width)));
    const zoom = Math.min(maxZoom, Math.max(1, (pinchRef.current.zoom ?? session.zoom) * distance / pinchRef.current.distance));
    const visible = 1 / zoom;
    const viewStart = zoom <= 1 ? 0 : Math.min(1 - visible, Math.max(0, (pinchRef.current.anchorFraction ?? 0) - midpointLocal * visible));
    onSessionChange({ zoom, viewStart });
  };

  const pointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (viewMode === 'spectrum') {
      const intent = pointerIntentsRef.current.get(event.pointerId);
      const now = performance.now();
      const isTap = !birthInteractionLocked()
        && intent?.state === 'pending'
        && now - intent.startedAt <= worldInteractionThresholds.tapDurationMs
        && touchPointersRef.current.size <= 1
        && !touchSessionRef.current.isPinchLocked();
      if (isTap) recordTap(intent.source, event.clientX, event.clientY, now);
      if (event.pointerType === 'touch') {
        touchPointersRef.current.delete(event.pointerId);
        const ownership = touchSessionRef.current.release(event.pointerId);
        setRepulsor(null);
        lastRepulsorPointRef.current = null;
        if (ownership.activeCount === 0) pinchRef.current = null;
      }
      releasePointerIntent(event);
      return;
    }
    const tracked = touchPointersRef.current.get(event.pointerId);
    if (!tracked) return;
    const moved = Math.hypot(event.clientX - tracked.startX, event.clientY - tracked.startY) > 8;
    if (!gesturePinchedRef.current && !moved && touchPointersRef.current.size === 1) {
      seekAtClientX(event.clientX, event.currentTarget);
    }
    touchPointersRef.current.delete(event.pointerId);
    if (touchPointersRef.current.size < 2) pinchRef.current = null;
    if (touchPointersRef.current.size === 0) gesturePinchedRef.current = false;
  };

  const pointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    if (viewMode === 'spectrum') {
      releasePointerIntent(event);
      touchPointersRef.current.delete(event.pointerId);
      const ownership = touchSessionRef.current.release(event.pointerId);
      setRepulsor(null);
      lastRepulsorPointRef.current = null;
      if (ownership.activeCount === 0) pinchRef.current = null;
      return;
    }
    touchPointersRef.current.delete(event.pointerId);
    if (touchPointersRef.current.size < 2) pinchRef.current = null;
    if (touchPointersRef.current.size === 0) gesturePinchedRef.current = false;
  };

  const pointerLeave = (event: PointerEvent<HTMLDivElement>) => {
    if (viewMode !== 'spectrum' || event.pointerType === 'touch') return;
    releasePointerIntent(event);
    setRepulsor(null);
    lastRepulsorPointRef.current = null;
  };

  const zoomFromWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!session.sourceUrl) return;
    if (viewMode === 'spectrum') {
      event.preventDefault();
      if (birthInteractionLocked()) return;
      setCreatureScale((current) => clampCreatureScale(current * Math.exp(-event.deltaY * 0.0018)));
      return;
    }
    if (maxZoom <= 1) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const anchorLocal = (event.clientX - rect.left) / Math.max(1, rect.width);
    setZoomAt(session.zoom * Math.exp(-event.deltaY * 0.0025), anchorLocal);
  };

  return (
    <section className="lab-layout">
      <div
        ref={stageRef}
        className="stage music-stage"
        data-gesture-zone={viewMode === 'spectrum' ? 'spirit' : undefined}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerCancel}
        onPointerLeave={pointerLeave}
        onContextMenu={(event) => event.preventDefault()}
        onDoubleClick={(event) => {
          if (viewMode !== 'spectrum') return;
          event.preventDefault();
        }}
        onWheel={zoomFromWheel}
      >
        <WaveCanvas
          amplitude={0.7}
          frequency={420}
          pointer={pointer}
          mode="music"
          musicData={viewMode === 'wave' ? session.waveformData : null}
          musicPcmData={session.pcmData}
          musicSampleRate={session.sampleRate}
          spectrumData={controller.spectrumData}
          musicProgress={session.duration ? session.current / session.duration : 0}
          musicZoom={session.zoom}
          musicViewStart={session.viewStart}
          musicTime={session.current}
          musicVisualSeed={session.visualSeed}
          musicPlaying={controller.playing}
          musicVisualStateRef={controller.visualStateRef}
          creatureScale={creatureScale}
          repulsorsRef={repulsorsRef}
          gestureForcesRef={gestureForcesRef}
          spiritPhenotype={spiritPhenotype}
          spiritPersonality={spiritPersonality}
          spiritBirthToken={spiritBirthToken}
          spiritBirthStartedAt={spiritBirthStartedAt}
        />
      </div>

      <aside className="control-panel">
        <label className={`file-picker ${filePickerReady ? 'gesture-file-ready' : ''}`} data-gesture-ready={filePickerReady ? 'true' : undefined}>
          <Download size={20} />
          <span>匯入音訊</span>
          <span className="file-picker-ready-hint" aria-live="polite">{filePickerReady ? '請輕觸以選擇音樂' : ''}</span>
          <input
            type="file"
            accept={audioAccept}
            onPointerDown={() => setFilePickerReady(false)}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (!file) return;
              setFilePickerReady(false);
              void controller.loadFile(file);
              event.currentTarget.value = '';
            }}
          />
        </label>
        {controller.error && <p className="error-message">{controller.error}</p>}
        <p className="quiet compact-note">支援 MP3、WAV、M4A</p>

        <SegmentedControl label="觀察內容" value={viewMode} options={[{ value: 'wave', label: '聲音波形' }, { value: 'spectrum', label: '頻譜' }]} onChange={setViewMode} />
        <RangeControl label="音量" value={Math.round(session.volume * 100)} min={0} max={100} step={1} display={`${Math.round(session.volume * 100)}%`} onChange={(value) => onSessionChange({ volume: value / 100 })} />

        <div className="button-row">
          <button type="button" className="primary" onClick={() => void controller.play()} disabled={!session.fileName}>
            <Play size={19} />播放
          </button>
          <button type="button" onClick={controller.pause} disabled={!session.fileName}>
            <Pause size={19} />暫停
          </button>
          <button type="button" onClick={controller.stop} disabled={!session.fileName}>
            <StopCircle size={19} />停止
          </button>
        </div>

        <div className="progress-wrap">
          <input
            className="timeline-slider"
            type="range"
            min={0}
            max={session.duration || 1}
            step={0.01}
            value={Math.min(session.current, session.duration || 1)}
            disabled={!session.sourceUrl}
            aria-label="音樂播放位置"
            aria-valuetext={`${formatTime(session.current)} / ${formatTime(session.duration)}`}
            style={{ '--timeline-progress': `${session.duration ? session.current / session.duration * 100 : 0}%` } as CSSProperties}
            onChange={(event) => {
              const time = Number(event.currentTarget.value);
              controller.seek(time);
            }}
          />
          <span>{formatTime(session.current)} / {formatTime(session.duration)}</span>
        </div>

        <div className="result-card">
          <span>檔案名稱</span>
          <strong>{session.fileName || '尚未選擇音訊'}</strong>
          <small>聲音長度：{session.duration ? formatTime(session.duration) : '等待匯入'}</small>
        </div>
      </aside>
    </section>
  );
}

function getMaxZoom(duration: number, sampleRate: number) {
  const minimumVisibleDuration = Math.max(0.02, sampleRate > 0 ? 32 / sampleRate : 0.02);
  return duration > 0 ? Math.max(1, duration / minimumVisibleDuration) : 1;
}

function clampCreatureScale(value: number) {
  return Math.min(1.68, Math.max(0.455, value));
}
