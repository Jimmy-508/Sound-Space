import { Download, Pause, Play, StopCircle } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type WheelEvent } from 'react';
import { RangeControl } from '../components/RangeControl';
import { SegmentedControl } from '../components/SegmentedControl';
import { refineVisualSeed, type MusicSessionState } from '../music/musicSession';
import type { PointerPoint } from '../types';
import { formatTime } from '../utils/format';
import { WaveCanvas } from '../visualization/WaveCanvas';
import type { Repulsor } from '../visualization/repulsor';

type ViewMode = 'wave' | 'spectrum';

interface MusicLabProps {
  session: MusicSessionState;
  onSessionChange: (patch: Partial<MusicSessionState>) => void;
  onReplaceFile: (file: File) => { sourceUrl: string; visualSeed: number };
}

const audioAccept = 'audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/aac,.mp3,.wav,.m4a,.aac';
const supportedAudioExtensions = ['.mp3', '.wav', '.m4a', '.aac'];
const supportedAudioMimeTypes = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac',
];
const unsupportedAudioMessage = '這個音訊格式目前無法在此瀏覽器播放，請改用其他 MP3、WAV 或 M4A 檔案。';

export function MusicLab({ session, onSessionChange, onReplaceFile }: MusicLabProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('wave');
  const [spectrumData, setSpectrumData] = useState<Uint8Array | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  const [repulsor, setRepulsor] = useState<Repulsor | null>(null);
  const [creatureScale, setCreatureScale] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const analyserDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const restoredSourceRef = useRef<string | null>(null);
  const loadVersionRef = useRef(0);
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
  const scaleAnimationRef = useRef(0);
  const pointer: PointerPoint = { x: 0.5, y: 0.5 };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 1;
    const gain = gainRef.current;
    const context = contextRef.current;
    if (gain && context) gain.gain.setTargetAtTime(session.volume, context.currentTime, 0.018);
  }, [session.volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !session.sourceUrl) return;
    if (audio.src !== session.sourceUrl) {
      audio.src = session.sourceUrl;
      audio.load();
    }
  }, [session.sourceUrl]);

  useEffect(() => {
    setRepulsor(null);
    lastRepulsorPointRef.current = null;
    touchPointersRef.current.clear();
    pinchRef.current = null;
    gesturePinchedRef.current = false;
  }, [viewMode]);

  useEffect(() => {
    let frame = 0;
    let lastProgressUpdate = 0;
    let lastSpectrumUpdate = 0;
    const tick = () => {
      const audio = audioRef.current;
      const analyser = analyserRef.current;
      const now = performance.now();
      if (audio && restoredSourceRef.current === session.sourceUrl && now - lastProgressUpdate >= 100) {
        onSessionChange({ current: audio.currentTime });
        lastProgressUpdate = now;
      }
      if (analyser && now - lastSpectrumUpdate >= 32) {
        const data = analyserDataRef.current ?? new Uint8Array(analyser.frequencyBinCount);
        analyserDataRef.current = data;
        analyser.getByteFrequencyData(data);
        setSpectrumData(data.slice());
        lastSpectrumUpdate = now;
      }
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [onSessionChange, session.sourceUrl]);

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

  useEffect(() => () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      onSessionChange({ current: audio.currentTime });
    }
    analyserRef.current?.disconnect();
    gainRef.current?.disconnect();
    cancelAnimationFrame(scaleAnimationRef.current);
    void contextRef.current?.close();
  }, [onSessionChange]);

  const loadFile = async (file: File) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!isSupportedAudioFile(file)) {
      setError(unsupportedAudioMessage);
      return;
    }

    const loadVersion = loadVersionRef.current + 1;
    loadVersionRef.current = loadVersion;
    const { sourceUrl, visualSeed } = onReplaceFile(file);
    restoredSourceRef.current = sourceUrl;
    audio.src = sourceUrl;
    audio.load();
    setPlaying(false);
    setSpectrumData(null);
    setError('');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      const context = contextRef.current ?? new AudioCtor();
      contextRef.current = context;
      const buffer = await context.decodeAudioData(arrayBuffer.slice(0));
      if (loadVersion !== loadVersionRef.current) return;
      const channel = buffer.getChannelData(0);
      const waveformData = createWaveformData(channel, 4096);
      const pcmData = channel.slice();
      onSessionChange({
        duration: buffer.duration,
        current: 0,
        waveformData,
        pcmData,
        sampleRate: buffer.sampleRate,
        visualSeed: refineVisualSeed(visualSeed, file, buffer.duration, channel),
        zoom: 1,
        viewStart: 0,
      });
    } catch {
      if (loadVersion === loadVersionRef.current) setError(unsupportedAudioMessage);
    }
  };

  const ensureAnalyser = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (analyserRef.current) {
      if (contextRef.current?.state === 'suspended') await contextRef.current.resume();
      return;
    }
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    const context = contextRef.current ?? new AudioCtor();
    contextRef.current = context;
    if (context.state === 'suspended') await context.resume();
    const source = context.createMediaElementSource(audio);
    const analyser = context.createAnalyser();
    const gain = context.createGain();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.72;
    gain.gain.value = session.volume;
    audio.volume = 1;
    source.connect(analyser);
    analyser.connect(gain);
    gain.connect(context.destination);
    analyserRef.current = analyser;
    gainRef.current = gain;
  };

  const play = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (session.duration && audio.currentTime >= session.duration - 0.02) audio.currentTime = 0;
    await ensureAnalyser();
    await audio.play();
    setPlaying(true);
  };

  const pause = () => {
    const audio = audioRef.current;
    audio?.pause();
    if (audio) onSessionChange({ current: audio.currentTime });
    setPlaying(false);
  };

  const stop = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    onSessionChange({ current: 0, viewStart: 0 });
    setPlaying(false);
  };

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
    if (audioRef.current) audioRef.current.currentTime = time;
    onSessionChange({ current: time });
  };

  const updateSpectrumRepulsor = (event: PointerEvent<HTMLDivElement>) => {
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
      radius: 0.34 + Math.min(0.22, speed * 0.04),
      strength: 1.5 + Math.min(2.5, speed * 0.45),
      velocityX,
      velocityY,
      type: 'pointer',
      updatedAt: now,
    });
    lastRepulsorPointRef.current = { x, y, time: now };
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
      setCreatureScale(from + (1 - from) * eased);
      if (progress < 1) scaleAnimationRef.current = requestAnimationFrame(animate);
    };
    scaleAnimationRef.current = requestAnimationFrame(animate);
  };

  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (viewMode === 'spectrum') {
      if (event.pointerType === 'touch') {
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
      updateSpectrumRepulsor(event);
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
      const tracked = touchPointersRef.current.get(event.pointerId);
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
      if (tracked && Math.hypot(tracked.x - tracked.startX, tracked.y - tracked.startY) > 6) {
        updateSpectrumRepulsor(event);
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
      if (event.pointerType === 'touch') {
        const tracked = touchPointersRef.current.get(event.pointerId);
        const moved = tracked ? Math.hypot(event.clientX - tracked.startX, event.clientY - tracked.startY) : Infinity;
        const now = performance.now();
        if (tracked && moved <= 10 && now - tracked.startTime < 420 && touchPointersRef.current.size === 1 && !pinchRef.current) {
          const previous = lastTapRef.current;
          if (previous && now - previous.time < 340 && Math.hypot(event.clientX - previous.x, event.clientY - previous.y) < 34) {
            lastTapRef.current = null;
            resetCreatureScale();
          } else {
            lastTapRef.current = { x: event.clientX, y: event.clientY, time: now };
          }
        }
        touchPointersRef.current.delete(event.pointerId);
        setRepulsor(null);
        lastRepulsorPointRef.current = null;
        if (touchPointersRef.current.size < 2) pinchRef.current = null;
      }
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
      <audio
        ref={audioRef}
        onLoadedMetadata={(event) => {
          const audio = event.currentTarget;
          if (restoredSourceRef.current !== session.sourceUrl) {
            audio.currentTime = Math.min(session.current, audio.duration || session.current);
            restoredSourceRef.current = session.sourceUrl;
          }
          onSessionChange({ duration: audio.duration });
        }}
        onError={() => session.fileName && setError(unsupportedAudioMessage)}
        onEnded={() => setPlaying(false)}
      />
      <div
        className="stage music-stage"
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerCancel}
        onPointerLeave={() => viewMode === 'spectrum' && setRepulsor(null)}
        onContextMenu={(event) => event.preventDefault()}
        onDoubleClick={(event) => {
          if (viewMode !== 'spectrum') return;
          event.preventDefault();
          resetCreatureScale();
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
          spectrumData={spectrumData}
          musicProgress={session.duration ? session.current / session.duration : 0}
          musicZoom={session.zoom}
          musicViewStart={session.viewStart}
          musicTime={session.current}
          musicVisualSeed={session.visualSeed}
          musicPlaying={playing}
          creatureScale={creatureScale}
          repulsors={repulsor ? [repulsor] : []}
        />
      </div>

      <aside className="control-panel">
        <label className="file-picker">
          <Download size={20} />
          <span>匯入音訊</span>
          <input
            type="file"
            accept={audioAccept}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (!file) return;
              void loadFile(file);
              event.currentTarget.value = '';
            }}
          />
        </label>
        {error && <p className="error-message">{error}</p>}
        <p className="quiet compact-note">支援 MP3、WAV、M4A</p>

        <SegmentedControl label="觀察內容" value={viewMode} options={[{ value: 'wave', label: '聲音波形' }, { value: 'spectrum', label: '頻譜' }]} onChange={setViewMode} />
        <RangeControl label="音量" value={Math.round(session.volume * 100)} min={0} max={100} step={1} display={`${Math.round(session.volume * 100)}%`} onChange={(value) => onSessionChange({ volume: value / 100 })} />

        <div className="button-row">
          <button type="button" className="primary" onClick={() => void play()} disabled={!session.fileName}>
            <Play size={19} />播放
          </button>
          <button type="button" onClick={pause} disabled={!session.fileName}>
            <Pause size={19} />暫停
          </button>
          <button type="button" onClick={stop} disabled={!session.fileName}>
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
              if (audioRef.current) audioRef.current.currentTime = time;
              onSessionChange({ current: time });
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

function createWaveformData(channel: Float32Array, pointCount: number) {
  const samples = new Float32Array(pointCount);
  const bucketSize = Math.max(1, Math.floor(channel.length / pointCount));
  for (let index = 0; index < pointCount; index += 1) {
    const start = index * bucketSize;
    const end = Math.min(channel.length, start + bucketSize);
    let peak = 0;
    for (let sourceIndex = start; sourceIndex < end; sourceIndex += 1) {
      const value = channel[sourceIndex] ?? 0;
      if (Math.abs(value) > Math.abs(peak)) peak = value;
    }
    samples[index] = peak;
  }
  return samples;
}

function getMaxZoom(duration: number, sampleRate: number) {
  const minimumVisibleDuration = Math.max(0.02, sampleRate > 0 ? 32 / sampleRate : 0.02);
  return duration > 0 ? Math.max(1, duration / minimumVisibleDuration) : 1;
}

function clampCreatureScale(value: number) {
  return Math.min(2, Math.max(0.6, value));
}

function isSupportedAudioFile(file: File) {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  const extensionAllowed = supportedAudioExtensions.some((extension) => name.endsWith(extension));
  const mimeAllowed = supportedAudioMimeTypes.includes(type);
  return extensionAllowed || mimeAllowed;
}
