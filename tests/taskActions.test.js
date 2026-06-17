import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTaskActions } from '../src/app/taskActions.js';

describe('createTaskActions', () => {
  let originalConfirm;

  beforeEach(() => {
    originalConfirm = globalThis.window?.confirm;
    globalThis.window = { confirm: vi.fn(() => true) };
  });

  afterEach(() => {
    if (originalConfirm) globalThis.window.confirm = originalConfirm;
  });

  it('deletes task only after confirmation', () => {
    const state = { tasks: [{ id: 1, label: 'A' }], expandedTaskId: null, editingId: null, editImageData: '', getTaskFilterState: null };
    const deleteTask = vi.fn((task, tasks) => tasks.splice(tasks.findIndex(t => t.id === task.id), 1));
    const renderTasks = vi.fn();

    const actions = createTaskActions({
      state,
      dom: { modal: {}, modalError: {}, taskListEl: {} },
      holidayPresets: {},
      renderTasks,
      setStatsTasks: vi.fn(),
      setHistoryTasks: vi.fn(),
      toggleTaskExpandedCard: vi.fn(),
      openEditModal: vi.fn(),
      closeModal: vi.fn(),
      saveModal: vi.fn(),
      deleteTask,
      getSelectedEditColor: vi.fn(),
      selectColor: vi.fn(),
      saveTasks: vi.fn(),
      getCleanTasks: (tasks) => tasks,
      startCountdown: vi.fn(),
      pauseCountdown: vi.fn(),
      stopCountdown: vi.fn(),
      doTriggerFlight: vi.fn(),
      updateHeroStatus: vi.fn(),
    });

    actions.deleteTaskFn(state.tasks[0]);

    expect(globalThis.window.confirm).toHaveBeenCalled();
    expect(deleteTask).toHaveBeenCalled();
    expect(state.tasks).toHaveLength(0);
  });

  it('does not delete task when confirmation is cancelled', () => {
    globalThis.window.confirm = vi.fn(() => false);
    const state = { tasks: [{ id: 1, label: 'A' }], expandedTaskId: null, editingId: null, editImageData: '', getTaskFilterState: null };
    const deleteTask = vi.fn();

    const actions = createTaskActions({
      state,
      dom: { modal: {}, modalError: {}, taskListEl: {} },
      holidayPresets: {},
      renderTasks: vi.fn(),
      setStatsTasks: vi.fn(),
      setHistoryTasks: vi.fn(),
      toggleTaskExpandedCard: vi.fn(),
      openEditModal: vi.fn(),
      closeModal: vi.fn(),
      saveModal: vi.fn(),
      deleteTask,
      getSelectedEditColor: vi.fn(),
      selectColor: vi.fn(),
      saveTasks: vi.fn(),
      getCleanTasks: (tasks) => tasks,
      startCountdown: vi.fn(),
      pauseCountdown: vi.fn(),
      stopCountdown: vi.fn(),
      doTriggerFlight: vi.fn(),
      updateHeroStatus: vi.fn(),
    });

    actions.deleteTaskFn(state.tasks[0]);

    expect(deleteTask).not.toHaveBeenCalled();
    expect(state.tasks).toHaveLength(1);
  });
});
