import { useEffect, useMemo } from 'react';
import { AudioEngine } from './AudioEngine';

export function useAudioEngine() {
  const engine = useMemo(() => new AudioEngine(), []);

  useEffect(() => () => engine.stop(), [engine]);

  return engine;
}
