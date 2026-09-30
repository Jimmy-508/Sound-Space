import { type CSSProperties, useMemo, useState } from 'react';
import { RangeControl } from '../components/RangeControl';
import { SegmentedControl } from '../components/SegmentedControl';
import type { PointerPoint, SamplingTab } from '../types';
import { formatBytes } from '../utils/format';
import { WaveCanvas } from '../visualization/WaveCanvas';

const sampleRates = [8000, 22050, 44100, 48000, 96000];
const samplePointCounts = [9, 18, 30, 36, 60];
const bitDepths = [8, 16, 24, 32];
const quantizeBits = [1, 2, 4, 8, 16, 24];

export function SamplingLab() {
  const [tab, setTab] = useState<SamplingTab>('sample');
  const [sampleRateIndex, setSampleRateIndex] = useState(0);
  const [sizeSampleRateIndex, setSizeSampleRateIndex] = useState(2);
  const [bitDepthIndex, setBitDepthIndex] = useState(1);
  const [quantizeBitIndex, setQuantizeBitIndex] = useState(0);
  const [channels, setChannels] = useState(2);
  const [seconds, setSeconds] = useState(60);
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
          onChange={setTab}
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
              onChange={setSampleRateIndex}
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
              onChange={setQuantizeBitIndex}
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
              onChange={setSizeSampleRateIndex}
            />
            <RangeControl
              label="量化位元數"
              value={bitDepthIndex}
              min={0}
              max={bitDepths.length - 1}
              step={1}
              display={`${bitDepth} 位元`}
              ariaValueText={`量化位元數 ${bitDepth} 位元`}
              onChange={setBitDepthIndex}
            />
            <SegmentedControl label="聲道" value={channels} options={[{ value: 1, label: '單聲道' }, { value: 2, label: '雙聲道（立體聲）' }]} onChange={setChannels} />
            <RangeControl
              label="聲音長度"
              value={seconds}
              min={1}
              max={300}
              step={1}
              display={formatDurationLabel(seconds)}
              ariaValueText={`聲音長度 ${seconds} 秒`}
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
