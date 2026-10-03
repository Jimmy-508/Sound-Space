import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { refineVisualSeed, type MusicSessionState } from './musicSession';

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

export const audioAccept = 'audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/aac,.mp3,.wav,.m4a,.aac';
export const unsupportedAudioMessage = '這個音訊格式目前無法在此瀏覽器播放，請改用其他 MP3、WAV 或 M4A 檔案。';

interface ControllerOptions {
  session: MusicSessionState;
  onSessionChange: (patch: Partial<MusicSessionState>) => void;
  onReplaceFile: (file: File) => { sourceUrl: string; visualSeed: number };
  onSuccessfulLoad: () => void;
}

export interface MusicAudioController {
  audioRef: RefObject<HTMLAudioElement | null>;
  visualStateRef: RefObject<MusicVisualState>;
  playing: boolean;
  spectrumData: Uint8Array | null;
  timeDomainData: Uint8Array | null;
  error: string;
  loadFile: (file: File) => Promise<void>;
  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
  handleLoadedMetadata: () => void;
  handleAudioError: () => void;
  handleEnded: () => void;
}

export interface MusicVisualState {
  overallEnergy: number;
  bassEnergy: number;
  midEnergy: number;
  trebleEnergy: number;
  beatPulse: number;
  beatStrength: number;
  beatAt: number;
  beatToken: number;
}

const initialVisualState: MusicVisualState = {
  overallEnergy: 0,
  bassEnergy: 0,
  midEnergy: 0,
  trebleEnergy: 0,
  beatPulse: 0,
  beatStrength: 0,
  beatAt: -Infinity,
  beatToken: 0,
};

interface HomeVisualBeatState {
  baseline: number;
  deviation: number;
  previous: number;
  lastBeatAt: number;
  lastUpdateAt: number;
  fluxBaseline: number;
  fluxDeviation: number;
  previousSpectrum: Float32Array | null;
}

