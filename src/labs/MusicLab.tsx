import { Download, Pause, Play, StopCircle } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type WheelEvent } from 'react';
import { RangeControl } from '../components/RangeControl';
import { SegmentedControl } from '../components/SegmentedControl';
import { gesturePointToElement } from '../gesture/coordinateTransform';
import type { GestureInteractionController } from '../gesture/interactionController';
import { mapPageScrollDelta } from '../gesture/navigationGesture';
import type { MusicSessionState } from '../music/musicSession';
import { audioAccept, type MusicAudioController } from '../music/useMusicAudioController';
import type { PointerPoint } from '../types';
import type { WorldInputSource, WorldInteractionController } from '../interaction/worldInteraction';
import { worldInteractionThresholds } from '../interaction/worldInteraction';
import { formatTime } from '../utils/format';
import { WaveCanvas } from '../visualization/WaveCanvas';
import type { Repulsor, SpiritGestureForces } from '../visualization/repulsor';
import type { SoundSpiritPhenotypeConfig } from '../spirit/soundSpiritIdentity';

type ViewMode = 'wave' | 'spectrum';
const masterCreatureScale = 0.7;

interface MusicLabProps {
  session: MusicSessionState;
  onSessionChange: (patch: Partial<MusicSessionState>) => void;
  controller: MusicAudioController;
  spiritPhenotype: SoundSpiritPhenotypeConfig;
  gestureController: GestureInteractionController;
  worldInteraction: WorldInteractionController;
}

