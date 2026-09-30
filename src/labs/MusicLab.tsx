import { Download, Pause, Play, StopCircle, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import { RangeControl } from '../components/RangeControl';
import { SegmentedControl } from '../components/SegmentedControl';
import { createDecodedMusicDna, type MusicSessionState } from '../music/musicSession';
import type { PointerPoint } from '../types';
import { formatTime } from '../utils/format';
import { WaveCanvas } from '../visualization/WaveCanvas';

type ViewMode = 'wave' | 'spectrum';

interface MusicLabProps {
  session: MusicSessionState;
  onSessionChange: (patch: Partial<MusicSessionState>) => void;
  onReplaceFile: (file: File) => string;
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const analyserDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const restoredSourceRef = useRef<string | null>(null);
  const loadVersionRef = useRef(0);
  const pointer: PointerPoint = { x: 0.5, y: 0.5 };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = session.volume;
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
    const sourceUrl = onReplaceFile(file);
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
      const dna = createDecodedMusicDna(file, buffer.duration, channel);
      onSessionChange({
        duration: buffer.duration,
        current: 0,
        waveformData,
        dnaSeed: dna.seed,
        spectrumMode: dna.mode,
        zoom: 1,
        viewStart: 0,
      });
    } catch {
      if (loadVersion === loadVersionRef.current) setError(unsupportedAudioMessage);
    }
  };

  const ensureAnalyser = async () => {
    const audio = audioRef.current;
    if (!audio || analyserRef.current) return;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    const context = contextRef.current ?? new AudioCtor();
    contextRef.current = context;
    if (context.state === 'suspended') await context.resume();
    const source = context.createMediaElementSource(audio);
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.72;
    source.connect(analyser);
    analyser.connect(context.destination);
    analyserRef.current = analyser;
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

  const maxZoom = getMaxZoom(session.duration);
  const setZoom = (requested: number) => {
    const zoom = Math.min(maxZoom, Math.max(1, requested));
    const progress = session.duration ? session.current / session.duration : 0;
    const visible = 1 / zoom;
    const viewStart = zoom <= 1 ? 0 : Math.min(1 - visible, Math.max(0, progress - visible * 0.35));
    onSessionChange({ zoom, viewStart });
  };

  const seekFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (viewMode !== 'wave' || !session.duration || !session.sourceUrl) return;
    if ((event.target as HTMLElement).closest('button')) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const local = Math.min(1, Math.max(0, (event.clientX - rect.left) / Math.max(1, rect.width)));
    const fraction = Math.min(1, session.viewStart + local / session.zoom);
    const time = fraction * session.duration;
    if (audioRef.current) audioRef.current.currentTime = time;
    onSessionChange({ current: time });
  };

  const zoomFromWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (viewMode !== 'wave' || !session.sourceUrl || maxZoom <= 1) return;
    event.preventDefault();
    setZoom(session.zoom * Math.exp(-event.deltaY * 0.002));
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
      <div className="stage music-stage" onPointerDown={seekFromPointer} onWheel={zoomFromWheel}>
        <WaveCanvas
          amplitude={0.7}
          frequency={420}
          pointer={pointer}
          mode="music"
          musicData={viewMode === 'wave' ? session.waveformData : null}
          spectrumData={viewMode === 'spectrum' ? spectrumData : null}
          musicProgress={session.duration ? session.current / session.duration : 0}
          musicZoom={session.zoom}
          musicViewStart={session.viewStart}
          musicVolume={session.volume}
          musicTime={session.current}
          musicDnaSeed={session.dnaSeed}
          musicSpectrumMode={session.spectrumMode}
        />
        {viewMode === 'wave' && session.sourceUrl && (
          <div className="waveform-tools" aria-label="波形縮放">
            <button type="button" title="縮小波形" aria-label="縮小波形" disabled={session.zoom <= 1.001} onClick={() => setZoom(session.zoom / 1.6)}>
              <ZoomOut size={18} />
            </button>
            <button type="button" title="放大波形" aria-label="放大波形" disabled={session.zoom >= maxZoom - 0.001} onClick={() => setZoom(session.zoom * 1.6)}>
              <ZoomIn size={18} />
            </button>
          </div>
        )}
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
          <progress max={session.duration || 1} value={session.current} />
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

function getMaxZoom(duration: number) {
  return duration > 0 ? Math.max(1, Math.min(16, duration / 4)) : 1;
}

function isSupportedAudioFile(file: File) {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  const extensionAllowed = supportedAudioExtensions.some((extension) => name.endsWith(extension));
  const mimeAllowed = supportedAudioMimeTypes.includes(type);
  return extensionAllowed || mimeAllowed;
}
