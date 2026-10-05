import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { refineVisualSeed, type MusicSessionState } from './musicSession';
import {
  createAudioOnsetDetectorState,
  detectAudioOnset,
  type AudioOnsetDetectorState,
} from './audioOnsetDetector';
import { createMajorBeatGateState, gateMajorBeat, type MajorBeatGateState } from './majorBeatGate';
import {
  advanceBeatMapClock,
  createBeatMapClockState,
  MUSICAL_HEART_CAPTURE_WINDOW_SECONDS,
  resetBeatMapClock,
  type BeatMapClockState,
} from './beatMapClock';
import { analyzeAudioBufferForMajorBeats, type OfflineBeatMap } from './offlineBeatMap';

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
export const CINEMATIC_BIRTH_DELAY_MS = 2000;
export const CINEMATIC_INTRO_PATH = 'audio/12_Cinematic_intro.wav';

interface ControllerOptions {
  session: MusicSessionState;
  onSessionChange: (patch: Partial<MusicSessionState>) => void;
  onReplaceFile: (file: File) => { sourceUrl: string; visualSeed: number };
  onSuccessfulLoad: (birthDelayMs: number) => void;
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
  beginSeek: () => void;
  endSeek: () => void;
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
  beatLowStrength: number;
  beatHighStrength: number;
  onsetPulse: number;
  onsetStrength: number;
  onsetToken: number;
  onsetLowStrength: number;
  onsetHighStrength: number;
  majorBeatConfidence: number;
  majorBeatProminence: number;
  majorBeatThreshold: number;
  majorBeatPeriodicSupport: number;
  majorBeatFastPath: boolean;
  beatSource: 'none' | 'musical';
  beatSongTime: number;
  beatMapReady: boolean;
  beatMapCount: number;
  beatMapAnalysisMs: number;
  beatMapNextIndex: number;
  beatMapNextTime: number;
  musicalControlActive: boolean;
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
  beatLowStrength: 0,
  beatHighStrength: 0,
  onsetPulse: 0,
  onsetStrength: 0,
  onsetToken: 0,
  onsetLowStrength: 0,
  onsetHighStrength: 0,
  majorBeatConfidence: 0,
  majorBeatProminence: 0,
  majorBeatThreshold: 0,
  majorBeatPeriodicSupport: 0,
  majorBeatFastPath: false,
  beatSource: 'none',
  beatSongTime: -1,
  beatMapReady: false,
  beatMapCount: 0,
  beatMapAnalysisMs: 0,
  beatMapNextIndex: 0,
  beatMapNextTime: -1,
  musicalControlActive: false,
};

