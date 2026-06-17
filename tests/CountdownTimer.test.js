import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  initCountdownTimer,
  startCountdown,
  pauseCountdown,
  stopCountdown,
  onCountdownComplete,
  stopAllCountdowns,
} from '../src/tasks/CountdownTimer.js';

class MockAccurateTimer {
  constructor(duration, onTick, onDone) {
    this.duration = duration;
    this.onTick = onTick;
    this.onDone = onDone;
    this.remaining = duration;
    this.start = vi.fn();
    this.pause = vi.fn();
    this.resume = vi.fn();
    this.stop = vi.fn();
  }
}

describe('CountdownTimer', () => {
  let renderTaskView;
  let saveTasks;
  let updateCountdownTaskUI;
  let doTriggerFlight;
  let tasks;

  beforeEach(() => {
    renderTaskView = vi.fn();
    saveTasks = vi.fn();
    updateCountdownTaskUI = vi.fn();
    doTriggerFlight = vi.fn();
    tasks = [];

    initCountdownTimer({
      AccurateTimer: MockAccurateTimer,
      renderTaskView,
      saveTasks,
      getCleanTasks: (value) => value,
      getTasks: () => tasks,
      updateCountdownTaskUI,
      taskListEl: {},
      holidayPresets: {},
      doTriggerFlight,
    });
  });

  it('starts a countdown and enables task when needed', () => {
    const task = { type: 'countdown', enabled: false, duration: 120, _remaining: 120, _status: 'idle', _timer: null };
    tasks.push(task);

    startCountdown(task);

    expect(task.enabled).toBe(true);
    expect(task._status).toBe('running');
    expect(task._timer).toBeInstanceOf(MockAccurateTimer);
    expect(task._timer.start).toHaveBeenCalled();
    expect(saveTasks).toHaveBeenCalledWith(tasks);
    expect(renderTaskView).toHaveBeenCalled();
  });

  it('pauses and resumes an existing countdown', () => {
    const task = {
      type: 'countdown',
      enabled: true,
      duration: 120,
      _remaining: 80,
      _status: 'running',
      _timer: new MockAccurateTimer(120000, vi.fn(), vi.fn()),
    };
    task._timer.remaining = 79000;

    pauseCountdown(task);
    expect(task._status).toBe('paused');
    expect(task._remaining).toBe(79);
    expect(task._timer.pause).toHaveBeenCalled();

    task._timer.resume = vi.fn();
    startCountdown(task);
    expect(task._status).toBe('running');
    expect(task._timer.resume).toHaveBeenCalled();
  });

  it('stops a countdown and resets remaining time', () => {
    const task = {
      type: 'countdown',
      enabled: true,
      duration: 300,
      _remaining: 99,
      _status: 'running',
      _timer: new MockAccurateTimer(300000, vi.fn(), vi.fn()),
    };

    stopCountdown(task);

    expect(task._status).toBe('idle');
    expect(task._remaining).toBe(300);
    expect(task._timer).toBeNull();
    expect(renderTaskView).toHaveBeenCalled();
  });

  it('completes a countdown, triggers flight, then resets', async () => {
    const task = { type: 'countdown', enabled: true, duration: 90, _remaining: 1, _status: 'running', _timer: null };

    await onCountdownComplete(task);

    expect(doTriggerFlight).toHaveBeenCalledWith(task);
    expect(task._status).toBe('idle');
    expect(task._remaining).toBe(90);
    expect(renderTaskView).toHaveBeenCalledTimes(2);
  });

  it('stops all running or paused countdowns only', () => {
    const running = { type: 'countdown', duration: 100, _remaining: 20, _status: 'running', _timer: new MockAccurateTimer(100000, vi.fn(), vi.fn()) };
    const paused = { type: 'countdown', duration: 200, _remaining: 50, _status: 'paused', _timer: new MockAccurateTimer(200000, vi.fn(), vi.fn()) };
    const idle = { type: 'countdown', duration: 300, _remaining: 300, _status: 'idle', _timer: null };
    const alarm = { type: 'alarm', _status: 'running' };

    stopAllCountdowns([running, paused, idle, alarm]);

    expect(running._status).toBe('idle');
    expect(paused._status).toBe('idle');
    expect(idle._status).toBe('idle');
    expect(idle._remaining).toBe(300);
  });
});
