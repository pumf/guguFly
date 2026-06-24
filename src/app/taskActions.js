export function createTaskActions(ctx) {
  const {
    state,
    dom,
    holidayPresets,
    renderTasks,
    setStatsTasks,
    setHistoryTasks,
    toggleTaskExpandedCard,
    openEditModal,
    closeModal,
    saveModal,
    deleteTask,
    getSelectedEditColor,
    selectColor,
    saveTasks,
    getCleanTasks,
    startCountdown,
    pauseCountdown,
    stopCountdown,
    doTriggerFlight,
    updateHeroStatus,
  } = ctx;

  function renderTaskView() {
    const filters = state.getTaskFilterState ? state.getTaskFilterState() : {};
    renderTasks({
      tasks: state.tasks,
      taskListEl: dom.taskListEl,
      holidayPresets,
      expandedTaskId: state.expandedTaskId,
      toggleTaskExpandedFn,
      openEditModalFn,
      deleteTaskFn,
      saveTasks,
      getCleanTasksFn: (tasks) => getCleanTasks(tasks),
      startCountdownFn: startCountdown,
      pauseCountdownFn: pauseCountdown,
      stopCountdownFn: stopCountdown,
      triggerFlightWithModeFn: doTriggerFlight,
      updateHeroStatusFn: updateHeroStatus,
      renderTasksFn: renderTaskView,
      filterType: filters.taskTypeFilter || 'all',
      filterGroup: filters.taskGroupFilter || 'all',
      filterKeyword: filters.taskSearchKeyword || '',
    });
    setStatsTasks(state.tasks);
    setHistoryTasks(state.tasks);
  }

  function toggleTaskExpandedFn(taskId) {
    const prevId = state.expandedTaskId;
    state.expandedTaskId = state.expandedTaskId === taskId ? null : taskId;
    toggleTaskExpandedCard(prevId, state.expandedTaskId, {
      taskListEl: dom.taskListEl,
      holidayPresets,
      openEditModalFn,
      tasks: state.tasks,
    });
  }

  function openEditModalFn(task) {
    state.editingId = task.id;
    openEditModal(task, state.editingId, selectColor, {
      modal: dom.modal,
      modalTitle: dom.modalTitle,
      modalError: dom.modalError,
      editLabel: dom.editLabel,
      editMsg: dom.editMsg,
      editGroup: dom.editGroup,
      editFlightMode: dom.editFlightMode,
      editLoopCount: dom.editLoopCount,
      editLoopInterval: dom.editLoopInterval,
      editIntervalCount: dom.editIntervalCount,
      loopTimesField: dom.loopTimesField,
      loopIntervalField: dom.loopIntervalField,
      editPostFlightAction: dom.editPostFlightAction,
      editPostFlightAppPath: dom.editPostFlightAppPath,
      editPostFlightUrl: dom.editPostFlightUrl,
      editPostFlightFolder: dom.editPostFlightFolder,
      editPostFlightScript: dom.editPostFlightScript,
      postFlightAppField: dom.postFlightAppField,
      postFlightUrlField: dom.postFlightUrlField,
      postFlightFolderField: dom.postFlightFolderField,
      postFlightScriptField: dom.postFlightScriptField,
      editPostFlightVideoEnable: dom.editPostFlightVideoEnable,
      editPostFlightVideoSelect: dom.editPostFlightVideoSelect,
      editPostFlightVideoPath: dom.editPostFlightVideoPath,
      editPostFlightVideoDurationMin: dom.editPostFlightVideoDurationMin,
      editPostFlightVideoDurationSec: dom.editPostFlightVideoDurationSec,
      postFlightVideoEnableField: dom.postFlightVideoEnableField,
      postFlightVideoSelectField: dom.postFlightVideoSelectField,
      postFlightVideoCustomField: dom.postFlightVideoCustomField,
      postFlightVideoDurationField: dom.postFlightVideoDurationField,
      editPostFlightVideoSpeed: dom.editPostFlightVideoSpeed,
      postFlightVideoSpeedField: dom.postFlightVideoSpeedField,
      editPostFlightVideoScale: dom.editPostFlightVideoScale,
      postFlightVideoScaleField: dom.postFlightVideoScaleField,
      editPostFlightEffectType: dom.editPostFlightEffectType,
      postFlightEffectField: dom.postFlightEffectField,
      editPostFlightEffectDuration: dom.editPostFlightEffectDuration,
      postFlightEffectDurationField: dom.postFlightEffectDurationField,
      alarmFields: dom.alarmFields,
      countdownFields: dom.countdownFields,
      holidayFields: dom.holidayFields,
      anniversaryFields: dom.anniversaryFields,
      editHour: dom.editHour,
      editMinute: dom.editMinute,
      editMinutes: dom.editMinutes,
      editSeconds: dom.editSeconds,
      editHolidayHour: dom.editHolidayHour,
      editHolidayMinute: dom.editHolidayMinute,
      holidayChecklist: dom.holidayChecklist,
      HOLIDAY_PRESETS: holidayPresets,
      editAnniMonth: dom.editAnniMonth,
      editAnniDay: dom.editAnniDay,
      editAnniHour: dom.editAnniHour,
      editAnniMinute: dom.editAnniMinute,
      editAnniLunar: dom.editAnniLunar,
      editImagePreview: dom.editImagePreview,
      editClearImageBtn: dom.editClearImageBtn,
      editUseImageCheckbox: dom.editUseImageCheckbox,
      editImageInput: dom.editImageInput,
      deleteTaskBtn: dom.deleteTaskBtn,
      editImageData: state.editImageData,
      editingId: state.editingId,
      selectedEditColor: getSelectedEditColor(),
    });
  }

  function deleteTaskFn(task) {
    window.showConfirm(`确认删除任务「${task.label || task.msg || '未命名任务'}」吗？`).then(confirmed => {
      if (!confirmed) return;
      deleteTask(task, state.tasks, () => closeModal(dom.modal, dom.modalError), saveTasks, (tasks) => getCleanTasks(tasks), renderTaskView, stopCountdown);
    }).catch(e => console.error('delete confirm failed:', e));
  }

  function saveModalHandler() {
    saveModal(state.editingId, {
      modal: dom.modal,
      modalError: dom.modalError,
      tasks: state.tasks,
      saveTasks,
      getCleanTasksFn: (tasks) => getCleanTasks(tasks),
      renderTasksFn: renderTaskView,
      editLabel: dom.editLabel,
      editMsg: dom.editMsg,
      editGroup: dom.editGroup,
      editingId: state.editingId,
      editFlightMode: dom.editFlightMode,
      editLoopCount: dom.editLoopCount,
      editLoopInterval: dom.editLoopInterval,
      editIntervalCount: dom.editIntervalCount,
      editPostFlightAction: dom.editPostFlightAction,
      editPostFlightAppPath: dom.editPostFlightAppPath,
      editPostFlightUrl: dom.editPostFlightUrl,
      editPostFlightFolder: dom.editPostFlightFolder,
      editPostFlightScript: dom.editPostFlightScript,
      editPostFlightVideoEnable: dom.editPostFlightVideoEnable,
      editPostFlightVideoSelect: dom.editPostFlightVideoSelect,
      editPostFlightVideoPath: dom.editPostFlightVideoPath,
      editPostFlightVideoDurationMin: dom.editPostFlightVideoDurationMin,
      editPostFlightVideoDurationSec: dom.editPostFlightVideoDurationSec,
      editPostFlightVideoSpeed: dom.editPostFlightVideoSpeed,
      editPostFlightVideoScale: dom.editPostFlightVideoScale,
      editPostFlightEffectType: dom.editPostFlightEffectType,
      editPostFlightEffectDuration: dom.editPostFlightEffectDuration,
      editHour: dom.editHour,
      editMinute: dom.editMinute,
      editMinutes: dom.editMinutes,
      editSeconds: dom.editSeconds,
      editHolidayHour: dom.editHolidayHour,
      editHolidayMinute: dom.editHolidayMinute,
      holidayChecklist: dom.holidayChecklist,
      HOLIDAY_PRESETS: holidayPresets,
      editAnniMonth: dom.editAnniMonth,
      editAnniDay: dom.editAnniDay,
      editAnniHour: dom.editAnniHour,
      editAnniMinute: dom.editAnniMinute,
      editAnniLunar: dom.editAnniLunar,
      editImagePreview: dom.editImagePreview,
      editUseImageCheckbox: dom.editUseImageCheckbox,
      selectedEditColor: getSelectedEditColor(),
      editImageData: state.editImageData,
      stopCountdownFn: stopCountdown,
    });
    state.editingId = null;
  }

  return {
    renderTaskView,
    toggleTaskExpandedFn,
    openEditModalFn,
    deleteTaskFn,
    saveModalHandler,
  };
}
