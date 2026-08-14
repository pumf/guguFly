import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('PomodoroTimer', () => {
  let mockAccurateTimer;
  let mockRenderTaskView;
  let mockShowToast;
  let mockDoTriggerFlight;
  let originalDocument;
  let pomodoroModule;

  beforeEach(async () => {
    originalDocument = globalThis.document;
    globalThis.document = {
      querySelectorAll: vi.fn(() => []),
    };
    
    vi.resetModules();
    const { initI18n } = await import('../src/i18n/index.js');
    initI18n({ initialLang: 'zh-CN' });
    
    pomodoroModule = await import('../src/tasks/PomodoroTimer.js');

    mockAccurateTimer = vi.fn().mockImplementation((duration, onTick, onComplete) => ({
      start: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
      remaining: duration,
    }));

    mockRenderTaskView = vi.fn();
    mockShowToast = vi.fn();
    mockDoTriggerFlight = vi.fn();

    pomodoroModule.initPomodoroTimer({
      AccurateTimer: mockAccurateTimer,
      renderTaskView: mockRenderTaskView,
      saveTasks: vi.fn(),
      getCleanTasks: vi.fn(),
      getTasks: vi.fn(),
      doTriggerFlight: mockDoTriggerFlight,
      showToast: mockShowToast,
      updateMiniWindow: vi.fn(),
    });
  });

  afterEach(() => {
    globalThis.document = originalDocument;
    vi.restoreAllMocks();
  });

  describe('startPomodoro', () => {
    it('starts pomodoro with default 25 minutes', () => {
      pomodoroModule.startPomodoro();
      const state = pomodoroModule.getPomodoroState();
      expect(state.active).toBe(true);
      expect(state.phase).toBe('work');
      expect(state.round).toBe(1);
      expect(state.remaining).toBe(25 * 60);
      expect(mockRenderTaskView).toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalled();
    });

    it('starts pomodoro with custom minutes', () => {
      pomodoroModule.startPomodoro(30);
      const state = pomodoroModule.getPomodoroState();
      expect(state.remaining).toBe(30 * 60);
    });

    it('does not start if already active', () => {
      pomodoroModule.startPomodoro();
      pomodoroModule.startPomodoro(); // Should not restart
      const state = pomodoroModule.getPomodoroState();
      expect(state.round).toBe(1); // Should still be 1
    });

    it('creates pomodoro task', () => {
      pomodoroModule.startPomodoro();
      const task = pomodoroModule.getPomodoroTask();
      expect(task).not.toBeNull();
      expect(task.type).toBe('countdown');
      expect(task._status).toBe('running');
    });
  });

  describe('pausePomodoro', () => {
    it('pauses active pomodoro', () => {
      pomodoroModule.startPomodoro();
      pomodoroModule.pausePomodoro();
      const state = pomodoroModule.getPomodoroState();
      expect(state.task._status).toBe('paused');
    });

    it('does nothing if not active', () => {
      pomodoroModule.pausePomodoro(); // Should not throw
      expect(pomodoroModule.getPomodoroState().active).toBe(false);
    });
  });

  describe('resumePomodoro', () => {
    it('resumes paused pomodoro', () => {
      pomodoroModule.startPomodoro();
      pomodoroModule.pausePomodoro();
      pomodoroModule.resumePomodoro();
      const state = pomodoroModule.getPomodoroState();
      expect(state.task._status).toBe('running');
    });

    it('does nothing if not active', () => {
      pomodoroModule.resumePomodoro(); // Should not throw
      expect(pomodoroModule.getPomodoroState().active).toBe(false);
    });
  });

  describe('stopPomodoro', () => {
    it('stops active pomodoro', () => {
      pomodoroModule.startPomodoro();
      pomodoroModule.stopPomodoro();
      const state = pomodoroModule.getPomodoroState();
      expect(state.active).toBe(false);
      expect(state.phase).toBe('work');
      expect(state.round).toBe(1);
      expect(state.task).toBeNull();
      expect(mockShowToast).toHaveBeenCalled();
    });

    it('does nothing if not active', () => {
      pomodoroModule.stopPomodoro(); // Should not throw
      expect(pomodoroModule.getPomodoroState().active).toBe(false);
    });
  });

  describe('skipPomodoroPhase', () => {
    it('skips to next phase', () => {
      pomodoroModule.startPomodoro();
      pomodoroModule.skipPomodoroPhase();
      const state = pomodoroModule.getPomodoroState();
      expect(state.phase).toBe('shortBreak');
      expect(state.remaining).toBe(pomodoroModule.POMODORO_CONFIG.shortBreak);
    });

    it('does nothing if not active', () => {
      pomodoroModule.skipPomodoroPhase(); // Should not throw
      expect(pomodoroModule.getPomodoroState().active).toBe(false);
    });
  });

  describe('getPomodoroState', () => {
    it('returns a copy of state', () => {
      const state1 = pomodoroModule.getPomodoroState();
      const state2 = pomodoroModule.getPomodoroState();
      expect(state1).not.toBe(state2);
      expect(state1).toEqual(state2);
    });

    it('returns initial state before starting', () => {
      const state = pomodoroModule.getPomodoroState();
      expect(state.active).toBe(false);
      expect(state.phase).toBe('work');
      expect(state.round).toBe(1);
      expect(state.remaining).toBe(pomodoroModule.POMODORO_CONFIG.work);
    });
  });

  describe('isPomodoroActive', () => {
    it('returns false initially', () => {
      expect(pomodoroModule.isPomodoroActive()).toBe(false);
    });

    it('returns true when active', () => {
      pomodoroModule.startPomodoro();
      expect(pomodoroModule.isPomodoroActive()).toBe(true);
    });

    it('returns false after stopping', () => {
      pomodoroModule.startPomodoro();
      pomodoroModule.stopPomodoro();
      expect(pomodoroModule.isPomodoroActive()).toBe(false);
    });
  });

  describe('getPomodoroTask', () => {
    it('returns null initially', () => {
      expect(pomodoroModule.getPomodoroTask()).toBeNull();
    });

    it('returns task when active', () => {
      pomodoroModule.startPomodoro();
      const task = pomodoroModule.getPomodoroTask();
      expect(task).not.toBeNull();
      expect(task.id).toBeDefined();
    });
  });

  describe('POMODORO_CONFIG', () => {
    it('has correct default values', () => {
      expect(pomodoroModule.POMODORO_CONFIG.work).toBe(25 * 60);
      expect(pomodoroModule.POMODORO_CONFIG.shortBreak).toBe(5 * 60);
      expect(pomodoroModule.POMODORO_CONFIG.longBreak).toBe(15 * 60);
      expect(pomodoroModule.POMODORO_CONFIG.roundsBeforeLong).toBe(4);
    });
  });
});