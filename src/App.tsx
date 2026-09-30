import { Calculator, Home, Music, Waves } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPointerCommand } from './interaction/commandLayer';
import { MusicLab } from './labs/MusicLab';
import { SamplingLab } from './labs/SamplingLab';
import { WaveLab } from './labs/WaveLab';
import { createFileSeed, initialMusicSession, spectrumModeFromSeed, type MusicSessionState } from './music/musicSession';
import type { LabId, PointerPoint } from './types';
import { StarfieldBackground } from './visualization/StarfieldBackground';
import { WaveCanvas } from './visualization/WaveCanvas';

const labs: Array<{ id: Exclude<LabId, 'home'>; title: string; description: string; icon: React.ReactNode }> = [
  { id: 'wave', title: '聲波實驗室', description: '動手改變聲音的響度與音調', icon: <Waves size={22} /> },
  { id: 'sampling', title: '數位取樣實驗室', description: '看看聲音如何變成數位資料', icon: <Calculator size={22} /> },
  { id: 'music', title: '音樂實驗室', description: '匯入自己的音樂，觀察聲音的波形', icon: <Music size={22} /> },
];

export default function App() {
  const [activeLab, setActiveLab] = useState<LabId>('home');
  const [pointer, setPointer] = useState<PointerPoint>({ x: 0.5, y: 0.5 });
  const [musicSession, setMusicSession] = useState<MusicSessionState>(initialMusicSession);
  const musicUrlRef = useRef<string | null>(null);

  const updateMusicSession = useCallback((patch: Partial<MusicSessionState>) => {
    setMusicSession((current) => ({ ...current, ...patch }));
  }, []);

  const replaceMusicFile = useCallback((file: File) => {
    if (musicUrlRef.current) URL.revokeObjectURL(musicUrlRef.current);
    const sourceUrl = URL.createObjectURL(file);
    const dnaSeed = createFileSeed(file);
    musicUrlRef.current = sourceUrl;
    setMusicSession((current) => ({
      ...initialMusicSession,
      sourceUrl,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      volume: current.volume,
      dnaSeed,
      spectrumMode: spectrumModeFromSeed(dnaSeed),
    }));
    return sourceUrl;
  }, []);

  useEffect(() => () => {
    if (musicUrlRef.current) URL.revokeObjectURL(musicUrlRef.current);
  }, []);

  return (
    <main className="app-shell">
      <StarfieldBackground />
      <nav className="top-nav" aria-label="主要導覽">
        <div className="top-nav-track">
          <button type="button" className={activeLab === 'home' ? 'active' : ''} onClick={() => setActiveLab('home')}>
            <Home size={18} />首頁
          </button>
          {labs.map((lab) => (
            <button key={lab.id} type="button" className={activeLab === lab.id ? 'active' : ''} onClick={() => setActiveLab(lab.id)}>
              {lab.icon}{lab.title}
            </button>
          ))}
        </div>
      </nav>

      {activeLab === 'home' && (
        <section
          className="home"
          onPointerMove={(event) => {
            const command = createPointerCommand(event, event.currentTarget);
            if (command.type === 'POINTER_MOVE') {
              setPointer({ x: command.x, y: command.y });
            }
          }}
        >
          <WaveCanvas amplitude={0.62} frequency={360} pointer={pointer} mode="home" />
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
          onReplaceFile={replaceMusicFile}
        />
      )}

    </main>
  );
}
