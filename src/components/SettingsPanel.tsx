import { Camera, Gauge, Hand, Sparkles, Volume2, VolumeX } from 'lucide-react';

interface SettingsPanelProps {
  gestureEnabled: boolean;
  gestureStatus: 'idle' | 'starting' | 'ready' | 'error';
  sfxEnabled: boolean;
  blueTearsEnabled: boolean;
  deviceFriendlyEnabled: boolean;
  onGestureChange: (enabled: boolean) => void;
  onSfxChange: (enabled: boolean) => void;
  onBlueTearsChange: (enabled: boolean) => void;
  onDeviceFriendlyChange: (enabled: boolean) => void;
}

export function SettingsPanel({
  gestureEnabled,
  gestureStatus,
  sfxEnabled,
  blueTearsEnabled,
  deviceFriendlyEnabled,
  onGestureChange,
  onSfxChange,
  onBlueTearsChange,
  onDeviceFriendlyChange,
}: SettingsPanelProps) {
  return (
    <section className="settings-page" aria-labelledby="settings-heading">
      <header>
        <p className="eyebrow">Sound Space</p>
        <h1 id="settings-heading">設定</h1>
      </header>
      <div className="settings-list">
        <div className="settings-row">
          <span className="settings-row-icon" aria-hidden="true">{gestureEnabled ? <Hand size={22} /> : <Camera size={22} />}</span>
          <span className="settings-copy">
            <strong>手勢互動</strong>
            <small>{gestureStatus === 'starting' ? '正在啟動攝影機' : gestureEnabled ? '攝影機與手勢辨識已開啟' : '攝影機保持關閉'}</small>
          </span>
          <button
            type="button"
            className="settings-switch"
            aria-pressed={gestureEnabled}
            onClick={() => onGestureChange(!gestureEnabled)}
          >
            {gestureEnabled ? '開啟' : '關閉'}
          </button>
        </div>
        <div className="settings-row">
          <span className="settings-row-icon" aria-hidden="true">{sfxEnabled ? <Volume2 size={22} /> : <VolumeX size={22} />}</span>
          <span className="settings-copy">
            <strong>音效</strong>
            <small>控制介面與手勢互動音效，不影響匯入音樂</small>
          </span>
          <button
            type="button"
            className="settings-switch"
            aria-pressed={sfxEnabled}
            onClick={() => onSfxChange(!sfxEnabled)}
          >
            {sfxEnabled ? '開啟' : '關閉'}
          </button>
        </div>
        <div className="settings-row">
          <span className="settings-row-icon" aria-hidden="true"><Sparkles size={22} /></span>
          <span className="settings-copy">
            <strong>藍眼淚效果</strong>
            <small>控制移動軌跡粒子，不影響脈衝與聲音精靈互動</small>
          </span>
          <button
            type="button"
            className="settings-switch"
            aria-pressed={blueTearsEnabled}
            onClick={() => onBlueTearsChange(!blueTearsEnabled)}
          >
            {blueTearsEnabled ? '開啟' : '關閉'}
          </button>
        </div>
        <div className="settings-row">
          <span className="settings-row-icon" aria-hidden="true"><Gauge size={22} /></span>
          <span className="settings-copy">
            <strong>裝置友善</strong>
            <small>限制聲波實驗室的最高音調，適合教室與多裝置使用。</small>
          </span>
          <button
            type="button"
            className="settings-switch"
            aria-pressed={deviceFriendlyEnabled}
            onClick={() => onDeviceFriendlyChange(!deviceFriendlyEnabled)}
          >
            {deviceFriendlyEnabled ? '開啟' : '關閉'}
          </button>
        </div>
      </div>
    </section>
  );
}
