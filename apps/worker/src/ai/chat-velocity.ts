export class SlidingWindowVelocity {
  private timestamps: number[] = [];

  constructor(
    private readonly windowSizeSeconds = 30,
    private readonly maxExpectedMessages = 50,
  ) {}

  registerMessageEvent(timestampMs = Date.now()): void {
    this.timestamps.push(timestampMs);
    this.cleanWindow(timestampMs);
  }

  getVelocityScore(currentTimeMs = Date.now()): number {
    this.cleanWindow(currentTimeMs);
    return Math.max(0, Math.min(100, (this.timestamps.length / this.maxExpectedMessages) * 100));
  }

  private cleanWindow(currentTimeMs: number): void {
    const threshold = currentTimeMs - this.windowSizeSeconds * 1000;
    while (this.timestamps.length > 0 && this.timestamps[0] < threshold) {
      this.timestamps.shift();
    }
  }
}
