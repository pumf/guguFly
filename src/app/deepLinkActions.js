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
    confirmDialog,
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
      const confirmed = await confirmDialog(`即将创建任务「${task.label || task.msg || '新任务'}」\n类型：${
        { alarm: '定时', countdown: '倒计时', holiday: '节假日', anniversary: '纪念日' }[task.type] || task.type
      }`, { title: '确认创建', kind: 'info' });
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
