export class AdaptiveEmissionBudget {
  private factor = 1;
  private gestureFactor = 1;
  private sustainedPressureFrames = 0;

  update(frameTimeMs: number) {
    const target = frameTimeMs <= 18
      ? 1
      : frameTimeMs >= 34
        ? 0.45
        : 1 - (frameTimeMs - 18) / 16 * 0.55;
    const rate = target < this.factor ? 0.08 : 0.025;
    this.factor += (target - this.factor) * rate;
    this.sustainedPressureFrames = frameTimeMs >= 28
      ? this.sustainedPressureFrames + 1
      : Math.max(0, this.sustainedPressureFrames - 2);
    const gestureTarget = this.sustainedPressureFrames >= 8 ? Math.max(0.55, target) : 1;
    const gestureRate = gestureTarget < this.gestureFactor ? 0.055 : 0.035;
    this.gestureFactor += (gestureTarget - this.gestureFactor) * gestureRate;
    return this.factor;
  }

  read(source: 'gesture' | 'pointer' = 'pointer') {
    return source === 'gesture' ? this.gestureFactor : this.factor;
  }

  count(total: number, source: 'gesture' | 'pointer' = 'pointer') {
    return Math.max(0, Math.min(total, Math.ceil(total * this.read(source))));
  }
}