interface MusicAnalysisState {
  onset: AudioOnsetDetectorState;
  majorBeat: MajorBeatGateState;
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
  const visualBeatRef = useRef<MusicAnalysisState>({
    onset: createAudioOnsetDetectorState(),
    majorBeat: createMajorBeatGateState(),
    previousSpectrum: null,
  });
  const gainRef = useRef<GainNode | null>(null);
  const spectrumBufferRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const timeBufferRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const loadVersionRef = useRef(0);
  const introAudioRef = useRef<HTMLAudioElement | null>(null);
  const beatMapRef = useRef<OfflineBeatMap | null>(null);
  const beatMapClockRef = useRef<BeatMapClockState>(createBeatMapClockState());
  const scrubbingRef = useRef(false);
  const seekResumeTimerRef = useRef(0);
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
      const visual = visualStateRef.current;
      const beatMap = beatMapRef.current;
      if (audio && beatMap) {
        const beatFrame = advanceBeatMapClock(
          beatMapClockRef.current,
          beatMap.timestamps,
          audio.currentTime,
          !audio.paused,
          scrubbingRef.current,
        );
        visual.beatMapReady = true;
        visual.beatMapCount = beatMap.timestamps.length;
        visual.beatMapAnalysisMs = beatMap.analysisTimeMs;
        visual.beatMapNextIndex = beatFrame.nextIndex;
        visual.beatMapNextTime = beatFrame.nextBeatTime;
        visual.musicalControlActive = beatFrame.musicalControlActive;
        visual.majorBeatConfidence = beatFrame.musicalControlActive ? 1 : 0;
        if (beatFrame.pulse) {
          visual.beatPulse = 1;
          visual.beatStrength = 1;
          visual.beatLowStrength = 1;
          visual.beatHighStrength = 0.72;
          visual.beatAt = now - beatFrame.pulse.attackAge * 1000;
          visual.beatSongTime = beatFrame.pulse.beatTime;
          visual.beatSource = 'musical';
          visual.beatToken += 1;
        }
      } else {
        visual.musicalControlActive = false;
        visual.majorBeatConfidence = 0;
        visual.beatMapNextTime = -1;
      }
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
        updateMusicVisualState(visual, visualBeatRef.current, frequency, analyser, now, Boolean(audio && !audio.paused));
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
    stopCinematicIntro(introAudioRef);
    window.clearTimeout(seekResumeTimerRef.current);
    loadVersionRef.current += 1;
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
    stopCinematicIntro(introAudioRef);
    beatMapRef.current = null;
    beatMapClockRef.current = createBeatMapClockState();
    scrubbingRef.current = false;
    window.clearTimeout(seekResumeTimerRef.current);
    setError('');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      const context = contextRef.current ?? new AudioCtor();
      contextRef.current = context;
      const buffer = await context.decodeAudioData(arrayBuffer.slice(0));
      if (loadVersion !== loadVersionRef.current) return;
      const channel = buffer.getChannelData(0);
      audio.pause();
      setPlaying(false);
      setSpectrumData(null);
      setTimeDomainData(null);
      const { sourceUrl, visualSeed } = onReplaceFile(file);
      audio.src = sourceUrl;
      audio.currentTime = 0;
      audio.load();
      visualStateRef.current = { ...initialVisualState };
      visualBeatRef.current = { onset: createAudioOnsetDetectorState(), majorBeat: createMajorBeatGateState(), previousSpectrum: null };
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
      setPlaying(false);
      void analyzeAudioBufferForMajorBeats(buffer, {
        shouldCancel: () => loadVersion !== loadVersionRef.current,
      }).then((beatMap) => {
        if (!beatMap || loadVersion !== loadVersionRef.current) return;
        beatMapRef.current = beatMap;
        const currentAudio = audioRef.current;
        resetBeatMapClock(beatMapClockRef.current, beatMap.timestamps, currentAudio?.currentTime ?? 0);
        const visual = visualStateRef.current;
        visual.beatMapReady = true;
        visual.beatMapCount = beatMap.timestamps.length;
        visual.beatMapAnalysisMs = beatMap.analysisTimeMs;
        if (isLocalDevelopment()) {
          document.documentElement.dataset.beatMapTimes = Array.from(beatMap.timestamps, (time) => time.toFixed(3)).join(',');
        }
      });
      await playCinematicIntro(introAudioRef, loadVersion, loadVersionRef);
      if (loadVersion !== loadVersionRef.current) return;
      onSuccessfulLoad(CINEMATIC_BIRTH_DELAY_MS);
    } catch {
      if (loadVersion === loadVersionRef.current) setError(unsupportedAudioMessage);
    }
  }, [ensureAudioGraph, onReplaceFile, onSessionChange, onSuccessfulLoad]);

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (sessionRef.current.duration && audio.currentTime >= sessionRef.current.duration - 0.02) audio.currentTime = 0;
    try {
      await ensureAudioGraph();
      const beatMap = beatMapRef.current;
      if (beatMap) {
        resetBeatMapClock(beatMapClockRef.current, beatMap.timestamps, audio.currentTime);
        const nextBeat = beatMap.timestamps[beatMapClockRef.current.nextIndex] ?? -1;
        const capturesSoon = nextBeat >= 0 && nextBeat - audio.currentTime <= MUSICAL_HEART_CAPTURE_WINDOW_SECONDS;
        visualStateRef.current.musicalControlActive = capturesSoon;
        visualStateRef.current.majorBeatConfidence = capturesSoon ? 1 : 0;
        visualStateRef.current.beatMapNextIndex = beatMapClockRef.current.nextIndex;
        visualStateRef.current.beatMapNextTime = nextBeat;
      }
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
    visualStateRef.current.musicalControlActive = false;
    visualStateRef.current.majorBeatConfidence = 0;
    setPlaying(false);
  }, [onSessionChange]);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    const beatMap = beatMapRef.current;
    if (beatMap) resetBeatMapClock(beatMapClockRef.current, beatMap.timestamps, 0);
    onSessionChange({ current: 0, viewStart: 0 });
    visualStateRef.current.musicalControlActive = false;
    visualStateRef.current.majorBeatConfidence = 0;
    setPlaying(false);
  }, [onSessionChange]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (audio) audio.currentTime = time;
    const beatMap = beatMapRef.current;
    if (beatMap) resetBeatMapClock(beatMapClockRef.current, beatMap.timestamps, time);
    scrubbingRef.current = true;
    window.clearTimeout(seekResumeTimerRef.current);
    seekResumeTimerRef.current = window.setTimeout(() => {
      scrubbingRef.current = false;
      const currentAudio = audioRef.current;
      const currentMap = beatMapRef.current;
      if (currentAudio && currentMap) resetBeatMapClock(beatMapClockRef.current, currentMap.timestamps, currentAudio.currentTime);
    }, 140);
    onSessionChange({ current: time });
  }, [onSessionChange]);

  const beginSeek = useCallback(() => {
    scrubbingRef.current = true;
    window.clearTimeout(seekResumeTimerRef.current);
  }, []);

  const endSeek = useCallback(() => {
    window.clearTimeout(seekResumeTimerRef.current);
    scrubbingRef.current = false;
    const audio = audioRef.current;
    const beatMap = beatMapRef.current;
    if (audio && beatMap) resetBeatMapClock(beatMapClockRef.current, beatMap.timestamps, audio.currentTime);
  }, []);

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
    visualStateRef.current.musicalControlActive = false;
    visualStateRef.current.majorBeatConfidence = 0;
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
    beginSeek,
    endSeek,
    handleLoadedMetadata,
    handleAudioError,
    handleEnded,
  };
}

