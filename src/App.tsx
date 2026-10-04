import { Calculator, Home, Music, Settings, Waves } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { interactionSound, type InteractionPlayback } from './audio/interactionSound';
import { SettingsPanel } from './components/SettingsPanel';
import { GestureEffectsOverlay } from './gesture/GestureEffectsOverlay';
import { GestureOverlay } from './gesture/GestureOverlay';
import { CameraStartError, HandTrackingSession } from './gesture/HandTrackingSession';
import { gesturePointToViewport } from './gesture/coordinateTransform';
import { DwellSelectionController } from './gesture/dwellController';
import { GestureInteractionController } from './gesture/interactionController';
import { clampNavigationScroll, getNavigationEdgeMotion } from './gesture/navigationGesture';
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
type ActiveView = LabId | 'settings';

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
    && /^(one|two|pointing|sweep|explosion)$/.test(gesturePreviewParam ?? '')
      ? gesturePreviewParam as 'one' | 'two' | 'pointing' | 'sweep' | 'explosion'
      : null;
  const [activeView, setActiveView] = useState<ActiveView>(localSpiritPreview ? 'music' : 'home');
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
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const spiritInteractionRef = useRef(createSoundSpiritInteractionRecorder());
  const musicUrlRef = useRef<string | null>(null);
  const visualImpulseRef = useRef<VisualImpulseHandle | null>(null);
  const gestureVideoRef = useRef<HTMLVideoElement | null>(null);
  const navigationRef = useRef<HTMLElement | null>(null);
  const gestureSessionRef = useRef<HandTrackingSession | null>(null);
  const gestureStoreRef = useRef<GestureFrameStore | null>(null);
  if (!gestureStoreRef.current) gestureStoreRef.current = new GestureFrameStore();
  const gestureInteractionRef = useRef<GestureInteractionController | null>(null);
  if (!gestureInteractionRef.current) gestureInteractionRef.current = new GestureInteractionController(gestureStoreRef.current);
  const dwellControllerRef = useRef(new DwellSelectionController());
  const activeViewRef = useRef(activeView);
  activeViewRef.current = activeView;

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
    const warm = () => void interactionSound.warm();
    window.addEventListener('pointerdown', warm, { once: true, passive: true });
    window.addEventListener('keydown', warm, { once: true });
    return () => {
      window.removeEventListener('pointerdown', warm);
      window.removeEventListener('keydown', warm);
    };
  }, []);

  useEffect(() => {
    interactionSound.setEnabled(sfxEnabled);
  }, [sfxEnabled]);

  useEffect(() => {
    const controller = gestureInteractionRef.current!;
    controller.start();
    return () => controller.stop();
  }, []);

  useEffect(() => {
    const controller = gestureInteractionRef.current!;
    const unsubscribe = controller.subscribe((event) => {
      if (event.type !== 'explosion') return;
      const view = activeViewRef.current;
      if (view !== 'home' && view !== 'music') return;
      if (view === 'music') {
        const stage = document.querySelector<HTMLElement>('.music-stage[data-gesture-zone="spirit"]');
        if (!stage) return;
        const point = gesturePointToViewport(event.point, window.innerWidth, window.innerHeight);
        const rect = stage.getBoundingClientRect();
        if (point.x < rect.left || point.x > rect.right || point.y < rect.top || point.y > rect.bottom) return;
      }
      void interactionSound.play('explosion').then((playback) => {
        if (playback && view === 'home') setHomePlayback(playback);
      });
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    gestureInteractionRef.current?.setEnabled(gestureEnabled);
    if (!gestureEnabled) {
      gestureSessionRef.current?.stop();
      gestureSessionRef.current = null;
      gestureStoreRef.current?.clear();
      dwellControllerRef.current.reset();
      window.dispatchEvent(new Event('soundspace:gesture-reset'));
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
        stopPreview = startGesturePreview(store, localGesturePreview);
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

  useEffect(() => {
    let frame = 0;
    let previousFrame = performance.now();
    let hovered: HTMLElement | null = null;
    const clearNavigationMotion = () => {
      navigationRef.current?.removeAttribute('data-gesture-scroll');
    };
    const clearHover = () => {
      hovered?.classList.remove('gesture-dwell-hover');
      hovered = null;
      gestureInteractionRef.current?.setDwell(false, 0);
    };
    const update = (now: number) => {
      frame = requestAnimationFrame(update);
      const interaction = gestureInteractionRef.current!;
      const pointer = interaction.read().pointer;
      if (!gestureEnabled || !pointer) {
        clearHover();
        clearNavigationMotion();
        dwellControllerRef.current.update(undefined, now, false);
        return;
      }
      const point = gesturePointToViewport(pointer.point, window.innerWidth, window.innerHeight);
      const navigation = navigationRef.current;
      if (navigation && navigation.scrollWidth > navigation.clientWidth + 1) {
        const rect = navigation.getBoundingClientRect();
        const motion = getNavigationEdgeMotion(rect, point.x, point.y);
        if (motion.direction !== 0) {
          const elapsed = Math.min(0.05, Math.max(0, (now - previousFrame) / 1000));
          navigation.scrollLeft = clampNavigationScroll(
            navigation.scrollLeft,
            motion.velocity * elapsed,
            navigation.scrollWidth,
            navigation.clientWidth,
          );
          navigation.dataset.gestureScroll = motion.direction < 0 ? 'left' : 'right';
          clearHover();
          dwellControllerRef.current.update(undefined, now, false);
          previousFrame = now;
          return;
        }
      }
      clearNavigationMotion();
      previousFrame = now;
      const hit = document.elementFromPoint(point.x, point.y);
      const blocked = hit?.closest('.music-stage[data-gesture-zone="spirit"]');
      const target = blocked ? null : hit?.closest<HTMLElement>('[data-gesture-clickable="true"], button:not(:disabled), .file-picker');
      if (target !== hovered) {
        hovered?.classList.remove('gesture-dwell-hover');
        hovered = target ?? null;
        hovered?.classList.add('gesture-dwell-hover');
      }
      const result = dwellControllerRef.current.update(target, now, true);
      interaction.setDwell(result.active, result.progress);
      if (!result.activated || !target) return;
      const controlId = target.dataset.gestureControlId;
      if (controlId) {
        window.dispatchEvent(new CustomEvent('soundspace:gesture-control-selected', { detail: { id: controlId } }));
        return;
      }
      if (target.classList.contains('home')) {
        target.dispatchEvent(new PointerEvent('click', { bubbles: true, clientX: point.x, clientY: point.y, pointerType: 'touch' }));
      } else {
        target.click();
      }
    };
    frame = requestAnimationFrame(update);
    return () => {
      cancelAnimationFrame(frame);
      clearHover();
      clearNavigationMotion();
      dwellControllerRef.current.reset();
    };
  }, [gestureEnabled]);

  const setGestureInteraction = (enabled: boolean) => {
    if (enabled) void interactionSound.warm();
    setGestureError('');
    setGestureStatus(enabled ? 'starting' : 'idle');
    setGestureEnabled(enabled);
  };

  const playControlSound = (event: MouseEvent<HTMLElement>) => {
    void interactionSound.warm();
    const target = event.target as HTMLElement;
    if (target.closest('input[type="range"], .control, .progress-wrap')) return;
    const control = target.closest('button, .file-picker');
    if (!control || (control instanceof HTMLButtonElement && control.disabled)) return;
    void interactionSound.play();
  };

  const selectView = (view: ActiveView) => {
    if (view === 'wave' || view === 'sampling') musicController.pause();
    dwellControllerRef.current.reset();
    gestureInteractionRef.current?.setDwell(false, 0);
    setActiveView(view);
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
      <GestureEffectsOverlay controller={gestureInteractionRef.current} enabled={gestureEnabled} scene={activeView} />
      <GestureOverlay store={gestureStoreRef.current} interaction={gestureInteractionRef.current} />
      <nav ref={navigationRef} className="top-nav" aria-label="主要導覽">
        <div className="top-nav-track">
          <button type="button" className={activeView === 'home' ? 'active' : ''} onClick={() => selectView('home')}>
            <Home size={18} />首頁
          </button>
          {labs.map((lab) => (
            <button key={lab.id} type="button" className={activeView === lab.id ? 'active' : ''} onClick={() => selectView(lab.id)}>
              {lab.icon}{lab.title}
            </button>
          ))}
          <button type="button" className={activeView === 'settings' ? 'active' : ''} onClick={() => selectView('settings')}>
            <Settings size={18} />設定
          </button>
        </div>
      </nav>

      {gestureError && <p className="gesture-error" role="status">{gestureError}</p>}

      {activeView === 'home' && (
        <section
          className="home"
          data-gesture-clickable="true"
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

      {activeView === 'wave' && <WaveLab interactionRecorder={spiritInteractionRef.current} gestureController={gestureInteractionRef.current} />}
      {activeView === 'sampling' && <SamplingLab interactionRecorder={spiritInteractionRef.current} gestureController={gestureInteractionRef.current} />}
      {activeView === 'music' && (
        <MusicLab
          session={musicSession}
          onSessionChange={updateMusicSession}
          controller={musicController}
          spiritPhenotype={spiritPhenotype}
          gestureController={gestureInteractionRef.current}
        />
      )}
      {activeView === 'settings' && (
        <SettingsPanel
          gestureEnabled={gestureEnabled}
          gestureStatus={gestureStatus}
          sfxEnabled={sfxEnabled}
          onGestureChange={setGestureInteraction}
          onSfxChange={setSfxEnabled}
        />
      )}

    </main>
  );
}
