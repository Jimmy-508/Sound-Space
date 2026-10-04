export class AdaptiveEmissionBudget {
  private factor = 1;

  update(frameTimeMs: number) {
    const target = frameTimeMs <= 18
      ? 1
      : frameTimeMs >= 34
        ? 0.45
        : 1 - (frameTimeMs - 18) / 16 * 0.55;
    const rate = target < this.factor ? 0.08 : 0.025;
    this.factor += (target - this.factor) * rate;
    return this.factor;
  }

  read() {
    return this.factor;
  }

  count(total: number) {
    return Math.max(0, Math.min(total, Math.ceil(total * this.factor)));
  }
}