function updateMusicVisualState(
  target: MusicVisualState,
  analysis: MusicAnalysisState,
  spectrum: Uint8Array,
  analyser: AnalyserNode,
  now: number,
  playing: boolean,
) {
  const bass = averageFrequencyBand(spectrum, analyser, 35, 220);
  const mid = averageFrequencyBand(spectrum, analyser, 220, 2600);
  const treble = averageFrequencyBand(spectrum, analyser, 2600, 12000);
  const previousSpectrum = analysis.previousSpectrum ?? new Float32Array(spectrum.length);
  let positiveFlux = 0;
  let fluxWeight = 0;
  for (let index = 1; index < spectrum.length; index += 1) {
    const value = (spectrum[index] ?? 0) / 255;
    const previous = analysis.previousSpectrum ? previousSpectrum[index] : value;
    const weight = index < 24 ? 1.6 : index < 128 ? 1 : 0.55;
    positiveFlux += Math.max(0, value - previous) * weight;
    fluxWeight += weight;
    previousSpectrum[index] = value;
  }
  analysis.previousSpectrum = previousSpectrum;
  const spectralFlux = positiveFlux / Math.max(1, fluxWeight);
  const deltaTime = Math.min(0.08, Math.max(0.001, (now - (analysis.onset.lastUpdateAt || now - 32)) / 1000));
  const smooth = (current: number, next: number) => current + (next - current) * (1 - Math.exp(-deltaTime * (next > current ? 18 : 5.2)));

  target.bassEnergy = smooth(target.bassEnergy, playing ? bass : 0);
  target.midEnergy = smooth(target.midEnergy, playing ? mid : 0);
  target.trebleEnergy = smooth(target.trebleEnergy, playing ? treble : 0);
  target.overallEnergy = target.bassEnergy * 0.46 + target.midEnergy * 0.36 + target.trebleEnergy * 0.18;
  target.beatPulse *= Math.exp(-deltaTime * 9.5);
  target.beatStrength *= Math.exp(-deltaTime * 4.8);
  target.onsetPulse *= Math.exp(-deltaTime * 10.5);
  target.onsetStrength *= Math.exp(-deltaTime * 5.8);

  const onset = detectAudioOnset(analysis.onset, { bass, mid, treble, spectralFlux, playing }, now);
  if (onset.detected) {
    target.onsetPulse = onset.strength;
    target.onsetStrength = onset.strength;
    target.onsetLowStrength = onset.lowStrength;
    target.onsetHighStrength = onset.highStrength;
    target.onsetToken += 1;
  }
  const majorBeat = gateMajorBeat(analysis.majorBeat, onset, target.overallEnergy, now, playing);
  target.majorBeatProminence = majorBeat.prominence;
  target.majorBeatThreshold = majorBeat.threshold;
  target.majorBeatPeriodicSupport = majorBeat.periodicSupport;
  target.majorBeatFastPath = majorBeat.fastPath;
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

async function playCinematicIntro(
  introRef: { current: HTMLAudioElement | null },
  loadVersion: number,
  loadVersionRef: { current: number },
) {
  stopCinematicIntro(introRef);
  const intro = new Audio(new URL(CINEMATIC_INTRO_PATH, document.baseURI).href);
  intro.preload = 'auto';
  introRef.current = intro;
  if (isLocalDevelopment()) {
    document.documentElement.dataset.cinematicIntroState = 'starting';
    document.documentElement.dataset.cinematicIntroStartedAt = '';
    document.documentElement.dataset.cinematicIntroEndedAt = '';
    intro.addEventListener('playing', () => {
      document.documentElement.dataset.cinematicIntroState = 'playing';
      document.documentElement.dataset.cinematicIntroStartedAt = performance.now().toFixed(1);
      document.documentElement.dataset.cinematicIntroDuration = Number.isFinite(intro.duration) ? intro.duration.toFixed(3) : '';
    }, { once: true });
    intro.addEventListener('ended', () => {
      document.documentElement.dataset.cinematicIntroState = 'ended';
      document.documentElement.dataset.cinematicIntroEndedAt = performance.now().toFixed(1);
    }, { once: true });
  }
  try {
    await intro.play();
  } catch {
    if (isLocalDevelopment()) {
      document.documentElement.dataset.cinematicIntroState = 'failed';
      console.warn('Sound Space cinematic intro could not play; Birth will use the two-second fallback.');
    }
  }
  if (loadVersion !== loadVersionRef.current) stopCinematicIntro(introRef);
}

function stopCinematicIntro(introRef: { current: HTMLAudioElement | null }) {
  const intro = introRef.current;
  if (!intro) return;
  intro.pause();
  intro.removeAttribute('src');
  intro.load();
  introRef.current = null;
  if (isLocalDevelopment() && document.documentElement.dataset.cinematicIntroState !== 'ended') {
    document.documentElement.dataset.cinematicIntroState = 'stopped';
  }
}

function isLocalDevelopment() {
  return window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
}
