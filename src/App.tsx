import { Calculator, Camera, Hand, Home, LoaderCircle, Music, Waves } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { interactionSound, type InteractionPlayback } from './audio/interactionSound';
import { GestureOverlay } from './gesture/GestureOverlay';
import { CameraStartError, HandTrackingSession } from './gesture/HandTrackingSession';
import { GestureFrameStore } from './gesture/types';
import { createPointerCommand } from './interaction/commandLayer';
import { MusicLab } from './labs/MusicLab';
import { SamplingLab } from './labs/SamplingLab';
import { WaveLab } from './labs/WaveLab';
import { createVisualSeed, initialMusicSession, type MusicSessionState } from './music/musicSession';
import { useMusicAudioController } from './music/useMusicAudioController';
import type { LabId, PointerPoint } from './types';
import { StarfieldBackground } from './visualization/StarfieldBackground';
import { VisualImpulseLayer, type VisualImpulseHandle } from './visualization/VisualImpulseLayer';
import { WaveCanvas } from './visualization/WaveCanvas';
import { HomeMusicTitles } from './components/HomeMusicTitles';
import {
  DEFAULT_SOUND_SPIRIT_PHENOTYPE,
  createLocalSpiritPreviewPhenotype,
  createSoundSpiritInteractionRecorder,
  createSoundSpiritPhenotype,
} from './spirit/soundSpiritIdentity';

const labs: Array<{ id: Exclude<LabId, 'home'>; title: string; description: string; icon: React.ReactNode }> = [
  { id: 'wave', title: '聲波實驗室', description: '動手改變聲音的響度與音調', icon: <Waves size={22} /> },
  { id: 'sampling', title: '數位取樣實驗室', description: '看看聲音如何變成數位資料', icon: <Calculator size={22} /> },
  { id: 'music', title: '音樂實驗室', description: '匯入自己的音樂，觀察聲音的波形', icon: <Music size={22} /> },
];

