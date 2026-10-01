import { Calculator, Home, Music, Waves } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { interactionSound, type InteractionPlayback } from './audio/interactionSound';
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

const labs: Array<{ id: Exclude<LabId, 'home'>; title: string; description: string; icon: React.ReactNode }> = [
  { id: 'wave', title: '聲波實驗室', description: '動手改變聲音的響度與音調', icon: <Waves size={22} /> },
  { id: 'sampling', title: '數位取樣實驗室', description: '看看聲音如何變成數位資料', icon: <Calculator size={22} /> },
  { id: 'music', title: '音樂實驗室', description: '匯入自己的音樂，觀察聲音的波形', icon: <Music size={22} /> },
];

export default function App() {
  const localSpiritPreview = typeof window !== 'undefined'
    && (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
    && /^(A|B)$/.test(new URLSearchParams(window.location.search).get('spiritPass') ?? '');
  const [activeLab, setActiveLab] = useState<LabId>(localSpiritPreview ? 'music' : 'home');
  const [pointer, setPointer] = useState<PointerPoint>({ x: 0.5, y: 0.5 });
  const [musicSession, setMusicSession] = useState<MusicSessionState>(initialMusicSession);
  const [homePlayback, setHomePlayback] = useState<InteractionPlayback | null>(null);
  const musicUrlRef = useRef<string | null>(null);
  const visualImpulseRef = useRef<VisualImpulseHandle | null>(null);

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

  const musicController = useMusicAudioController({
    session: musicSession,
    onSessionChange: updateMusicSession,
    onReplaceFile: replaceMusicFile,
  });

  useEffect(() => () => {
    if (musicUrlRef.current) URL.revokeObjectURL(musicUrlRef.current);
  }, []);

  useEffect(() => {
    void interactionSound.preload();
  }, []);

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
      <StarfieldBackground />
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
        </div>
      </nav>

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
            <p className="eyebrow">聲音數位化互動實驗室</p>
            <h1>Sound Space</h1>
          </div>
        </section>
      )}

      {activeLab === 'wave' && <WaveLab />}
      {activeLab === 'sampling' && <SamplingLab />}
      {activeLab === 'music' && (
        <MusicLab
          session={musicSession}
          onSessionChange={updateMusicSession}
          controller={musicController}
        />
      )}

    </main>
  );
}
