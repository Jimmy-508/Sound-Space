import { Download, Pause, Play, StopCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { RangeControl } from '../components/RangeControl';
import { SegmentedControl } from '../components/SegmentedControl';
import type { PointerPoint } from '../types';
import { formatTime } from '../utils/format';
import { WaveCanvas } from '../visualization/WaveCanvas';

type ViewMode = 'wave' | 'spectrum';

export function MusicLab() {
  const [fileName, setFileName] = useState('');
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [volume, setVolume] = useState(0.78);
  const [viewMode, setViewMode] = useState<ViewMode>('wave');
  const [musicData, setMusicData] = useState<Float32Array | null>(null);
  const [spectrumData, setSpectrumData] = useState<Uint8Array | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const pointer: PointerPoint = { x: 0.5, y: 0.5 };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const audio = audioRef.current;
      const analyser = analyserRef.current;
      if (audio) setCurrent(audio.currentTime);
      if (analyser) {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        setSpectrumData(data);
      }
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  const loadFile = async (file: File) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);

    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    audio.src = url;
    audio.load();
    setFileName(file.name);
    setDuration(0);
    setCurrent(0);
    setPlaying(false);
    setMusicData(null);
    setSpectrumData(null);
    setError('');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      const context = contextRef.current ?? new AudioCtor();
      contextRef.current = context;
      const buffer = await context.decodeAudioData(arrayBuffer.slice(0));
      setDuration(buffer.duration);

      const channel = buffer.getChannelData(0);
      const samples = new Float32Array(512);
      const step = Math.max(1, Math.floor(channel.length / samples.length));
      for (let i = 0; i < samples.length; i += 1) {
        samples[i] = channel[i * step] ?? 0;
      }
      setMusicData(samples);
    } catch {
      setError('這個音訊格式目前無法在此瀏覽器播放，請改用 WAV 或 MP3 檔案。');
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
    analyser.fftSize = 512;
    source.connect(analyser);
    analyser.connect(context.destination);
    analyserRef.current = analyser;
  };

  const play = async () => {
    await ensureAnalyser();
    await audioRef.current?.play();
    setPlaying(true);
  };

  const pause = () => {
    audioRef.current?.pause();
    setPlaying(false);
  };

  const stop = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setPlaying(false);
  };

  return (
    <section className="lab-layout">
      <audio
        ref={audioRef}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onError={() => fileName && setError('這個音訊格式目前無法在此瀏覽器播放，請改用 WAV 或 MP3 檔案。')}
        onEnded={() => setPlaying(false)}
      />
      <div className="stage">
        <WaveCanvas
          amplitude={0.7}
          frequency={420}
          pointer={pointer}
          mode="music"
          musicData={viewMode === 'wave' ? musicData : null}
          spectrumData={viewMode === 'spectrum' ? spectrumData : null}
        />
        <div className="stage-caption">
          <strong>音樂實驗室</strong>
          <span>音訊只在你的裝置中處理，不會上傳。</span>
        </div>
      </div>

      <aside className="control-panel">
        <label className="file-picker">
          <Download size={20} />
          <span>匯入音訊</span>
          <input
            type="file"
            accept="audio/*"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (!file) return;
              void loadFile(file);
              event.currentTarget.value = '';
            }}
          />
        </label>
        {error && <p className="error-message">{error}</p>}

        <SegmentedControl label="觀察內容" value={viewMode} options={[{ value: 'wave', label: '聲音波形' }, { value: 'spectrum', label: '頻譜' }]} onChange={setViewMode} />
        <RangeControl label="音量" value={Math.round(volume * 100)} min={0} max={100} step={1} display={`${Math.round(volume * 100)}%`} onChange={(value) => setVolume(value / 100)} />

        <div className="button-row">
          <button type="button" className="primary" onClick={() => void play()} disabled={!fileName}>
            <Play size={19} />播放
          </button>
          <button type="button" onClick={pause} disabled={!fileName}>
            <Pause size={19} />暫停
          </button>
          <button type="button" onClick={stop} disabled={!fileName}>
            <StopCircle size={19} />停止
          </button>
        </div>

        <div className="progress-wrap">
          <progress max={duration || 1} value={current} />
          <span>{formatTime(current)} / {formatTime(duration)}</span>
        </div>

        <div className="result-card">
          <span>檔案名稱</span>
          <strong>{fileName || '尚未選擇音訊'}</strong>
          <small>聲音長度：{duration ? formatTime(duration) : '等待匯入'}</small>
        </div>
        <p className="quiet">支援的格式依瀏覽器而定，常見 WAV 與 MP3 通常可以播放。</p>
      </aside>
    </section>
  );
}
