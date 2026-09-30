import { AudioWaveform, Calculator, Home, Music, Waves } from 'lucide-react';
import { useState } from 'react';
import { createPointerCommand } from './interaction/commandLayer';
import { MusicLab } from './labs/MusicLab';
import { SamplingLab } from './labs/SamplingLab';
import { WaveLab } from './labs/WaveLab';
import type { LabId, PointerPoint } from './types';
import { WaveCanvas } from './visualization/WaveCanvas';

const labs: Array<{ id: Exclude<LabId, 'home'>; title: string; description: string; icon: React.ReactNode }> = [
  { id: 'wave', title: '聲波實驗室', description: '動手改變聲音的響度與音調', icon: <Waves size={22} /> },
  { id: 'sampling', title: '數位取樣實驗室', description: '看看聲音如何變成數位資料', icon: <Calculator size={22} /> },
  { id: 'music', title: '音樂實驗室', description: '匯入自己的音樂，觀察聲音的波形', icon: <Music size={22} /> },
];

export default function App() {
  const [activeLab, setActiveLab] = useState<LabId>('home');
  const [pointer, setPointer] = useState<PointerPoint>({ x: 0.5, y: 0.5 });

  return (
    <main className="app-shell">
      <nav className="top-nav" aria-label="主要導覽">
        <button type="button" className={activeLab === 'home' ? 'active' : ''} onClick={() => setActiveLab('home')}>
          <Home size={18} />首頁
        </button>
        {labs.map((lab) => (
          <button key={lab.id} type="button" className={activeLab === lab.id ? 'active' : ''} onClick={() => setActiveLab(lab.id)}>
            {lab.icon}{lab.title}
          </button>
        ))}
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
            <p>用手、滑鼠或觸控改變聲波，理解聲音如何被取樣、量化，最後變成數位資料。</p>
            <div className="entry-grid">
              {labs.map((lab) => (
                <button key={lab.id} type="button" onClick={() => setActiveLab(lab.id)}>
                  {lab.icon}
                  <strong>{lab.title}</strong>
                  <span>{lab.description}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {activeLab === 'wave' && <WaveLab />}
      {activeLab === 'sampling' && <SamplingLab />}
      {activeLab === 'music' && <MusicLab />}

      <div className="orientation-tip">橫向使用可以獲得更好的互動體驗。</div>
    </main>
  );
}
