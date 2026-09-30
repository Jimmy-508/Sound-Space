import { Volume2, Square, Play, StopCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAudioEngine } from '../audio/useAudioEngine';
import { RangeControl } from '../components/RangeControl';
import { SegmentedControl } from '../components/SegmentedControl';
import { createPointerCommand, type CommandHandler } from '../interaction/commandLayer';
import type { PointerPoint, Waveform } from '../types';
import { WaveCanvas } from '../visualization/WaveCanvas';

const waveOptions: Array<{ value: Waveform; label: string }> = [
  { value: 'sine', label: '正弦波' },
  { value: 'square', label: '方波' },
  { value: 'triangle', label: '三角波' },
];

export function WaveLab() {
  const audio = useAudioEngine();
  const [amplitude, setAmplitude] = useState(0.55);
  const [frequency, setFrequency] = useState(440);
  const [waveform, setWaveform] = useState<Waveform>('sine');
  const [playing, setPlaying] = useState(false);
  const [pointer, setPointer] = useState<PointerPoint>({ x: 0.5, y: 0.5 });
  const [hint, setHint] = useState('振幅越大，聲音越大。');

  const dispatch: CommandHandler = (command) => {
    if (command.type === 'AMPLITUDE_SET') {
      setAmplitude(command.value);
      setHint(command.value > amplitude ? '振幅變大，聲音也變大了！' : '振幅變小，聲音也變小了。');
    }
    if (command.type === 'FREQUENCY_SET') {
      setFrequency(command.value);
      setHint(command.value > frequency ? '頻率變高，聲波變得更密集。' : '頻率變低，聲波變得比較疏。');
    }
    if (command.type === 'WAVEFORM_SET') setWaveform(command.value);
    if (command.type === 'POINTER_MOVE') setPointer({ x: command.x, y: command.y });
    if (command.type === 'PLAY') void audio.play().then(() => setPlaying(true));
    if (command.type === 'STOP') {
      audio.stop();
      setPlaying(false);
    }
  };

  useEffect(() => audio.setAmplitude(amplitude), [amplitude, audio]);
  useEffect(() => audio.setFrequency(frequency), [frequency, audio]);
  useEffect(() => audio.setWaveform(waveform), [waveform, audio]);

  return (
    <section className="lab-layout">
      <div
        className="stage"
        onPointerMove={(event) => dispatch(createPointerCommand(event, event.currentTarget))}
      >
        <WaveCanvas amplitude={amplitude} frequency={frequency} waveform={waveform} pointer={pointer} />
        <div className="stage-caption">
          <strong>聲波實驗室</strong>
          <span>{hint}</span>
        </div>
      </div>

      <aside className="control-panel">
        <RangeControl
          label="響度"
          value={Math.round(amplitude * 100)}
          min={0}
          max={100}
          step={1}
          display={`${Math.round(amplitude * 100)}%`}
          onChange={(value) => dispatch({ type: 'AMPLITUDE_SET', value: value / 100 })}
        />
        <RangeControl
          label="音調"
          value={frequency}
          min={120}
          max={1200}
          step={10}
          display={`${frequency} Hz`}
          onChange={(value) => dispatch({ type: 'FREQUENCY_SET', value })}
        />
        <SegmentedControl label="波形" value={waveform} options={waveOptions} onChange={(value) => dispatch({ type: 'WAVEFORM_SET', value })} />
        <div className="button-row">
          <button type="button" className="primary" onClick={() => dispatch({ type: 'PLAY' })}>
            <Play size={19} />播放聲音
          </button>
          <button type="button" onClick={() => dispatch({ type: 'STOP' })}>
            <StopCircle size={19} />停止聲音
          </button>
        </div>
        <p className="quiet"><Volume2 size={16} />AudioContext 會在你按下播放後啟動，適合手機和平板瀏覽器。</p>
        <p className="quiet"><Square size={16} />正弦波、方波、三角波會讓你聽見不同音色。</p>
        <div className="status-pill">{playing ? '正在播放' : '尚未播放'}</div>
      </aside>
    </section>
  );
}
