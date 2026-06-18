export async function handleDeepLink(ctx) {
  const {
    rawUrl,
    isTauriRuntime,
    state,
    parseDeepLinkUrl,
    closeModal,
    modal,
    modalError,
    closeSettingsModal,
    buildTaskFromDeepLink,
    deepLinkTaskContext,
    saveTasks,
    getCleanTasks,
    renderTaskView,
    showToast,
  } = ctx;

  const parsed = parseDeepLinkUrl(rawUrl);
  if (!parsed || parsed.action !== 'add') return;

  closeModal(modal, modalError);
  closeSettingsModal();

  const task = buildTaskFromDeepLink(parsed.params, deepLinkTaskContext);

  if (isTauriRuntime) {
    try {
      const confirmed = globalThis.confirm(`即将创建任务「${task.label || task.msg || '新任务'}」\n类型：${
        { alarm: '定时', countdown: '倒计时', holiday: '节假日', anniversary: '纪念日' }[task.type] || task.type
      }`);
      if (!confirmed) return;
    } catch {
      return;
    }
  }

  state.tasks.push(task);
  saveTasks(getCleanTasks(state.tasks));
  renderTaskView();
  showToast(`已通过链接创建任务：${task.label || task.msg || '新任务'}`);
}
