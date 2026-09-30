export function formatBytes(bytes: number) {
  const kb = bytes / 1024;
  const mb = kb / 1024;
  return {
    bytesText: `${Math.round(bytes).toLocaleString('zh-TW')} Bytes`,
    kbText: `約 ${kb.toLocaleString('zh-TW', { maximumFractionDigits: 2 })} KB`,
    mbText: `${mb.toLocaleString('zh-TW', { maximumFractionDigits: 2 })} MB`,
  };
}

export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}
