import { gestureThresholds } from './interactionController';

export interface DwellResult {
  active: boolean;
  progress: number;
  activated: boolean;
}

export class DwellSelectionController {
  private target: unknown;
  private since = 0;
  private triggered = false;
  private cooldownUntil = 0;

  update(target: unknown, now: number, enabled: boolean): DwellResult {
    if (!enabled || !target) {
      this.leave();
      return { active: false, progress: 0, activated: false };
    }
    if (target !== this.target) {
      this.target = target;
      this.since = now;
      this.triggered = false;
      return { active: true, progress: 0, activated: false };
    }
    if (this.triggered) return { active: true, progress: 1, activated: false };
    const progress = Math.min(1, (now - this.since) / gestureThresholds.dwellMs);
    if (progress < 1 || now < this.cooldownUntil) return { active: true, progress, activated: false };
    this.triggered = true;
    this.cooldownUntil = now + gestureThresholds.dwellCooldownMs;
    return { active: true, progress: 1, activated: true };
  }

  reset() {
    this.target = undefined;
    this.since = 0;
    this.triggered = false;
    this.cooldownUntil = 0;
  }

  private leave() {
    this.target = undefined;
    this.since = 0;
    this.triggered = false;
  }
}