export function useMusicAudioController({ session, onSessionChange, onReplaceFile, onSuccessfulLoad }: ControllerOptions): MusicAudioController {
  const [playing, setPlaying] = useState(false);
  const [spectrumData, setSpectrumData] = useState<Uint8Array | null>(null);
  const [timeDomainData, setTimeDomainData] = useState<Uint8Array | null>(null);
  const [error, setError] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const visualStateRef = useRef<MusicVisualState>({ ...initialVisualState });
  const visualBeatRef = useRef<HomeVisualBeatState>({
    baseline: 0.055,
    deviation: 0.018,
    previous: 0,
    lastBeatAt: -Infinity,
    lastUpdateAt: 0,
    fluxBaseline: 0.003,
    fluxDeviation: 0.0015,
    previousSpectrum: null,
  });
  const gainRef = useRef<GainNode | null>(null);
  const spectrumBufferRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const timeBufferRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const loadVersionRef = useRef(0);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !session.sourceUrl) return;
    if (audio.src !== session.sourceUrl) {
      audio.src = session.sourceUrl;
      audio.load();
    }
  }, [session.sourceUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = 1;
    const gain = gainRef.current;
    const context = contextRef.current;
    if (gain && context) gain.gain.setTargetAtTime(session.volume, context.currentTime, 0.018);
  }, [session.volume]);

  useEffect(() => {
    let frame = 0;
    let lastProgressUpdate = 0;
    let lastAnalyserUpdate = 0;
    const tick = () => {
      const now = performance.now();
      const audio = audioRef.current;
      const analyser = analyserRef.current;
      if (audio && !audio.paused && now - lastProgressUpdate >= 100) {
        onSessionChange({ current: audio.currentTime });
        lastProgressUpdate = now;
      }
      if (analyser && now - lastAnalyserUpdate >= 32) {
        const frequency = spectrumBufferRef.current ?? new Uint8Array(analyser.frequencyBinCount);
        const waveform = timeBufferRef.current ?? new Uint8Array(analyser.fftSize);
        spectrumBufferRef.current = frequency;
        timeBufferRef.current = waveform;
        analyser.getByteFrequencyData(frequency);
        analyser.getByteTimeDomainData(waveform);
        updateMusicVisualState(visualStateRef.current, visualBeatRef.current, frequency, analyser, now, Boolean(audio && !audio.paused));
        setSpectrumData(frequency.slice());
        setTimeDomainData(waveform.slice());
        lastAnalyserUpdate = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [onSessionChange]);

  useEffect(() => () => {
    audioRef.current?.pause();
    analyserRef.current?.disconnect();
    gainRef.current?.disconnect();
    void contextRef.current?.close();
  }, []);

  const ensureAudioGraph = useCallback(async () => {
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
    analyser.smoothingTimeConstant = 0.68;
    gain.gain.value = sessionRef.current.volume;
    audio.volume = 1;
    source.connect(analyser);
    analyser.connect(gain);
    gain.connect(context.destination);
    analyserRef.current = analyser;
    gainRef.current = gain;
  }, []);

  const loadFile = useCallback(async (file: File) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!isSupportedAudioFile(file)) {
      setError(unsupportedAudioMessage);
      return;
    }
    const loadVersion = loadVersionRef.current + 1;
    loadVersionRef.current = loadVersion;
    audio.pause();
    setPlaying(false);
    setSpectrumData(null);
    setTimeDomainData(null);
    setError('');
    const { sourceUrl, visualSeed } = onReplaceFile(file);
    audio.src = sourceUrl;
    audio.load();

    try {
      const arrayBuffer = await file.arrayBuffer();
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      const context = contextRef.current ?? new AudioCtor();
      contextRef.current = context;
      const buffer = await context.decodeAudioData(arrayBuffer.slice(0));
      if (loadVersion !== loadVersionRef.current) return;
      const channel = buffer.getChannelData(0);
      onSuccessfulLoad();
      onSessionChange({
        duration: buffer.duration,
        current: 0,
        waveformData: createWaveformData(channel, 4096),
        pcmData: channel.slice(),
        sampleRate: buffer.sampleRate,
        visualSeed: refineVisualSeed(visualSeed, file, buffer.duration, channel),
        zoom: 1,
        viewStart: 0,
      });
    } catch {
      if (loadVersion === loadVersionRef.current) setError(unsupportedAudioMessage);
    }
  }, [onReplaceFile, onSessionChange, onSuccessfulLoad]);

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (sessionRef.current.duration && audio.currentTime >= sessionRef.current.duration - 0.02) audio.currentTime = 0;
    try {
      await ensureAudioGraph();
      await audio.play();
      setPlaying(true);
      setError('');
    } catch {
      setPlaying(false);
      setError(unsupportedAudioMessage);
    }
  }, [ensureAudioGraph]);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    onSessionChange({ current: audio.currentTime });
    setPlaying(false);
  }, [onSessionChange]);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    onSessionChange({ current: 0, viewStart: 0 });
    setPlaying(false);
  }, [onSessionChange]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (audio) audio.currentTime = time;
    onSessionChange({ current: time });
  }, [onSessionChange]);

  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const current = sessionRef.current;
    audio.currentTime = Math.min(current.current, audio.duration || current.current);
    onSessionChange({ duration: audio.duration });
  }, [onSessionChange]);

  const handleAudioError = useCallback(() => {
    if (sessionRef.current.fileName) setError(unsupportedAudioMessage);
  }, []);

  const handleEnded = useCallback(() => {
    setPlaying(false);
    onSessionChange({ current: sessionRef.current.duration });
  }, [onSessionChange]);

  return {
    audioRef,
    visualStateRef,
    playing,
    spectrumData,
    timeDomainData,
    error,
    loadFile,
    play,
    pause,
    stop,
    seek,
    handleLoadedMetadata,
    handleAudioError,
    handleEnded,
  };
}