export function MusicLab({ session, onSessionChange, controller, spiritPhenotype, gestureController, worldInteraction }: MusicLabProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('wave');
  const [repulsor, setRepulsor] = useState<Repulsor | null>(null);
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
  const lastTapRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const worldPathRef = useRef(new Map<number, { x: number; y: number; time: number; velocityX: number; velocityY: number }>());
  const holdCandidatesRef = useRef(new Map<number, { source: WorldInputSource; x: number; y: number; startX: number; startY: number; startedAt: number; moved: boolean; active: boolean }>());
  const stageRef = useRef<HTMLDivElement | null>(null);
  const gestureForcesRef = useRef<SpiritGestureForces>({});
  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;
  const pointer: PointerPoint = { x: 0.5, y: 0.5 };
  const [filePickerReady, setFilePickerReady] = useState(false);

  useEffect(() => {
    setRepulsor(null);
    lastRepulsorPointRef.current = null;
    touchPointersRef.current.clear();
    pinchRef.current = null;
    gesturePinchedRef.current = false;
    worldPathRef.current.clear();
    holdCandidatesRef.current.clear();
    worldInteraction.clear('mouse');
    worldInteraction.clear('touch');
  }, [viewMode]);

  useEffect(() => {
    let frame = 0;
    let lastTimestamp = -1;
    let displacementUntil = 0;
    let explosionStartedAt = 0;
    let attractionStrength = 0;
    let attractionX = 0.5;
    let attractionY = 0.5;
    let lastFrameTime = performance.now();
    const unsubscribe = worldInteraction.subscribe((event) => {
      const stage = stageRef.current;
      if (!stage || viewModeRef.current !== 'spectrum') return;
      const local = gesturePointToElement(event.point, stage);
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
          const local = gesturePointToElement(gesture.fist.point, stage);
          if (!local.inside) window.scrollBy({ top: mapPageScrollDelta(gesture.fist.deltaY), behavior: 'auto' });
        }
      }
      if (viewModeRef.current !== 'spectrum') {
        worldInteraction.clear('gesture');
        gestureForcesRef.current = {};
        return;
      }
      const pointerLocal = gesture.pointer ? gesturePointToElement(gesture.pointer.point, stage) : undefined;
      const currentOwner = worldInteraction.readAttraction();
      if (!currentOwner || currentOwner.source === 'gesture') {
        if (pointerLocal?.inside) worldInteraction.setAttraction('gesture', gesture.pointer!.point, true, now);
        else worldInteraction.clear('gesture');
      }
      for (const candidate of holdCandidatesRef.current.values()) {
        if (candidate.moved || candidate.active || now - candidate.startedAt < worldInteractionThresholds.holdMs) continue;
        candidate.active = true;
        setRepulsor(null);
        worldInteraction.setAttraction(candidate.source, { x: candidate.x, y: candidate.y, z: 0 }, true, now);
      }
      const attraction = worldInteraction.readAttraction();
      const attractionLocal = attraction ? gesturePointToElement(attraction.point, stage) : undefined;
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
    const rect = event.currentTarget.getBoundingClientRect();
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

  const startHoldCandidate = (event: PointerEvent<HTMLDivElement>) => {
    const point = viewportPoint(event.clientX, event.clientY);
    holdCandidatesRef.current.set(event.pointerId, {
      source: event.pointerType === 'touch' ? 'touch' : 'mouse',
      x: point.x,
      y: point.y,
      startX: event.clientX,
      startY: event.clientY,
      startedAt: performance.now(),
      moved: false,
      active: false,
    });
  };

  const updateHoldCandidate = (event: PointerEvent<HTMLDivElement>) => {
    const candidate = holdCandidatesRef.current.get(event.pointerId);
    if (!candidate) return;
    const point = viewportPoint(event.clientX, event.clientY);
    candidate.x = point.x;
    candidate.y = point.y;
    if (Math.hypot(event.clientX - candidate.startX, event.clientY - candidate.startY) > worldInteractionThresholds.holdMovementPx) {
      candidate.moved = true;
      if (candidate.active) worldInteraction.clear(candidate.source);
    }
  };

  const releaseHoldCandidate = (event: PointerEvent<HTMLDivElement>) => {
    const candidate = holdCandidatesRef.current.get(event.pointerId);
    if (candidate?.active) worldInteraction.clear(candidate.source);
    holdCandidatesRef.current.delete(event.pointerId);
    worldPathRef.current.delete(event.pointerId);
  };

  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (viewMode === 'spectrum') {
      startHoldCandidate(event);
      disturbWorld(event);
      if (event.pointerType === 'touch') {
        event.currentTarget.setPointerCapture(event.pointerId);
        touchPointersRef.current.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
          startX: event.clientX,
          startY: event.clientY,
          startTime: performance.now(),
        });
        updateSpectrumStimulus(event, true);
        if (touchPointersRef.current.size === 2) {
          const [first, second] = [...touchPointersRef.current.values()];
          pinchRef.current = {
            distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
            mode: 'spectrum',
            creatureScale,
          };
          setRepulsor(null);
          return;
        }
        return;
      }
      if (event.detail > 1) return;
      updateSpectrumStimulus(event, true);
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
      disturbWorld(event);
      updateHoldCandidate(event);
      const tracked = touchPointersRef.current.get(event.pointerId);
      if (event.pointerType !== 'touch' && !tracked) {
        updateSpectrumStimulus(event, event.buttons > 0);
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
      if (tracked) updateSpectrumStimulus(event, true);
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
      if (event.pointerType === 'touch') {
        const tracked = touchPointersRef.current.get(event.pointerId);
        const moved = tracked ? Math.hypot(event.clientX - tracked.startX, event.clientY - tracked.startY) : Infinity;
        const now = performance.now();
        if (tracked && moved <= 10 && now - tracked.startTime < 420 && touchPointersRef.current.size === 1 && !pinchRef.current) {
          const previous = lastTapRef.current;
          if (previous && now - previous.time < 340 && Math.hypot(event.clientX - previous.x, event.clientY - previous.y) < 34) {
            lastTapRef.current = null;
            worldInteraction.pulse('touch', viewportPoint(event.clientX, event.clientY), now);
            worldInteraction.clear('touch');
          } else {
            lastTapRef.current = { x: event.clientX, y: event.clientY, time: now };
          }
        }
        touchPointersRef.current.delete(event.pointerId);
        setRepulsor(null);
        lastRepulsorPointRef.current = null;
        if (touchPointersRef.current.size < 2) pinchRef.current = null;
      } else {
        updateSpectrumStimulus(event, false);
      }
      releaseHoldCandidate(event);
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
      releaseHoldCandidate(event);
      touchPointersRef.current.delete(event.pointerId);
      setRepulsor(null);
      lastRepulsorPointRef.current = null;
      if (touchPointersRef.current.size < 2) pinchRef.current = null;
      return;
    }
    touchPointersRef.current.delete(event.pointerId);
    if (touchPointersRef.current.size < 2) pinchRef.current = null;
    if (touchPointersRef.current.size === 0) gesturePinchedRef.current = false;
  };

  const pointerLeave = (event: PointerEvent<HTMLDivElement>) => {
    if (viewMode !== 'spectrum' || event.pointerType === 'touch') return;
    releaseHoldCandidate(event);
    setRepulsor(null);
    lastRepulsorPointRef.current = null;
  };

  const zoomFromWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!session.sourceUrl) return;
    if (viewMode === 'spectrum') {
      event.preventDefault();
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
          for (const [pointerId, candidate] of holdCandidatesRef.current) {
            if (candidate.source === 'mouse') holdCandidatesRef.current.delete(pointerId);
          }
          worldInteraction.clear('mouse');
          worldInteraction.pulse('mouse', viewportPoint(event.clientX, event.clientY), performance.now());
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
          creatureScale={creatureScale}
          repulsors={repulsor ? [repulsor] : []}
          gestureForcesRef={gestureForcesRef}
          spiritPhenotype={spiritPhenotype}
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
