export class AccurateTimer {
  constructor(durationMs, onTick, onComplete) {
    this.durationMs = durationMs;
    this.onTick = onTick;
    this.onComplete = onComplete;
    this.startTime = null;
    this.pausedAt = null;
    this.remaining = durationMs;
    this.running = false;
    this.paused = false;
    this._timerId = null;
  }

  start() {
    if (this.running) return;
    this.startTime = Date.now();
    this.remaining = this.durationMs;
    this.running = true;
    this.paused = false;
    this._tick();
  }

  pause() {
    if (!this.running || this.paused) return;
    this.paused = true;
    this.pausedAt = Date.now();
    if (this._timerId) { clearTimeout(this._timerId); this._timerId = null; }
    this.remaining = Math.max(0, this.durationMs - (this.pausedAt - this.startTime));
  }

  resume() {
    if (!this.paused) return;
    const pauseDuration = Date.now() - this.pausedAt;
    this.startTime += pauseDuration;
    this.paused = false;
    this._tick();
  }

  stop() {
    this.running = false;
    this.paused = false;
    if (this._timerId) { clearTimeout(this._timerId); this._timerId = null; }
    this.remaining = this.durationMs;
  }

  reset(durationMs) {
    this.stop();
    this.durationMs = durationMs;
    this.remaining = durationMs;
  }

  _tick() {
    if (!this.running || this.paused) return;
    const elapsed = Date.now() - this.startTime;
    this.remaining = Math.max(0, this.durationMs - elapsed);

    if (this.onTick) this.onTick(this.remaining);

    if (this.remaining <= 0) {
      this.running = false;
      if (this.onComplete) this.onComplete();
    } else {
      this._timerId = setTimeout(() => this._tick(), 200);
    }
  }
}
