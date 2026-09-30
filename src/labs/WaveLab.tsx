import { Play, Radio, StopCircle } from 'lucide-react';
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
const frequencyMin = 120;
const frequencyMax = 4000;
const frequencySliderMax = 1000;

export function WaveLab() {
  const audio = useAudioEngine();
  const [amplitude, setAmplitude] = useState(0.5);
  const [frequency, setFrequency] = useState(440);
  const [waveform, setWaveform] = useState<Waveform>('sine');
  const [playing, setPlaying] = useState(false);
  const [pointer, setPointer] = useState<PointerPoint>({ x: 0.5, y: 0.5 });

  const dispatch: CommandHandler = (command) => {
    if (command.type === 'AMPLITUDE_SET') {
      setAmplitude(command.value);
    }
    if (command.type === 'FREQUENCY_SET') {
      setFrequency(command.value);
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
      </div>

      <aside className="control-panel">
        <RangeControl
          label="響度"
          value={Math.round(amplitude * 100)}
          min={0}
          max={100}
          step={1}
          display={`${Math.round(amplitude * 100)}%`}
          ariaValueText={`響度 ${Math.round(amplitude * 100)}%`}
          onChange={(value) => dispatch({ type: 'AMPLITUDE_SET', value: value / 100 })}
        />
        <RangeControl
          label="音調"
          value={frequencyToSlider(frequency)}
          min={0}
          max={frequencySliderMax}
          step={1}
          display={`${frequency} Hz`}
          ariaValueText={`音調 ${frequency} Hz`}
          onChange={(value) => dispatch({ type: 'FREQUENCY_SET', value: sliderToFrequency(value) })}
        />
        <SegmentedControl label="波形" value={waveform} options={waveOptions} onChange={(value) => dispatch({ type: 'WAVEFORM_SET', value })} />
        <div className="button-row">
          <button type="button" className={`primary ${playing ? 'playing' : ''}`} aria-pressed={playing} onClick={() => dispatch({ type: 'PLAY' })}>
            {playing ? <Radio size={19} /> : <Play size={19} />}{playing ? '正在播放' : '播放聲音'}
          </button>
          <button type="button" onClick={() => dispatch({ type: 'STOP' })}>
            <StopCircle size={19} />停止聲音
          </button>
        </div>
      </aside>
    </section>
  );
}

function frequencyToSlider(frequency: number) {
  return Math.round(Math.log(frequency / frequencyMin) / Math.log(frequencyMax / frequencyMin) * frequencySliderMax);
}

function sliderToFrequency(value: number) {
  const frequency = frequencyMin * (frequencyMax / frequencyMin) ** (value / frequencySliderMax);
  return Math.min(frequencyMax, Math.max(frequencyMin, Math.round(frequency / 10) * 10));
}
