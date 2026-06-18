import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleDeepLink } from '../src/app/deepLinkActions.js';

describe('handleDeepLink', () => {
  let state;
  let closeModal;
  let closeSettingsModal;
  let buildTaskFromDeepLink;
  let saveTasks;
  let renderTaskView;
  let showToast;

  beforeEach(() => {
    state = { tasks: [] };
    closeModal = vi.fn();
    closeSettingsModal = vi.fn();
    buildTaskFromDeepLink = vi.fn(() => ({ id: 1, type: 'alarm', label: '测试任务' }));
    saveTasks = vi.fn();
    renderTaskView = vi.fn();
    showToast = vi.fn();
  });

  it('creates task for add deep link', async () => {
    await handleDeepLink({
      rawUrl: 'gugufly://add?msg=test',
      isTauriRuntime: false,
      state,
      parseDeepLinkUrl: () => ({ action: 'add', params: { msg: 'test' } }),
      closeModal,
      modal: {},
      modalError: {},
      closeSettingsModal,
      buildTaskFromDeepLink,
      deepLinkTaskContext: {},
      saveTasks,
      getCleanTasks: (tasks) => tasks,
      renderTaskView,
      showToast,
    });

    expect(closeModal).toHaveBeenCalled();
    expect(closeSettingsModal).toHaveBeenCalled();
    expect(buildTaskFromDeepLink).toHaveBeenCalled();
    expect(state.tasks).toHaveLength(1);
    expect(saveTasks).toHaveBeenCalledWith(state.tasks);
    expect(renderTaskView).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('已通过链接创建任务：测试任务');
  });

  it('stops when tauri confirmation is rejected', async () => {
    const originalConfirm = globalThis.confirm;
    globalThis.confirm = vi.fn().mockReturnValue(false);

    await handleDeepLink({
      rawUrl: 'gugufly://add?msg=test',
      isTauriRuntime: true,
      state,
      parseDeepLinkUrl: () => ({ action: 'add', params: { msg: 'test' } }),
      closeModal,
      modal: {},
      modalError: {},
      closeSettingsModal,
      buildTaskFromDeepLink,
      deepLinkTaskContext: {},
      saveTasks,
      getCleanTasks: (tasks) => tasks,
      renderTaskView,
      showToast,
    });

    expect(globalThis.confirm).toHaveBeenCalled();
    expect(state.tasks).toHaveLength(0);
    expect(saveTasks).not.toHaveBeenCalled();

    globalThis.confirm = originalConfirm;
  });

  it('ignores non-add deep link', async () => {
    await handleDeepLink({
      rawUrl: 'gugufly://noop',
      isTauriRuntime: false,
      state,
      parseDeepLinkUrl: () => ({ action: 'noop', params: {} }),
      closeModal,
      modal: {},
      modalError: {},
      closeSettingsModal,
      buildTaskFromDeepLink,
      deepLinkTaskContext: {},
      saveTasks,
      getCleanTasks: (tasks) => tasks,
      renderTaskView,
      showToast,
    });

    expect(state.tasks).toHaveLength(0);
    expect(buildTaskFromDeepLink).not.toHaveBeenCalled();
  });
});
