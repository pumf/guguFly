import { getSelectedEditColor } from './ColorPicker.js';

export function initModalEvents(ctx) {
  const {
    openNewModal, closeModal, openEditModal, selectColor,
    createCountdownTask, createAlarmTask,
    getCleanTasks, saveTasks, renderTaskView, showToast,
    saveModalHandler, deleteTaskFn, openDialog,
    isTauriRuntime,
    tasksRef, editingIdRef,
  } = ctx;

  const addTaskBtn = document.getElementById('addTaskBtn');
  const templateBtn = document.getElementById('templateBtn');
  const templateMenu = document.getElementById('templateMenu');
  const modalOverlay = document.getElementById('modalOverlay');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const saveTaskBtn = document.getElementById('saveTaskBtn');
  const deleteTaskBtn = document.getElementById('deleteTaskBtn');
  const modal = document.getElementById('taskModal');
  const modalError = document.getElementById('modalError');
  const editFlightMode = document.getElementById('editFlightMode');
  const loopTimesField = document.getElementById('loopTimesField');
  const loopIntervalField = document.getElementById('loopIntervalField');
  const editPostFlightAction = document.getElementById('editPostFlightAction');
  const postFlightAppField = document.getElementById('postFlightAppField');
  const postFlightUrlField = document.getElementById('postFlightUrlField');
  const postFlightFolderField = document.getElementById('postFlightFolderField');
  const postFlightScriptField = document.getElementById('postFlightScriptField');
  const selectAppBtn = document.getElementById('selectAppBtn');
  const selectFolderBtn = document.getElementById('selectFolderBtn');
  const editPostFlightAppPath = document.getElementById('editPostFlightAppPath');
  const editPostFlightFolder = document.getElementById('editPostFlightFolder');

  addTaskBtn?.addEventListener('click', () => {
    const ctx = {
      modal, modalTitle: document.getElementById('modalTitle'),
      modalError, editLabel: document.getElementById('editLabel'),
      editMsg: document.getElementById('editMsg'), editGroup: document.getElementById('editGroup'),
      editFlightMode, editLoopCount: document.getElementById('editLoopCount'),
      editLoopInterval: document.getElementById('editLoopInterval'),
      editIntervalCount: document.getElementById('editIntervalCount'),
      loopTimesField, loopIntervalField,
      editPostFlightAction, editPostFlightAppPath, editPostFlightUrl,
      editPostFlightFolder, editPostFlightScript,
      postFlightAppField, postFlightUrlField, postFlightFolderField, postFlightScriptField,
      alarmFields: document.getElementById('alarmFields'),
      countdownFields: document.getElementById('countdownFields'),
      holidayFields: document.getElementById('holidayFields'),
      anniversaryFields: document.getElementById('anniversaryFields'),
      editHour: document.getElementById('editHour'), editMinute: document.getElementById('editMinute'),
      editMinutes: document.getElementById('editMinutes'), editSeconds: document.getElementById('editSeconds'),
      editHolidayHour: document.getElementById('editHolidayHour'),
      editHolidayMinute: document.getElementById('editHolidayMinute'),
      editAnniMonth: document.getElementById('editAnniMonth'),
      editAnniDay: document.getElementById('editAnniDay'),
      editAnniHour: document.getElementById('editAnniHour'),
      editAnniMinute: document.getElementById('editAnniMinute'),
      editImagePreview: document.getElementById('editImagePreview'),
      editClearImageBtn: document.getElementById('editClearImageBtn'),
      editUseImageCheckbox: document.getElementById('editUseImageCheckbox'),
      editImageInput: document.getElementById('editImageInput'),
      deleteTaskBtn, editingId: editingIdRef.get(),
      selectedEditColor: getSelectedEditColor(),
    };
    editingIdRef.set(null);
    openNewModal(editingIdRef.get(), ctx);
  });

  templateBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    templateMenu?.classList.toggle('hidden');
  });
  document.addEventListener('click', (e) => {
    if (!templateBtn?.contains(e.target) && !templateMenu?.contains(e.target)) templateMenu?.classList.add('hidden');
  });
  templateMenu?.querySelectorAll('.template-item').forEach(item => {
    item.addEventListener('click', () => {
      const tpl = item.dataset.template;
      let task;
      if (tpl === 'pomodoro') { task = createCountdownTask(); task.label = '番茄钟'; task.duration = 1500; task._remaining = 1500; }
      else if (tpl === 'drink') { task = createAlarmTask(); task.label = '喝水提醒'; task.hour = Math.floor(Math.random() * 14) + 8; task.minute = 0; task.repeat = [1,2,3,4,5,6,0]; }
      else if (tpl === 'standup') { task = createAlarmTask(); task.label = '每日站会'; task.hour = 9; task.minute = 30; task.repeat = [1,2,3,4,5]; }
      else if (tpl === 'lunch') { task = createAlarmTask(); task.label = '午休结束'; task.hour = 13; task.minute = 30; task.repeat = [1,2,3,4,5]; }
      else if (tpl === 'stretch') { task = createAlarmTask(); task.label = '久坐拉伸'; task.hour = Math.floor(Math.random() * 6) + 9; task.minute = 0; task.repeat = [1,2,3,4,5,6,0]; task.flightMode = 'loop_interval'; task.loopInterval = 120; task.intervalCount = 5; }
      const tasks = tasksRef.get();
      tasks.push(task);
      saveTasks(getCleanTasks(tasks));
      renderTaskView();
      templateMenu.classList.add('hidden');
      showToast(`已创建：${task.label}`);
    });
  });

  modalOverlay?.addEventListener('click', () => { editingIdRef.set(null); closeModal(modal, modalError); });
  modalCloseBtn?.addEventListener('click', () => { editingIdRef.set(null); closeModal(modal, modalError); });
  saveTaskBtn?.addEventListener('click', saveModalHandler);
  deleteTaskBtn?.addEventListener('click', () => {
    const id = editingIdRef.get();
    if (id !== null) {
      const tasks = tasksRef.get();
      const task = tasks.find(t => t.id === id);
      if (task) deleteTaskFn(task);
    }
  });

  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const type = btn.dataset.type;
      document.getElementById('alarmFields')?.classList.toggle('hidden', type !== 'alarm');
      document.getElementById('countdownFields')?.classList.toggle('hidden', type !== 'countdown');
      document.getElementById('holidayFields')?.classList.toggle('hidden', type !== 'holiday');
      document.getElementById('anniversaryFields')?.classList.toggle('hidden', type !== 'anniversary');
    });
  });

  editFlightMode?.addEventListener('change', () => {
    const v = editFlightMode.value;
    loopTimesField?.classList.toggle('hidden', v !== 'loop_times');
    loopIntervalField?.classList.toggle('hidden', v !== 'loop_interval');
  });

  editPostFlightAction?.addEventListener('change', () => {
    const v = editPostFlightAction.value;
    postFlightAppField?.classList.toggle('hidden', v !== 'app');
    postFlightUrlField?.classList.toggle('hidden', v !== 'url');
    postFlightFolderField?.classList.toggle('hidden', v !== 'folder');
    postFlightScriptField?.classList.toggle('hidden', v !== 'script' && v !== 'lock');
  });

  selectAppBtn?.addEventListener('click', async () => {
    if (!isTauriRuntime) return;
    try {
      const selected = await openDialog({ multiple: false, title: '选择应用程序' });
      if (selected) editPostFlightAppPath.value = selected;
    } catch (e) { console.error('File dialog failed:', e); }
  });

  selectFolderBtn?.addEventListener('click', async () => {
    if (!isTauriRuntime) return;
    try {
      const selected = await openDialog({ multiple: false, title: '选择文件夹', directory: true });
      if (selected) editPostFlightFolder.value = selected;
    } catch (e) { console.error('Folder dialog failed:', e); }
  });

  document.querySelectorAll('.day-btn').forEach(btn => {
    btn.addEventListener('click', () => btn.classList.toggle('active'));
  });

  document.getElementById('editRepeatType')?.addEventListener('change', (e) => {
    const type = e.target.value;
    const fieldMap = { weekly: 'repeatWeeklyFields', monthly_date: 'repeatMonthlyDateFields', monthly_weekday: 'repeatMonthlyWeekdayFields', interval: 'repeatIntervalFields' };
    Object.entries(fieldMap).forEach(([key, id]) => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('hidden', key !== type);
    });
  });
}
