import { useMemo, useState } from 'react';
import { RangeControl } from '../components/RangeControl';
import { SegmentedControl } from '../components/SegmentedControl';
import type { PointerPoint, SamplingTab } from '../types';
import { formatBytes } from '../utils/format';
import { WaveCanvas } from '../visualization/WaveCanvas';

const sampleRates = [8000, 22050, 44100, 48000, 96000];
const bitDepths = [8, 16, 24, 32];
const quantizeBits = [1, 2, 4, 8, 16, 24];
const lengthOptions = [
  { label: '10 秒', value: 10 },
  { label: '30 秒', value: 30 },
  { label: '1 分鐘', value: 60 },
  { label: '3 分鐘', value: 180 },
];

export function SamplingLab() {
  const [tab, setTab] = useState<SamplingTab>('sample');
  const [sampleCount, setSampleCount] = useState(16);
  const [sampleRate, setSampleRate] = useState(44100);
  const [bitDepth, setBitDepth] = useState(16);
  const [quantizeBit, setQuantizeBit] = useState(4);
  const [channels, setChannels] = useState(2);
  const [seconds, setSeconds] = useState(60);
  const pointer: PointerPoint = { x: 0.5, y: 0.5 };
  const bytes = sampleRate * (bitDepth / 8) * channels * seconds;
  const formatted = formatBytes(bytes);
  const levels = useMemo(() => 2 ** quantizeBit, [quantizeBit]);

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
        <div className="stage-caption">
          <strong>數位取樣實驗室</strong>
          <span>{tab === 'sample' ? '取樣越密集，記錄到的聲音資訊越完整。' : tab === 'quantize' ? '量化位元數越高，振幅記錄越精細。' : '資料核心會隨檔案大小變亮。'}</span>
        </div>
        {tab === 'size' && <div className="data-core" style={{ transform: `scale(${Math.min(1.65, 0.72 + bytes / 60000000)})` }} />}
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
            <RangeControl label="取樣點密度" value={sampleCount} min={4} max={32} step={4} display={`${sampleCount} 點`} onChange={setSampleCount} />
            <SegmentedControl label="取樣頻率" value={sampleRate} options={sampleRates.map((value) => ({ value, label: `${value.toLocaleString('zh-TW')} Hz` }))} onChange={setSampleRate} />
            <p className="quiet">畫面用少量取樣點示範概念，不會真的畫出每秒數萬個點。</p>
          </>
        )}

        {tab === 'quantize' && (
          <>
            <SegmentedControl label="量化位元數" value={quantizeBit} options={quantizeBits.map((value) => ({ value, label: `${value} 位元` }))} onChange={setQuantizeBit} />
            <div className="result-card">
              <strong>{quantizeBit} 位元 → {levels.toLocaleString('zh-TW')} 個階層</strong>
              <span>低位元會出現明顯階梯，高位元會更接近原始聲波。</span>
            </div>
          </>
        )}

        {tab === 'size' && (
          <>
            <SegmentedControl label="取樣頻率" value={sampleRate} options={sampleRates.map((value) => ({ value, label: `${value.toLocaleString('zh-TW')} Hz` }))} onChange={setSampleRate} />
            <SegmentedControl label="量化位元數" value={bitDepth} options={bitDepths.map((value) => ({ value, label: `${value} 位元` }))} onChange={setBitDepth} />
            <SegmentedControl label="聲道" value={channels} options={[{ value: 1, label: '單聲道' }, { value: 2, label: '雙聲道（立體聲）' }]} onChange={setChannels} />
            <SegmentedControl label="聲音長度" value={seconds} options={lengthOptions} onChange={setSeconds} />
            <label className="control">
              <span>自訂秒數<strong>{seconds} 秒</strong></span>
              <input type="number" min={1} max={3600} value={seconds} onChange={(event) => setSeconds(Math.max(1, Number(event.currentTarget.value) || 1))} />
            </label>
            <div className="result-card important">
              <span>檔案大小</span>
              <strong>{formatted.mbText}</strong>
              <small>{formatted.bytesText}｜{formatted.kbText}</small>
            </div>
            <div className="formula">
              <strong>計算方式</strong>
              <span>{sampleRate.toLocaleString('zh-TW')} × ({bitDepth} ÷ 8) × {channels} × {seconds}</span>
              <small>{sampleRate.toLocaleString('zh-TW')}：每秒取樣次數｜{bitDepth} ÷ 8：每個樣本使用的位元組｜{channels}：聲道數｜{seconds}：秒數</small>
            </div>
          </>
        )}
      </aside>
    </section>
  );
}
