import { describe, it, expect, vi } from 'vitest';
import { AccurateTimer } from '../src/timer.js';

describe('AccurateTimer', () => {
  it('creates timer with correct duration', () => {
    const timer = new AccurateTimer(1000, () => {}, () => {});
    expect(timer.durationMs).toBe(1000);
    expect(timer.running).toBe(false);
  });

  it('start sets running state', () => {
    const timer = new AccurateTimer(1000, () => {}, () => {});
    timer.start();
    expect(timer.running).toBe(true);
    expect(timer.paused).toBe(false);
    timer.stop();
  });

  it('pause stops ticking', () => {
    const onTick = vi.fn();
    const timer = new AccurateTimer(5000, onTick, () => {});
    timer.start();
    timer.pause();
    expect(timer.paused).toBe(true);
    expect(timer.running).toBe(true);
    timer.stop();
  });

  it('resume continues from paused', () => {
    const timer = new AccurateTimer(5000, () => {}, () => {});
    timer.start();
    timer.pause();
    const pausedRemaining = timer.remaining;
    timer.resume();
    expect(timer.paused).toBe(false);
    expect(timer.running).toBe(true);
    timer.stop();
  });

  it('stop resets remaining', () => {
    const timer = new AccurateTimer(5000, () => {}, () => {});
    timer.start();
    timer.stop();
    expect(timer.running).toBe(false);
    expect(timer.remaining).toBe(5000);
  });

  it('reset changes duration', () => {
    const timer = new AccurateTimer(5000, () => {}, () => {});
    timer.reset(10000);
    expect(timer.durationMs).toBe(10000);
    expect(timer.remaining).toBe(10000);
    expect(timer.running).toBe(false);
  });
});
