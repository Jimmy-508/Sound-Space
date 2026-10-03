import type { HandLandmarker } from '@mediapipe/tasks-vision';
import { cameraPointToGesturePoint } from './coordinateTransform';
import { HandTemporalTracker } from './handSmoothing';
import type { GestureFrameStore, Handedness, RawHandDetection } from './types';

const MEDIAPIPE_VERSION = '0.10.35';
const WASM_ROOT = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const DETECTION_INTERVAL_MS = 1000 / 24;

export type CameraErrorKind = 'denied' | 'unavailable' | 'busy' | 'insecure' | 'initialization';

export class CameraStartError extends Error {
  constructor(public readonly kind: CameraErrorKind, cause?: unknown) {
    super(kind, { cause });
    this.name = 'CameraStartError';
  }
}

const classifyCameraError = (error: unknown): CameraStartError => {
  if (!window.isSecureContext) return new CameraStartError('insecure', error);
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') return new CameraStartError('denied', error);
    if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') return new CameraStartError('unavailable', error);
    if (error.name === 'NotReadableError' || error.name === 'AbortError') return new CameraStartError('busy', error);
  }
  return new CameraStartError('initialization', error);
};

const normalizeHandedness = (value?: string): Handedness => {
  if (value === 'Left' || value === 'Right') return value;
  return 'Unknown';
};

export class HandTrackingSession {
  private detector: HandLandmarker | null = null;
  private stream: MediaStream | null = null;
  private animationFrame = 0;
  private generation = 0;
  private lastInferenceAt = 0;
  private lastVideoTime = -1;
  private tracker = new HandTemporalTracker();
  private video: HTMLVideoElement | null = null;

  constructor(private readonly store: GestureFrameStore) {}

  async start(video: HTMLVideoElement) {
    this.stop();
    const generation = ++this.generation;
    this.video = video;

    if (!navigator.mediaDevices?.getUserMedia) throw new CameraStartError('unavailable');
    if (!window.isSecureContext && window.location.hostname !== 'localhost') throw new CameraStartError('insecure');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'user' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 24, max: 30 },
        },
      });
      if (generation !== this.generation) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      this.stream = stream;
      video.srcObject = stream;
      await video.play();

      const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
      const options = {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' as const },
        runningMode: 'VIDEO' as const,
        numHands: 2,
        minHandDetectionConfidence: 0.55,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.55,
      };

      try {
        this.detector = await HandLandmarker.createFromOptions(vision, options);
      } catch {
        this.detector = await HandLandmarker.createFromOptions(vision, {
          ...options,
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
        });
      }

      if (generation !== this.generation) {
        this.detector.close();
        this.detector = null;
        return;
      }

      this.lastInferenceAt = 0;
      this.lastVideoTime = -1;
      this.animationFrame = requestAnimationFrame(this.tick);
    } catch (error) {
      if (generation === this.generation) this.stop();
      if (error instanceof CameraStartError) throw error;
      throw classifyCameraError(error);
    }
  }

  stop() {
    this.generation += 1;
    cancelAnimationFrame(this.animationFrame);
    this.animationFrame = 0;
    this.detector?.close();
    this.detector = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
    }
    this.video = null;
    this.tracker.reset();
    this.store.clear();
  }

  private tick = (timestamp: number) => {
    this.animationFrame = requestAnimationFrame(this.tick);
    if (document.hidden || !this.detector || !this.video || this.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    if (timestamp - this.lastInferenceAt < DETECTION_INTERVAL_MS || this.video.currentTime === this.lastVideoTime) return;

    this.lastInferenceAt = timestamp;
    this.lastVideoTime = this.video.currentTime;
    const result = this.detector.detectForVideo(this.video, timestamp);
    const hands: RawHandDetection[] = result.landmarks.slice(0, 2).map((landmarks, index) => {
      const category = result.handedness[index]?.[0];
      return {
        landmarks: landmarks.map((point) => cameraPointToGesturePoint(point, true)),
        handedness: normalizeHandedness(category?.categoryName),
        confidence: category?.score ?? 0.5,
        timestamp,
      };
    });
    this.store.write(this.tracker.update(hands, timestamp));
  };
}
