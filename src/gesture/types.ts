export type GestureName = 'none' | 'openPalm' | 'fist' | 'pointing';

export type Handedness = 'Left' | 'Right' | 'Unknown';

export interface GesturePoint {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface RawHandDetection {
  landmarks: GesturePoint[];
  handedness: Handedness;
  confidence: number;
  timestamp: number;
}

export interface TrackedHand extends RawHandDetection {
  id: number;
  gesture: GestureName;
  lostOpacity: number;
}

export interface GestureFrame {
  hands: TrackedHand[];
  twoHandsPresent: boolean;
  timestamp: number;
}

const EMPTY_FRAME: GestureFrame = Object.freeze({
  hands: [],
  twoHandsPresent: false,
  timestamp: 0,
});

export class GestureFrameStore {
  private frame: GestureFrame = EMPTY_FRAME;

  read() {
    return this.frame;
  }

  write(frame: GestureFrame) {
    this.frame = frame;
  }

  clear() {
    this.frame = EMPTY_FRAME;
  }
}
