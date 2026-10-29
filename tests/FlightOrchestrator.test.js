import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { storeMock } = vi.hoisted(() => ({ storeMock: new Map() }));

vi.mock('../src/storage.js', () => ({
  get: vi.fn(async (key) => storeMock.get(key)),
  set: vi.fn(async (key, value) => {
    storeMock.set(key, value);
  }),
}));

vi.mock('../src/ui/AudioManager.js', () => ({
  getAudioContext: vi.fn(async () => ({})),
  unlockAudioIfNeeded: vi.fn(async () => {}),
}));

vi.mock('../src/ui/AudioSystem.js', () => ({
  setMuted: vi.fn(),
  setCustomAudioObjectUrl: vi.fn(),
  revokeCustomAudioObjectUrl: vi.fn(),
}));

vi.mock('@tauri-apps/api/webviewWindow', () => ({ WebviewWindow: class {} }));
vi.mock('@tauri-apps/api/window', () => ({
  availableMonitors: vi.fn(async () => []),
  currentMonitor: vi.fn(async () => null),
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => vi.fn()),
  emit: vi.fn(async () => {}),
}));
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => null) }));

import {
  triggerFlightWithMode,
  resumeFlightSequences,
  clearAllSequences,
  setUpdateTaskFlightCb,
  initFlightOrchestrator,
} from '../src/flight/FlightOrchestrator.js';

describe('FlightOrchestrator sequence persistence (issue #2)', () => {
  beforeEach(() => {
    clearAllSequences();
    storeMock.clear();
    initFlightOrchestrator({});
    setUpdateTaskFlightCb(vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('persists a loop_times sequence when triggered', async () => {
    const task = { id: 7, enabled: true, flightMode: 'loop_times', loopCount: 3, msg: 'go' };
    await triggerFlightWithMode(task, null, null, null, null);

    const snapshot = storeMock.get('_flightSequences');
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0]).toMatchObject({ taskId: 7, mode: 'loop_times', remaining: 3 });
  });

  it('persists a loop_interval sequence with interval metadata', async () => {
    const task = { id: 8, enabled: true, flightMode: 'loop_interval', intervalCount: 4, loopInterval: 5, msg: 'go' };
    await triggerFlightWithMode(task, null, null, null, null);

    const snapshot = storeMock.get('_flightSequences');
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0]).toMatchObject({
      taskId: 8,
      mode: 'loop_interval',
      remaining: 4,
      intervalMs: 300000,
    });
    expect(typeof snapshot[0].lastStart).toBe('number');
  });

  it('clearAllSequences persists an empty snapshot', async () => {
    const task = { id: 7, enabled: true, flightMode: 'loop_times', loopCount: 2, msg: 'go' };
    await triggerFlightWithMode(task, null, null, null, null);
    clearAllSequences();

    expect(storeMock.get('_flightSequences')).toEqual([]);
  });

  it('resumes a loop_times sequence after restart', async () => {
    storeMock.set('_flightSequences', [{ taskId: 9, mode: 'loop_times', remaining: 2 }]);
    const tasks = [{ id: 9, enabled: true, flightMode: 'loop_times', loopCount: 5, msg: 'resume' }];
    const updateCb = vi.fn();
    setUpdateTaskFlightCb(updateCb);

    const resumed = await resumeFlightSequences(() => tasks);

    expect(resumed).toBe(1);
    expect(tasks[0]._flightRemaining).toBe(2);
    expect(updateCb).toHaveBeenCalledWith(9, 2);
    const snapshot = storeMock.get('_flightSequences');
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0]).toMatchObject({ taskId: 9, mode: 'loop_times', remaining: 2 });
  });

  it('resumes a loop_interval sequence whose interval already elapsed', async () => {
    vi.useFakeTimers();
    storeMock.set('_flightSequences', [{
      taskId: 10, mode: 'loop_interval', remaining: 3, intervalMs: 300000,
      lastStart: Date.now() - 600000,
    }]);
    const tasks = [{ id: 10, enabled: true, flightMode: 'loop_interval', loopInterval: 5, msg: 'resume' }];
    const updateCb = vi.fn();
    setUpdateTaskFlightCb(updateCb);

    const resumed = await resumeFlightSequences(() => tasks);
    await vi.advanceTimersByTimeAsync(1);

    expect(resumed).toBe(1);
    expect(tasks[0]._flightRemaining).toBe(3);
    expect(updateCb).toHaveBeenCalledWith(10, 3);
    expect(storeMock.get('_flightSequences')).toHaveLength(1);
  });

  it('skips sequences whose task was deleted while the app was closed', async () => {
    storeMock.set('_flightSequences', [{ taskId: 11, mode: 'loop_times', remaining: 2 }]);
    const resumed = await resumeFlightSequences(() => [{ id: 12, enabled: true }]);

    expect(resumed).toBe(0);
    expect(storeMock.get('_flightSequences')).toEqual([]);
  });

  it('skips sequences whose task is disabled', async () => {
    storeMock.set('_flightSequences', [{ taskId: 13, mode: 'loop_interval', remaining: 2, intervalMs: 300000, lastStart: 1 }]);
    const resumed = await resumeFlightSequences(() => [{ id: 13, enabled: false }]);

    expect(resumed).toBe(0);
    expect(storeMock.get('_flightSequences')).toEqual([]);
  });
});
