import { useEffect, useRef, type RefObject } from 'react';
import type { MusicVisualState } from '../music/useMusicAudioController';

interface HomeMusicTitlesProps {
  playing: boolean;
  visualStateRef: RefObject<MusicVisualState>;
}

export function HomeMusicTitles({ playing, visualStateRef }: HomeMusicTitlesProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const playingRef = useRef(playing);
  playingRef.current = playing;

  useEffect(() => {
    let frame = 0;
    let lastTime = performance.now();
    let awake = 0;

    const render = (now: number) => {
      const root = rootRef.current;
      const visual = visualStateRef.current;
      if (!root || !visual) return;

      const deltaTime = Math.min(0.08, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      const awakeTarget = playingRef.current ? 1 : 0;
      const awakeRate = awakeTarget > awake ? 6.2 : 3.2;
      awake += (awakeTarget - awake) * (1 - Math.exp(-deltaTime * awakeRate));

      const beatAge = now - visual.beatAt;
      const chineseBeat = beatAge >= 0 ? Math.exp(-beatAge / 145) * visual.beatStrength : 0;
      const englishAge = beatAge - 52;
      const englishBeat = englishAge >= 0 ? Math.exp(-englishAge / 128) * visual.beatStrength : 0;
      const trebleGate = Math.max(0, (visual.trebleEnergy - 0.22) / 0.5);
      const doubleFlash = Math.pow(Math.max(0, Math.sin(now * 0.038)), 18) * trebleGate;
      const colorFlow = 0.5 + Math.sin(now * 0.00042 + visual.midEnergy * 1.8) * 0.5;
      const cnBeat = Math.min(1.2, chineseBeat);
      const enBeat = Math.min(1.2, englishBeat);
      const cnSplit = visual.trebleEnergy * 2;
      const enSplit = (visual.trebleEnergy + enBeat) * 2.4;

      root.dataset.neonAwake = awake > 0.012 ? 'true' : 'false';
      root.style.setProperty('--neon-awake', awake.toFixed(3));
      root.style.setProperty('--music-energy', visual.overallEnergy.toFixed(3));
      root.style.setProperty('--bass-energy', visual.bassEnergy.toFixed(3));
      root.style.setProperty('--mid-energy', visual.midEnergy.toFixed(3));
      root.style.setProperty('--treble-energy', visual.trebleEnergy.toFixed(3));
      root.style.setProperty('--cn-beat', cnBeat.toFixed(3));
      root.style.setProperty('--en-beat', enBeat.toFixed(3));
      root.style.setProperty('--club-flicker', doubleFlash.toFixed(3));
      root.style.setProperty('--neon-hue', (188 + colorFlow * 22).toFixed(1));
      root.style.setProperty('--en-hue', (196 + colorFlow * 22).toFixed(1));
      root.style.setProperty('--accent-hue', (276 + colorFlow * 32).toFixed(1));
      root.style.setProperty('--cn-lightness', `${78 + visual.midEnergy * 18}%`);
      root.style.setProperty('--en-lightness', `${76 + visual.midEnergy * 18}%`);
      root.style.setProperty('--cn-brightness', (1 + visual.overallEnergy * 0.62 + cnBeat * 0.78).toFixed(3));
      root.style.setProperty('--en-brightness', (1.04 + visual.midEnergy * 0.48 + visual.trebleEnergy * 0.42 + enBeat * 0.72 + doubleFlash * 0.46).toFixed(3));
      root.style.setProperty('--cn-scale', (1 + visual.bassEnergy * 0.018 + cnBeat * 0.042).toFixed(4));
      root.style.setProperty('--en-scale', (1 + visual.bassEnergy * 0.012 + enBeat * 0.034).toFixed(4));
      root.style.setProperty('--cn-near-scale', (1.01 + visual.bassEnergy * 0.025 + cnBeat * 0.04).toFixed(4));
      root.style.setProperty('--cn-bloom-scale', (1.03 + cnBeat * 0.07).toFixed(4));
      root.style.setProperty('--en-near-scale', (1.008 + enBeat * 0.035).toFixed(4));
      root.style.setProperty('--en-bloom-scale', (1.025 + enBeat * 0.055).toFixed(4));
      root.style.setProperty('--cn-split-negative', `${-cnSplit}px`);
      root.style.setProperty('--cn-split-positive', `${cnSplit}px`);
      root.style.setProperty('--en-split-negative', `${-enSplit}px`);
      root.style.setProperty('--en-split-positive', `${enSplit}px`);
      root.style.setProperty('--cn-split-cyan-alpha', Math.min(0.9, visual.trebleEnergy * 0.9).toFixed(3));
      root.style.setProperty('--cn-split-magenta-alpha', Math.min(0.72, visual.trebleEnergy * 0.72).toFixed(3));
      root.style.setProperty('--cn-core-glow', `${7 + visual.midEnergy * 16}px`);
      root.style.setProperty('--cn-near-glow', `${22 + visual.bassEnergy * 32 + cnBeat * 42}px`);
      root.style.setProperty('--cn-outer-glow', `${48 + visual.bassEnergy * 58 + cnBeat * 72}px`);
      root.style.setProperty('--cn-layer-blur', `${2 + visual.midEnergy * 3}px`);
      root.style.setProperty('--cn-layer-glow', `${18 + cnBeat * 28}px`);
      root.style.setProperty('--cn-bloom-blur', `${15 + visual.bassEnergy * 17}px`);
      root.style.setProperty('--cn-bloom-glow', `${40 + cnBeat * 58}px`);
      root.style.setProperty('--en-core-glow', `${8 + visual.midEnergy * 15}px`);
      root.style.setProperty('--en-near-glow', `${26 + visual.trebleEnergy * 35 + enBeat * 38}px`);
      root.style.setProperty('--en-outer-glow', `${58 + visual.overallEnergy * 62 + enBeat * 70}px`);
      root.style.setProperty('--en-layer-blur', `${2 + visual.trebleEnergy * 4}px`);
      root.style.setProperty('--en-layer-cyan-glow', `${10 + enBeat * 18}px`);
      root.style.setProperty('--en-layer-magenta-glow', `${12 + enBeat * 20}px`);
      root.style.setProperty('--en-bloom-blur', `${18 + visual.overallEnergy * 18}px`);
      root.style.setProperty('--en-bloom-glow', `${52 + enBeat * 64}px`);
      root.style.setProperty('--reduced-cn-near', `${24 + cnBeat * 24}px`);
      root.style.setProperty('--reduced-cn-outer', `${48 + cnBeat * 32}px`);
      root.style.setProperty('--reduced-en-near', `${28 + enBeat * 22}px`);
      root.style.setProperty('--reduced-en-outer', `${54 + enBeat * 28}px`);

      frame = requestAnimationFrame(render);
    };

    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [visualStateRef]);

  return (
    <div ref={rootRef} className="home-title-neon" data-neon-awake="false">
      <p className="eyebrow music-neon-title music-neon-title-cn" data-text="聲音數位化互動實驗室">
        聲音數位化互動實驗室
      </p>
      <h1 className="music-neon-title music-neon-title-en" data-text="Sound Space">Sound Space</h1>
    </div>
  );
}
