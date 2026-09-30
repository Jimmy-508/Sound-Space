export type LabId = 'home' | 'wave' | 'sampling' | 'music';
export type Waveform = 'sine' | 'square' | 'triangle';
export type SamplingTab = 'sample' | 'quantize' | 'size';

export type InteractionCommand =
  | { type: 'AMPLITUDE_SET'; value: number }
  | { type: 'FREQUENCY_SET'; value: number }
  | { type: 'WAVEFORM_SET'; value: Waveform }
  | { type: 'PLAY' }
  | { type: 'STOP' }
  | { type: 'POINTER_MOVE'; x: number; y: number }
  | { type: 'GESTURE_RELEASE'; x: number; y: number };

export interface PointerPoint {
  x: number;
  y: number;
}
