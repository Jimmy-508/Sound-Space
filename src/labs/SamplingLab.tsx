import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { RangeControl } from '../components/RangeControl';
import { SegmentedControl } from '../components/SegmentedControl';
import type { GestureInteractionController } from '../gesture/interactionController';
import { DiscreteGestureAccumulator, resolveSamplingGesture } from '../gesture/gestureMappings';
import type { PointerPoint, SamplingTab } from '../types';
import { formatBytes } from '../utils/format';
import { WaveCanvas } from '../visualization/WaveCanvas';
import type { SoundSpiritInteractionRecorder } from '../spirit/soundSpiritIdentity';

const sampleRates = [8000, 22050, 44100, 48000, 96000];
const samplePointCounts = [9, 18, 30, 36, 60];
const bitDepths = [8, 16, 24, 32];
const quantizeBits = [1, 2, 4, 8, 16, 24];

interface SamplingLabProps {
  interactionRecorder: SoundSpiritInteractionRecorder;
  gestureController: GestureInteractionController;
}

export function SamplingLab({ interactionRecorder, gestureController }: SamplingLabProps) {
  const [tab, setTab] = useState<SamplingTab>('sample');
  const [sampleRateIndex, setSampleRateIndex] = useState(0);
  const [sizeSampleRateIndex, setSizeSampleRateIndex] = useState(2);
  const [bitDepthIndex, setBitDepthIndex] = useState(1);
  const [quantizeBitIndex, setQuantizeBitIndex] = useState(0);
  const [channels, setChannels] = useState(2);
  const [seconds, setSeconds] = useState(60);
  const [activeGestureControl, setActiveGestureControl] = useState<string | null>(null);
  const gestureAccumulatorRef = useRef(new DiscreteGestureAccumulator());
  const gestureStateRef = useRef({ tab, sampleRateIndex, sizeSampleRateIndex, bitDepthIndex, quantizeBitIndex, seconds });
  gestureStateRef.current = { tab, sampleRateIndex, sizeSampleRateIndex, bitDepthIndex, quantizeBitIndex, seconds };
  const pointer: PointerPoint = { x: 0.5, y: 0.5 };
  const sampleRate = sampleRates[sampleRateIndex];
  const sizeSampleRate = sampleRates[sizeSampleRateIndex];
  const sampleCount = samplePointCounts[sampleRateIndex];
  const bitDepth = bitDepths[bitDepthIndex];
  const quantizeBit = quantizeBits[quantizeBitIndex];
  const bytes = sizeSampleRate * (bitDepth / 8) * channels * seconds;
  const formatted = formatBytes(bytes);
  const levels = useMemo(() => 2 ** quantizeBit, [quantizeBit]);
  const coreIntensity = Math.min(1, Math.max(0, bytes / 70000000));
  const setObservedSampleRateIndex = (next: number, sizeMode = false) => {
    const previous = sizeMode ? sizeSampleRate : sampleRate;
    const nextRate = sampleRates[next];
    interactionRecorder.observeSampleRate(previous, nextRate);
    if (sizeMode) {
      setSizeSampleRateIndex(next);
      interactionRecorder.observeSamplingCombination(nextRate, bitDepth, channels);
    } else {
      setSampleRateIndex(next);
      interactionRecorder.observeSamplingCombination(nextRate, quantizeBit, channels);
    }
  };
  const setObservedQuantizeBitIndex = (next: number) => {
    const nextDepth = quantizeBits[next];
    interactionRecorder.observeBitDepth(quantizeBit, nextDepth);
    interactionRecorder.observeSamplingCombination(sampleRate, nextDepth, channels);
    setQuantizeBitIndex(next);
  };
  const setObservedBitDepthIndex = (next: number) => {
    const nextDepth = bitDepths[next];
    interactionRecorder.observeBitDepth(bitDepth, nextDepth);
    interactionRecorder.observeSamplingCombination(sizeSampleRate, nextDepth, channels);
    setBitDepthIndex(next);
  };
  const setObservedChannels = (next: number) => {
    interactionRecorder.observeChannels(channels, next);
    interactionRecorder.observeSamplingCombination(sizeSampleRate, bitDepth, next);
    setChannels(next);
  };

  const changeTab = (next: SamplingTab) => {
    setTab(next);
    setActiveGestureControl(null);
    gestureAccumulatorRef.current.reset();
  };

  useEffect(() => {
    const selectControl = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (gestureStateRef.current.tab === 'size' && id?.startsWith('size-')) setActiveGestureControl(id);
    };
    const resetGestureSelection = () => {
      setActiveGestureControl(null);
      gestureAccumulatorRef.current.reset();
    };
    window.addEventListener('soundspace:gesture-control-selected', selectControl);
    window.addEventListener('soundspace:gesture-reset', resetGestureSelection);
    return () => {
      window.removeEventListener('soundspace:gesture-control-selected', selectControl);
      window.removeEventListener('soundspace:gesture-reset', resetGestureSelection);
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    let lastTimestamp = -1;
    const update = () => {
      frame = requestAnimationFrame(update);
      const gesture = gestureController.read();
      if (!gesture.timestamp || gesture.timestamp === lastTimestamp) return;
      lastTimestamp = gesture.timestamp;
      const fist = gesture.fist;
      if (!fist || fist.axis === 'none') {
        gestureAccumulatorRef.current.reset();
        return;
      }
      const current = gestureStateRef.current;
      const action = resolveSamplingGesture(current.tab, fist.axis, activeGestureControl);
      if (action === 'scroll') {
        window.scrollBy({ top: fist.deltaY * 920, behavior: 'auto' });
        return;
      }
      if (action === 'none') return;
      const direction = gestureAccumulatorRef.current.update(fist.deltaX);
      if (!direction) return;
      if (current.tab === 'sample') {
        const next = Math.min(sampleRates.length - 1, Math.max(0, current.sampleRateIndex + direction));
        if (next !== current.sampleRateIndex) {
          interactionRecorder.observeSampleRate(sampleRates[current.sampleRateIndex], sampleRates[next]);
          interactionRecorder.observeSamplingCombination(sampleRates[next], quantizeBits[current.quantizeBitIndex], channels);
          gestureStateRef.current.sampleRateIndex = next;
          setSampleRateIndex(next);
        }
        return;
      }
      if (current.tab === 'quantize') {
        const next = Math.min(quantizeBits.length - 1, Math.max(0, current.quantizeBitIndex + direction));
        if (next !== current.quantizeBitIndex) {
          interactionRecorder.observeBitDepth(quantizeBits[current.quantizeBitIndex], quantizeBits[next]);
          interactionRecorder.observeSamplingCombination(sampleRates[current.sampleRateIndex], quantizeBits[next], channels);
          gestureStateRef.current.quantizeBitIndex = next;
          setQuantizeBitIndex(next);
        }
        return;
      }
      if (action === 'size-sample-rate') {
        const next = Math.min(sampleRates.length - 1, Math.max(0, current.sizeSampleRateIndex + direction));
        if (next !== current.sizeSampleRateIndex) {
          interactionRecorder.observeSampleRate(sampleRates[current.sizeSampleRateIndex], sampleRates[next]);
          interactionRecorder.observeSamplingCombination(sampleRates[next], bitDepths[current.bitDepthIndex], channels);
          gestureStateRef.current.sizeSampleRateIndex = next;
          setSizeSampleRateIndex(next);
        }
      } else if (action === 'size-bit-depth') {
        const next = Math.min(bitDepths.length - 1, Math.max(0, current.bitDepthIndex + direction));
        if (next !== current.bitDepthIndex) {
          interactionRecorder.observeBitDepth(bitDepths[current.bitDepthIndex], bitDepths[next]);
          interactionRecorder.observeSamplingCombination(sampleRates[current.sizeSampleRateIndex], bitDepths[next], channels);
          gestureStateRef.current.bitDepthIndex = next;
          setBitDepthIndex(next);
        }
      } else if (action === 'size-duration') {
        const next = Math.min(300, Math.max(1, current.seconds + direction * 5));
        gestureStateRef.current.seconds = next;
        setSeconds(next);
      }
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [activeGestureControl, channels, gestureController, interactionRecorder]);

  return (
    <section className="lab-layout">
      <div className="stage">
        <WaveCanvas
          amplitude={0.72}
          frequency={420}
          pointer={pointer}
          mode={tab === 'sample' ? 'sample' : tab === 'quantize' ? 'quantize' : 'wave'}
          sampleCount={sampleCount}
          bitDepth={quantizeBit}
        />
        <div className="stage-note">
          <span>{tab === 'sample' ? '取樣越密集，記錄到的聲音資訊越完整。' : tab === 'quantize' ? '量化位元數越高，振幅記錄越精細。' : '資料核心會隨檔案大小變亮。'}</span>
        </div>
        {tab === 'size' && (
          <div
            className="data-core"
            style={{
              '--core-scale': `${0.78 + coreIntensity * 0.72}`,
              '--core-halo': `${48 + coreIntensity * 82}px`,
              '--core-pulse': `${0.34 + coreIntensity * 0.42}`,
              '--core-particle-opacity': `${0.2 + coreIntensity * 0.56}`,
            } as CSSProperties}
          >
            <span />
            <span />
            <span />
          </div>
        )}
      </div>

      <aside className="control-panel">
        <SegmentedControl
          label="實驗內容"
          value={tab}
          options={[
            { value: 'sample', label: '取樣' },
            { value: 'quantize', label: '量化' },
            { value: 'size', label: '檔案大小' },
          ]}
          onChange={changeTab}
        />

        {tab === 'sample' && (
          <>
            <RangeControl
              label="取樣頻率"
              value={sampleRateIndex}
              min={0}
              max={sampleRates.length - 1}
              step={1}
              display={`${sampleRate.toLocaleString('zh-TW')} Hz`}
              ariaValueText={`取樣頻率 ${sampleRate} Hz`}
              onChange={(value) => setObservedSampleRateIndex(value)}
            />
          </>
        )}

        {tab === 'quantize' && (
          <>
            <RangeControl
              label="量化位元數"
              value={quantizeBitIndex}
              min={0}
              max={quantizeBits.length - 1}
              step={1}
              display={`${quantizeBit} 位元`}
              ariaValueText={`量化位元數 ${quantizeBit} 位元`}
              onChange={setObservedQuantizeBitIndex}
            />
            <div className="result-card">
              <strong>{levels.toLocaleString('zh-TW')} 個階層</strong>
              <span>{quantizeBit} 位元可以記錄 {levels.toLocaleString('zh-TW')} 種振幅階層。</span>
            </div>
          </>
        )}

        {tab === 'size' && (
          <>
            <RangeControl
              label="取樣頻率"
              value={sizeSampleRateIndex}
              min={0}
              max={sampleRates.length - 1}
              step={1}
              display={`${sizeSampleRate.toLocaleString('zh-TW')} Hz`}
              ariaValueText={`取樣頻率 ${sizeSampleRate} Hz`}
              gestureControlId="size-sample-rate"
              gestureSelected={activeGestureControl === 'size-sample-rate'}
              onChange={(value) => setObservedSampleRateIndex(value, true)}
            />
            <RangeControl
              label="量化位元數"
              value={bitDepthIndex}
              min={0}
              max={bitDepths.length - 1}
              step={1}
              display={`${bitDepth} 位元`}
              ariaValueText={`量化位元數 ${bitDepth} 位元`}
              gestureControlId="size-bit-depth"
              gestureSelected={activeGestureControl === 'size-bit-depth'}
              onChange={setObservedBitDepthIndex}
            />
            <SegmentedControl label="聲道" value={channels} options={[{ value: 1, label: '單聲道' }, { value: 2, label: '雙聲道（立體聲）' }]} onChange={setObservedChannels} />
            <RangeControl
              label="聲音長度"
              value={seconds}
              min={1}
              max={300}
              step={1}
              display={formatDurationLabel(seconds)}
              ariaValueText={`聲音長度 ${seconds} 秒`}
              gestureControlId="size-duration"
              gestureSelected={activeGestureControl === 'size-duration'}
              onChange={setSeconds}
            />
            <div className="result-card important">
              <span>檔案大小</span>
              <strong>{formatted.mbText}</strong>
              <small>{formatted.bytesText}｜{formatted.kbText}</small>
            </div>
            <div className="formula">
              <strong>計算方式</strong>
              <span>{sizeSampleRate.toLocaleString('zh-TW')} × ({bitDepth} ÷ 8) × {channels} × {seconds}</span>
              <small>{sizeSampleRate.toLocaleString('zh-TW')}：每秒取樣次數｜{bitDepth} ÷ 8：每個樣本使用的位元組｜{channels}：聲道數｜{seconds}：秒數</small>
            </div>
          </>
        )}
      </aside>
    </section>
  );
}

function formatDurationLabel(seconds: number) {
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${seconds} 秒（${minutes} 分鐘）` : `${seconds} 秒（${minutes} 分 ${rest} 秒）`;
}