function updateMusicVisualState(
  target: MusicVisualState,
  beat: HomeVisualBeatState,
  spectrum: Uint8Array,
  analyser: AnalyserNode,
  now: number,
  playing: boolean,
) {
  const deltaTime = Math.min(0.08, Math.max(0.001, (now - (beat.lastUpdateAt || now - 32)) / 1000));
  beat.lastUpdateAt = now;

  const bass = averageFrequencyBand(spectrum, analyser, 35, 220);
  const mid = averageFrequencyBand(spectrum, analyser, 220, 2600);
  const treble = averageFrequencyBand(spectrum, analyser, 2600, 12000);
  const previousSpectrum = beat.previousSpectrum ?? new Float32Array(spectrum.length);
  let positiveFlux = 0;
  let fluxWeight = 0;
  for (let index = 1; index < spectrum.length; index += 1) {
    const value = (spectrum[index] ?? 0) / 255;
    const previous = beat.previousSpectrum ? previousSpectrum[index] : value;
    const weight = index < 24 ? 1.6 : index < 128 ? 1 : 0.55;
    positiveFlux += Math.max(0, value - previous) * weight;
    fluxWeight += weight;
    previousSpectrum[index] = value;
  }
  beat.previousSpectrum = previousSpectrum;
  const spectralFlux = positiveFlux / Math.max(1, fluxWeight);
  const smooth = (current: number, next: number) => current + (next - current) * (1 - Math.exp(-deltaTime * (next > current ? 18 : 5.2)));

  target.bassEnergy = smooth(target.bassEnergy, playing ? bass : 0);
  target.midEnergy = smooth(target.midEnergy, playing ? mid : 0);
  target.trebleEnergy = smooth(target.trebleEnergy, playing ? treble : 0);
  target.overallEnergy = target.bassEnergy * 0.46 + target.midEnergy * 0.36 + target.trebleEnergy * 0.18;
  target.beatPulse *= Math.exp(-deltaTime * 9.5);
  target.beatStrength *= Math.exp(-deltaTime * 4.8);

  const rawOverall = bass * 0.46 + mid * 0.36 + treble * 0.18;
  const beatSignal = bass * 0.72 + rawOverall * 0.28;
  const distance = Math.abs(beatSignal - beat.baseline);
  beat.baseline += (beatSignal - beat.baseline) * (1 - Math.exp(-deltaTime * (beatSignal > beat.baseline ? 1.5 : 3.2)));
  beat.deviation += (distance - beat.deviation) * (1 - Math.exp(-deltaTime * 2.2));
  const rise = beatSignal - beat.previous;
  const threshold = beat.baseline + Math.max(0.026, beat.deviation * 1.35);
  const fluxDistance = Math.abs(spectralFlux - beat.fluxBaseline);
  beat.fluxBaseline += (spectralFlux - beat.fluxBaseline) * (1 - Math.exp(-deltaTime * 1.7));
  beat.fluxDeviation += (fluxDistance - beat.fluxDeviation) * (1 - Math.exp(-deltaTime * 2.1));
  const fluxThreshold = beat.fluxBaseline + Math.max(0.0012, beat.fluxDeviation * 1.2);
  const transient = spectralFlux > fluxThreshold;
  const accepted = playing
    && now - beat.lastBeatAt > 280
    && target.overallEnergy > 0.035
    && ((beatSignal > threshold && rise > Math.max(0.007, beat.deviation * 0.13)) || transient);

  if (accepted) {
    const excess = (beatSignal - threshold) / Math.max(0.045, beat.deviation * 1.8);
    const fluxStrength = (spectralFlux - fluxThreshold) / Math.max(0.004, beat.fluxDeviation * 2.2);
    const rawStrength = 0.34 + excess * 0.58 + fluxStrength * 0.42 + Math.max(0, rise) * 1.5;
    const strength = Number.isFinite(rawStrength) ? Math.min(1.2, Math.max(0.34, rawStrength)) : 0.48;
    target.beatPulse = strength;
    target.beatStrength = strength;
    target.beatAt = now;
    target.beatToken += 1;
    beat.lastBeatAt = now;
  }

  beat.previous = beatSignal;
}

function averageFrequencyBand(spectrum: Uint8Array, analyser: AnalyserNode, minimumHz: number, maximumHz: number) {
  const binHz = analyser.context.sampleRate / analyser.fftSize;
  const start = Math.max(1, Math.floor(minimumHz / binHz));
  const end = Math.min(spectrum.length - 1, Math.ceil(maximumHz / binHz));
  let total = 0;
  let weight = 0;
  for (let index = start; index <= end; index += 1) {
    const normalized = (spectrum[index] ?? 0) / 255;
    total += normalized * normalized;
    weight += 1;
  }
  return weight ? Math.sqrt(total / weight) : 0;
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

function isSupportedAudioFile(file: File) {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return supportedAudioExtensions.some((extension) => name.endsWith(extension)) || supportedAudioMimeTypes.includes(type);
}