export default function App() {
  const previewParams = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
  const localSpiritPreview = typeof window !== 'undefined'
    && (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
    && (/^(A|B)$/.test(previewParams.get('spiritPass') ?? '')
      || /^(neutral|closeup|power|glide)$/.test(previewParams.get('spiritDebug') ?? '')
      || /^(default|energy|frequency|diversity|precision|depth)$/.test(previewParams.get('spiritIdentity') ?? ''));
  const gesturePreviewParam = previewParams.get('gesturePreview');
  const localGesturePreview = typeof window !== 'undefined'
    && (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
    && /^(one|two)$/.test(gesturePreviewParam ?? '')
      ? gesturePreviewParam as 'one' | 'two'
      : null;
  const [activeLab, setActiveLab] = useState<LabId>(localSpiritPreview ? 'music' : 'home');
  const [pointer, setPointer] = useState<PointerPoint>({ x: 0.5, y: 0.5 });
  const [musicSession, setMusicSession] = useState<MusicSessionState>(initialMusicSession);
  const [spiritPhenotype, setSpiritPhenotype] = useState(
    localSpiritPreview
      ? createLocalSpiritPreviewPhenotype(previewParams.get('spiritIdentity'))
      : DEFAULT_SOUND_SPIRIT_PHENOTYPE,
  );
  const [homePlayback, setHomePlayback] = useState<InteractionPlayback | null>(null);
  const [gestureEnabled, setGestureEnabled] = useState(Boolean(localGesturePreview));
  const [gestureStatus, setGestureStatus] = useState<'idle' | 'starting' | 'ready' | 'error'>(localGesturePreview ? 'ready' : 'idle');
  const [gestureError, setGestureError] = useState('');
  const spiritInteractionRef = useRef(createSoundSpiritInteractionRecorder());
  const musicUrlRef = useRef<string | null>(null);
  const visualImpulseRef = useRef<VisualImpulseHandle | null>(null);
  const gestureVideoRef = useRef<HTMLVideoElement | null>(null);
  const gestureSessionRef = useRef<HandTrackingSession | null>(null);
  const gestureStoreRef = useRef<GestureFrameStore | null>(null);
  if (!gestureStoreRef.current) gestureStoreRef.current = new GestureFrameStore();

  const updateMusicSession = useCallback((patch: Partial<MusicSessionState>) => {
    setMusicSession((current) => ({ ...current, ...patch }));
  }, []);

  const replaceMusicFile = useCallback((file: File) => {
    if (musicUrlRef.current) URL.revokeObjectURL(musicUrlRef.current);
    const sourceUrl = URL.createObjectURL(file);
    const visualSeed = createVisualSeed(file);
    musicUrlRef.current = sourceUrl;
    setMusicSession((current) => ({
      ...initialMusicSession,
      sourceUrl,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      volume: current.volume,
      visualSeed,
    }));
    return { sourceUrl, visualSeed };
  }, []);

  const commitSpiritPhenotype = useCallback(() => {
    setSpiritPhenotype(createSoundSpiritPhenotype(spiritInteractionRef.current.snapshot()));
  }, []);

  const musicController = useMusicAudioController({
    session: musicSession,
    onSessionChange: updateMusicSession,
    onReplaceFile: replaceMusicFile,
    onSuccessfulLoad: commitSpiritPhenotype,
  });

  useEffect(() => () => {
    if (musicUrlRef.current) URL.revokeObjectURL(musicUrlRef.current);
  }, []);

  useEffect(() => {
    void interactionSound.preload();
  }, []);

  useEffect(() => {
    if (!gestureEnabled) {
      gestureSessionRef.current?.stop();
      gestureSessionRef.current = null;
      gestureStoreRef.current?.clear();
      return;
    }

    const video = gestureVideoRef.current;
    const store = gestureStoreRef.current;
    if (!video || !store) return;
    let active = true;

    if (localGesturePreview) {
      let stopPreview: (() => void) | undefined;
      setGestureStatus('ready');
      void import('./gesture/devGesturePreview').then(({ startGesturePreview }) => {
        if (!active) return;
        stopPreview = startGesturePreview(store, localGesturePreview === 'two' ? 2 : 1);
      });
      return () => {
        active = false;
        stopPreview?.();
      };
    }

    const session = new HandTrackingSession(store);
    gestureSessionRef.current = session;
    setGestureStatus('starting');
    setGestureError('');

    void session.start(video).then(() => {
      if (active) setGestureStatus('ready');
    }).catch((error: unknown) => {
      if (!active) return;
      const kind = error instanceof CameraStartError ? error.kind : 'initialization';
      const messages = {
        denied: '無法啟用攝影機，請允許攝影機權限。',
        unavailable: '找不到可用的前置攝影機。',
        busy: '攝影機正被其他程式使用。',
        insecure: '手勢功能需要 HTTPS 安全連線。',
        initialization: '手勢辨識無法啟動，請稍後再試。',
      };
      setGestureError(messages[kind]);
      setGestureStatus('error');
      setGestureEnabled(false);
    });

    return () => {
      active = false;
      session.stop();
      if (gestureSessionRef.current === session) gestureSessionRef.current = null;
    };
  }, [gestureEnabled, localGesturePreview]);

  const toggleGesture = () => {
    if (gestureEnabled) {
      setGestureEnabled(false);
      setGestureStatus('idle');
      setGestureError('');
      return;
    }
    setGestureError('');
    setGestureEnabled(true);
  };

  const playControlSound = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('input[type="range"], .control, .progress-wrap')) return;
    const control = target.closest('button, .file-picker');
    if (!control || (control instanceof HTMLButtonElement && control.disabled)) return;
    void interactionSound.play();
  };

  const selectLab = (lab: LabId) => {
    if (lab === 'wave' || lab === 'sampling') musicController.pause();
    setActiveLab(lab);
  };

  const activateHomeImpulse = (event: MouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / Math.max(1, rect.width)));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / Math.max(1, rect.height)));
    visualImpulseRef.current?.trigger(x, y);
    void interactionSound.play().then((playback) => playback && setHomePlayback(playback));
  };

  return (
    <main className="app-shell" onClickCapture={playControlSound}>
      <audio
        ref={musicController.audioRef}
        onLoadedMetadata={musicController.handleLoadedMetadata}
        onError={musicController.handleAudioError}
        onEnded={musicController.handleEnded}
      />
      <video ref={gestureVideoRef} className="gesture-camera-sensor" muted playsInline aria-hidden="true" />
      <StarfieldBackground />
      <GestureOverlay store={gestureStoreRef.current} />
      <nav className="top-nav" aria-label="主要導覽">
        <div className="top-nav-track">
          <button type="button" className={activeLab === 'home' ? 'active' : ''} onClick={() => selectLab('home')}>
            <Home size={18} />首頁
          </button>
          {labs.map((lab) => (
            <button key={lab.id} type="button" className={activeLab === lab.id ? 'active' : ''} onClick={() => selectLab(lab.id)}>
              {lab.icon}{lab.title}
            </button>
          ))}
          <span className="gesture-nav-separator" aria-hidden="true" />
          <button
            type="button"
            className={`gesture-toggle ${gestureEnabled ? 'active' : ''} ${gestureStatus}`}
            aria-pressed={gestureEnabled}
            aria-label={gestureEnabled ? '關閉手勢辨識' : '開啟手勢辨識'}
            onClick={toggleGesture}
          >
            {gestureStatus === 'starting'
              ? <LoaderCircle size={18} className="gesture-spinner" />
              : gestureEnabled ? <Hand size={18} /> : <Camera size={18} />}
            {gestureStatus === 'starting' ? '啟動中' : gestureStatus === 'error' ? '重試手勢' : gestureEnabled ? '手勢開啟' : '手勢'}
          </button>
        </div>
      </nav>

      {gestureError && <p className="gesture-error" role="status">{gestureError}</p>}

      {activeLab === 'home' && (
        <section
          className="home"
          onClick={activateHomeImpulse}
          onContextMenu={(event) => event.preventDefault()}
          onPointerMove={(event) => {
            const command = createPointerCommand(event, event.currentTarget);
            if (command.type === 'POINTER_MOVE') {
              setPointer({ x: command.x, y: command.y });
            }
          }}
        >
          <WaveCanvas
            amplitude={0.62}
            frequency={360}
            pointer={pointer}
            mode="home"
            homeSoundEnvelope={homePlayback?.envelope ?? null}
            homeSoundStartedAt={homePlayback?.startedAt ?? 0}
            homeSoundDuration={homePlayback?.duration ?? 0}
            homeSoundToken={homePlayback?.token ?? 0}
            homeMusicData={musicController.timeDomainData}
            homeMusicPlaying={musicController.playing}
          />
          <VisualImpulseLayer ref={visualImpulseRef} />
          <div className="home-content">
            <HomeMusicTitles playing={musicController.playing} visualStateRef={musicController.visualStateRef} spiritPhenotype={spiritPhenotype} />
          </div>
        </section>
      )}

      {activeLab === 'wave' && <WaveLab interactionRecorder={spiritInteractionRef.current} />}
      {activeLab === 'sampling' && <SamplingLab interactionRecorder={spiritInteractionRef.current} />}
      {activeLab === 'music' && (
        <MusicLab
          session={musicSession}
          onSessionChange={updateMusicSession}
          controller={musicController}
          spiritPhenotype={spiritPhenotype}
        />
      )}

    </main>
  );
}
