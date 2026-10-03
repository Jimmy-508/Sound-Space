import { classifyGesture, GestureStabilizer } from './gestureClassifier';
import type { GestureFrame, GestureName, GesturePoint, RawHandDetection, TrackedHand } from './types';

const LOST_GRACE_MS = 220;

interface HandTrack {
  id: number;
  handedness: RawHandDetection['handedness'];
  confidence: number;
  landmarks: GesturePoint[];
  lastSeen: number;
  lastUpdate: number;
  gesture: GestureName;
  stabilizer: GestureStabilizer;
}

const palmCenter = (points: GesturePoint[]) => {
  const indices = [0, 5, 9, 13, 17];
  return indices.reduce(
    (center, index) => ({ x: center.x + points[index].x / indices.length, y: center.y + points[index].y / indices.length }),
    { x: 0, y: 0 },
  );
};

const trackDistance = (track: HandTrack, detection: RawHandDetection) => {
  const a = palmCenter(track.landmarks);
  const b = palmCenter(detection.landmarks);
  const handednessPenalty = track.handedness === detection.handedness ? 0 : 0.16;
  return Math.hypot(a.x - b.x, a.y - b.y) + handednessPenalty;
};

const smoothPoint = (previous: GesturePoint, next: GesturePoint, deltaSeconds: number, index: number): GesturePoint => {
  const speed = Math.hypot(next.x - previous.x, next.y - previous.y) / Math.max(1 / 120, deltaSeconds);
  const fingertipBoost = [4, 8, 12, 16, 20].includes(index) ? 0.07 : 0;
  const alpha = Math.min(0.86, Math.max(0.2, 0.2 + speed * 0.3 + fingertipBoost));
  return {
    x: previous.x + (next.x - previous.x) * alpha,
    y: previous.y + (next.y - previous.y) * alpha,
    z: previous.z + (next.z - previous.z) * alpha,
    visibility: next.visibility,
  };
};

export class HandTemporalTracker {
  private tracks: HandTrack[] = [];
  private nextId = 1;
  private twoHands = false;
  private twoHandsCandidate = false;
  private twoHandsCandidateSince = 0;

  update(detections: RawHandDetection[], timestamp: number): GestureFrame {
    const candidates = detections.slice(0, 2);
    const usedTracks = new Set<number>();
    const assignments = candidates.map((detection) => {
      const match = this.tracks
        .filter((track) => !usedTracks.has(track.id))
        .map((track) => ({ track, distance: trackDistance(track, detection) }))
        .sort((a, b) => a.distance - b.distance)[0];
      if (match && match.distance < 0.72) usedTracks.add(match.track.id);
      return { detection, track: match && match.distance < 0.72 ? match.track : undefined };
    });

    for (const { detection, track } of assignments) {
      if (!track) {
        const stabilizer = new GestureStabilizer();
        this.tracks.push({
          id: this.nextId++,
          handedness: detection.handedness,
          confidence: detection.confidence,
          landmarks: detection.landmarks,
          lastSeen: timestamp,
          lastUpdate: timestamp,
          gesture: stabilizer.update(classifyGesture(detection.landmarks), timestamp),
          stabilizer,
        });
        continue;
      }

      const deltaSeconds = (timestamp - track.lastUpdate) / 1000;
      track.landmarks = detection.landmarks.map((point, index) => smoothPoint(track.landmarks[index], point, deltaSeconds, index));
      track.handedness = detection.handedness;
      track.confidence = detection.confidence;
      track.lastSeen = timestamp;
      track.lastUpdate = timestamp;
      track.gesture = track.stabilizer.update(classifyGesture(track.landmarks), timestamp);
    }

    this.tracks = this.tracks
      .filter((track) => timestamp - track.lastSeen <= LOST_GRACE_MS)
      .sort((a, b) => b.lastSeen - a.lastSeen)
      .slice(0, 2);
    this.updateTwoHands(candidates.length >= 2, timestamp);

    const hands: TrackedHand[] = this.tracks.map((track) => ({
      id: track.id,
      landmarks: track.landmarks,
      handedness: track.handedness,
      confidence: track.confidence,
      timestamp: track.lastSeen,
      gesture: track.gesture,
      lostOpacity: Math.max(0, 1 - (timestamp - track.lastSeen) / LOST_GRACE_MS),
    }));

    return { hands, twoHandsPresent: this.twoHands, timestamp };
  }

  reset() {
    this.tracks = [];
    this.twoHands = false;
    this.twoHandsCandidate = false;
    this.twoHandsCandidateSince = 0;
  }

  private updateTwoHands(next: boolean, timestamp: number) {
    if (next === this.twoHands) {
      this.twoHandsCandidate = next;
      this.twoHandsCandidateSince = timestamp;
      return;
    }
    if (next !== this.twoHandsCandidate) {
      this.twoHandsCandidate = next;
      this.twoHandsCandidateSince = timestamp;
      return;
    }
    const holdTime = next ? 110 : 180;
    if (timestamp - this.twoHandsCandidateSince >= holdTime) this.twoHands = next;
  }
}
