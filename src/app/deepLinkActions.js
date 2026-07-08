import { t } from '../i18n/index.js';

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
      const typeName = { alarm: t('task.type.alarm'), countdown: t('task.type.countdown'), holiday: t('task.type.holiday'), anniversary: t('task.type.anniversary') }[task.type] || task.type;
      const confirmed = await window.showConfirm(t('deeplink.confirm', { name: task.label || task.msg || t('common.new_task'), type: typeName }));
      if (!confirmed) return;
    } catch {
      return;
    }
  }

  state.tasks.push(task);
  saveTasks(getCleanTasks(state.tasks));
  renderTaskView();
  showToast(t('toast.task_created', { name: task.label || task.msg || t('common.new_task') }));
}
