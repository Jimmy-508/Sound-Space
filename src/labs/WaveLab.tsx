import { Play, Radio, StopCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAudioEngine } from '../audio/useAudioEngine';
import { RangeControl } from '../components/RangeControl';
import { SegmentedControl } from '../components/SegmentedControl';
import { createPointerCommand, type CommandHandler } from '../interaction/commandLayer';
import type { GestureInteractionController } from '../gesture/interactionController';
import { mapWaveAmplitude, mapWaveFrequency } from '../gesture/gestureMappings';
import type { PointerPoint, Waveform } from '../types';
import { WaveCanvas } from '../visualization/WaveCanvas';
import {
  type SoundSpiritInteractionRecorder,
} from '../spirit/soundSpiritIdentity';
import {
  clampWaveFrequency,
  getEffectiveWaveFrequencyMax,
  waveFrequencyToSlider,
  waveSliderToFrequency,
} from '../settings/deviceFriendlyAudio';

const waveOptions: Array<{ value: Waveform; label: string }> = [
  { value: 'sine', label: '正弦波' },
  { value: 'square', label: '方波' },
  { value: 'triangle', label: '三角波' },
];
const frequencySliderMax = 1000;

interface WaveLabProps {
  interactionRecorder: SoundSpiritInteractionRecorder;
  gestureController: GestureInteractionController;
  deviceFriendlyEnabled: boolean;
}

export function WaveLab({ interactionRecorder, gestureController, deviceFriendlyEnabled }: WaveLabProps) {
  const audio = useAudioEngine();
  const [amplitude, setAmplitude] = useState(0.5);
  const [frequency, setFrequency] = useState(440);
  const [waveform, setWaveform] = useState<Waveform>('sine');
  const [playing, setPlaying] = useState(false);
  const [pointer, setPointer] = useState<PointerPoint>({ x: 0.5, y: 0.5 });
  const [hint, setHint] = useState('振幅越大，聲音越大。');
  const effectiveWaveFrequencyMax = getEffectiveWaveFrequencyMax(deviceFriendlyEnabled);

  const dispatch: CommandHandler = (command) => {
    if (command.type === 'AMPLITUDE_SET') {
      interactionRecorder.observeAmplitude(amplitude, command.value);
      setAmplitude(command.value);
      setHint(command.value > amplitude ? '振幅變大，聲音也變大了！' : '振幅變小，聲音也變小了。');
    }
    if (command.type === 'FREQUENCY_SET') {
      const next = clampWaveFrequency(command.value, effectiveWaveFrequencyMax);
      if (next !== frequency) interactionRecorder.observeFrequency(frequency, next);
      setFrequency(next);
      setHint(next > frequency ? '頻率變高，聲波變得更密集。' : '頻率變低，聲波變得比較疏。');
    }
    if (command.type === 'WAVEFORM_SET') {
      interactionRecorder.observeWaveform(waveform, command.value);
      setWaveform(command.value);
    }
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

  useEffect(() => {
    if (frequency > effectiveWaveFrequencyMax) {
      dispatch({ type: 'FREQUENCY_SET', value: effectiveWaveFrequencyMax });
    }
  }, [effectiveWaveFrequencyMax, frequency]);

  useEffect(() => {
    let frame = 0;
    let lastTimestamp = -1;
    const update = () => {
      frame = requestAnimationFrame(update);
      const gesture = gestureController.read();
      if (!gesture.timestamp || gesture.timestamp === lastTimestamp) return;
      lastTimestamp = gesture.timestamp;
      if (gesture.twoHand.gesture !== 'none') {
        setFrequency((current) => {
          const next = mapWaveFrequency(current, gesture.twoHand.gesture, gesture.twoHand.rate, effectiveWaveFrequencyMax);
          if (next !== current) interactionRecorder.observeFrequency(current, next);
          return next;
        });
        return;
      }
      if (gesture.fist?.axis === 'y' && gesture.fist.deltaY !== 0) {
        setAmplitude((current) => {
          const next = mapWaveAmplitude(current, gesture.fist!.deltaY);
          if (Math.abs(next - current) > 0.0001) interactionRecorder.observeAmplitude(current, next);
          return next;
        });
      }
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [effectiveWaveFrequencyMax, gestureController, interactionRecorder]);

  return (
    <section className="lab-layout">
      <div
        className="stage"
        onPointerMove={(event) => dispatch(createPointerCommand(event, event.currentTarget))}
      >
        <WaveCanvas amplitude={amplitude} frequency={frequency} waveform={waveform} pointer={pointer} />
        <div className="stage-note"><span>{hint}</span></div>
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
          value={waveFrequencyToSlider(frequency, effectiveWaveFrequencyMax, frequencySliderMax)}
          min={0}
          max={frequencySliderMax}
          step={1}
          display={`${frequency} Hz`}
          ariaValueText={`音調 ${frequency} Hz`}
          onChange={(value) => dispatch({ type: 'FREQUENCY_SET', value: waveSliderToFrequency(value, effectiveWaveFrequencyMax, frequencySliderMax) })}
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
