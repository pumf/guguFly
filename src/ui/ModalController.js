import { createAlarmTask, createCountdownTask, createHolidayTask, createAnniversaryTask } from '../tasks/TaskFactory.js';
import { getMaxDayForMonth, formatHolidayLabel, normalizeRepeat } from '../tasks/TaskUtils.js';

let showToastFn = (msg) => console.log(msg);

export function setToastFn(fn) { showToastFn = fn; }

function getRepeatSubFields() {
  return {
    repeatWeeklyFields: document.getElementById('repeatWeeklyFields'),
    repeatMonthlyDateFields: document.getElementById('repeatMonthlyDateFields'),
    repeatMonthlyWeekdayFields: document.getElementById('repeatMonthlyWeekdayFields'),
    repeatIntervalFields: document.getElementById('repeatIntervalFields'),
  };
}

function showRepeatTypeFields(type) {
  const f = getRepeatSubFields();
  Object.values(f).forEach(el => el.classList.add('hidden'));
  if (type === 'weekly') f.repeatWeeklyFields.classList.remove('hidden');
  else if (type === 'monthly_date') f.repeatMonthlyDateFields.classList.remove('hidden');
  else if (type === 'monthly_weekday') f.repeatMonthlyWeekdayFields.classList.remove('hidden');
  else if (type === 'interval') f.repeatIntervalFields.classList.remove('hidden');
}

function populateRepeatUI(repeat) {
  const r = normalizeRepeat({ repeat });
  const typeSelect = document.getElementById('editRepeatType');
  if (typeSelect) typeSelect.value = r.type;
  showRepeatTypeFields(r.type);

  document.querySelectorAll('.day-btn').forEach(b => {
    b.classList.toggle('active', r.type === 'weekly' && (r.days || []).includes(parseInt(b.dataset.day)));
  });
  const monthDayInput = document.getElementById('editRepeatMonthDay');
  if (monthDayInput) monthDayInput.value = r.day || 15;
  const weekSelect = document.getElementById('editRepeatWeek');
  if (weekSelect) weekSelect.value = r.week || 1;
  const weekdaySelect = document.getElementById('editRepeatWeekday');
  if (weekdaySelect) weekdaySelect.value = r.weekday ?? 1;
  const intervalInput = document.getElementById('editRepeatInterval');
  if (intervalInput) intervalInput.value = r.interval || 3;
}

function collectRepeatFromUI() {
  const typeSelect = document.getElementById('editRepeatType');
  if (!typeSelect) return { type: 'weekly', days: [] };
  const type = typeSelect.value;
  if (type === 'weekly') {
    const days = [];
    document.querySelectorAll('.day-btn.active').forEach(b => days.push(parseInt(b.dataset.day)));
    return { type: 'weekly', days };
  }
  if (type === 'monthly_date') {
    const day = Math.min(31, Math.max(1, parseInt(document.getElementById('editRepeatMonthDay')?.value) || 15));
    return { type: 'monthly_date', day };
  }
  if (type === 'monthly_weekday') {
    const week = parseInt(document.getElementById('editRepeatWeek')?.value) || 1;
    const weekday = parseInt(document.getElementById('editRepeatWeekday')?.value) ?? 1;
    return { type: 'monthly_weekday', week, weekday };
  }
  if (type === 'interval') {
    const interval = Math.max(1, parseInt(document.getElementById('editRepeatInterval')?.value) || 3);
    return { type: 'interval', interval };
  }
  return { type: 'weekly', days: [] };
}

export function openEditModal(task, editingId, setSelectedColorFn, ctx) {
  const {
    modal, modalTitle, modalError, editLabel, editMsg, editGroup,
    editFlightMode, editLoopCount, editLoopInterval, editIntervalCount,
    loopTimesField, loopIntervalField,
    editPostFlightAction, editPostFlightAppPath, editPostFlightUrl,
    editPostFlightFolder, editPostFlightScript,
    postFlightAppField, postFlightUrlField, postFlightFolderField, postFlightScriptField,
    alarmFields, countdownFields, holidayFields, anniversaryFields,
    editHour, editMinute, editMinutes, editSeconds,
    editHolidayHour, editHolidayMinute, holidayChecklist,
    editAnniMonth, editAnniDay, editAnniHour, editAnniMinute,
    editImagePreview, editClearImageBtn, editUseImageCheckbox, editImageInput,
    deleteTaskBtn, editAnniLunar,
  } = ctx;

  ctx.editingId = task.id;
  clearModalError(modalError);
  modalTitle.textContent = '编辑任务';

  editLabel.value = task.label;
  editMsg.value = task.msg || '';
  editGroup.value = task.group || '';

  editFlightMode.value = task.flightMode || 'once';
  editLoopCount.value = task.loopCount || 3;
  editLoopInterval.value = task.loopInterval || 5;
  editIntervalCount.value = task.intervalCount || 10;
  loopTimesField.classList.toggle('hidden', editFlightMode.value !== 'loop_times');
  loopIntervalField.classList.toggle('hidden', editFlightMode.value !== 'loop_interval');

  editPostFlightAction.value = task.postFlightAction || 'none';
  editPostFlightAppPath.value = task.postFlightAppPath || '';
  editPostFlightUrl.value = task.postFlightUrl || '';
  editPostFlightFolder.value = task.postFlightFolder || '';
  editPostFlightScript.value = task.postFlightScript || '';
  postFlightAppField.classList.toggle('hidden', editPostFlightAction.value !== 'app');
  postFlightUrlField.classList.toggle('hidden', editPostFlightAction.value !== 'url');
  postFlightFolderField.classList.toggle('hidden', editPostFlightAction.value !== 'folder');
  postFlightScriptField.classList.toggle('hidden', editPostFlightAction.value !== 'script' && editPostFlightAction.value !== 'lock');

  document.querySelectorAll('.type-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.type === task.type);
  });
  [alarmFields, countdownFields, holidayFields, anniversaryFields].forEach(el => el.classList.add('hidden'));

  if (task.type === 'alarm') {
    alarmFields.classList.remove('hidden');
    editHour.value = task.hour;
    editMinute.value = task.minute;
    populateRepeatUI(task.repeat || { type: 'weekly', days: [] });
  } else if (task.type === 'countdown') {
    countdownFields.classList.remove('hidden');
    editMinutes.value = Math.floor(task.duration / 60);
    editSeconds.value = task.duration % 60;
  } else if (task.type === 'holiday') {
    holidayFields.classList.remove('hidden');
    holidayChecklist.querySelectorAll('input').forEach(cb => {
      cb.checked = cb.value === task.holidayKey;
    });
    editHolidayHour.value = task.hour;
    editHolidayMinute.value = task.minute;
  } else if (task.type === 'anniversary') {
    anniversaryFields.classList.remove('hidden');
    editAnniMonth.value = task.month;
    editAnniDay.value = task.day;
    editAnniHour.value = task.hour;
    editAnniMinute.value = task.minute;
    if (editAnniLunar) editAnniLunar.checked = !!task.lunar;
  }

  ctx.editImageData = task.imageData || '';
  if (editImagePreview) {
    if (ctx.editImageData) {
      editImagePreview.src = ctx.editImageData;
      editImagePreview.classList.remove('hidden');
    } else {
      editImagePreview.src = '';
      editImagePreview.classList.add('hidden');
    }
  }
  if (editClearImageBtn) editClearImageBtn.hidden = !ctx.editImageData;
  if (editUseImageCheckbox) editUseImageCheckbox.checked = !!task.useImage;
  if (editImageInput) editImageInput.value = '';

  setSelectedColorFn(task.color || null);

  deleteTaskBtn.classList.remove('hidden');
  modal.classList.remove('hidden');
}

export function openNewModal(editingId, ctx) {
  const {
    modal, modalTitle, modalError, editLabel, editMsg, editGroup,
    editFlightMode, editLoopCount, editLoopInterval, editIntervalCount,
    loopTimesField, loopIntervalField,
    editPostFlightAction, editPostFlightAppPath, editPostFlightUrl,
    editPostFlightFolder, editPostFlightScript,
    postFlightAppField, postFlightUrlField, postFlightFolderField, postFlightScriptField,
    alarmFields, countdownFields, holidayFields, anniversaryFields,
    editHour, editMinute, editMinutes, editSeconds,
    editHolidayHour, editHolidayMinute,
    editAnniMonth, editAnniDay, editAnniHour, editAnniMinute,
    editImagePreview, editClearImageBtn, editUseImageCheckbox, editImageInput,
    deleteTaskBtn,
  } = ctx;

  editingId = null;
  ctx.editingId = null;
  clearModalError(modalError);
  modalTitle.textContent = '新建任务';

  editLabel.value = '';
  editMsg.value = '';
  editGroup.value = '';

  editFlightMode.value = 'once';
  editLoopCount.value = 3;
  editLoopInterval.value = 5;
  editIntervalCount.value = 10;
  loopTimesField.classList.add('hidden');
  loopIntervalField.classList.add('hidden');

  editPostFlightAction.value = 'none';
  editPostFlightAppPath.value = '';
  editPostFlightUrl.value = '';
  editPostFlightFolder.value = '';
  editPostFlightScript.value = '';
  postFlightAppField.classList.add('hidden');
  postFlightUrlField.classList.add('hidden');
  postFlightFolderField.classList.add('hidden');
  postFlightScriptField.classList.add('hidden');

  document.querySelectorAll('.type-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.type === 'alarm');
  });
  alarmFields.classList.remove('hidden');
  countdownFields.classList.add('hidden');
  holidayFields.classList.add('hidden');
  anniversaryFields.classList.add('hidden');
  editHour.value = '12';
  editMinute.value = '0';
  editMinutes.value = '25';
  editSeconds.value = '0';

  populateRepeatUI({ type: 'weekly', days: [] });

  editHolidayHour.value = '9';
  editHolidayMinute.value = '0';
  editAnniMonth.value = '1';
  editAnniDay.value = '1';
  editAnniHour.value = '9';
  editAnniMinute.value = '0';
  if (ctx.editAnniLunar) ctx.editAnniLunar.checked = false;

  ctx.editImageData = '';
  if (editImagePreview) {
    editImagePreview.src = '';
    editImagePreview.classList.add('hidden');
  }
  if (editClearImageBtn) editClearImageBtn.hidden = true;
  if (editUseImageCheckbox) editUseImageCheckbox.checked = false;
  if (editImageInput) editImageInput.value = '';

  deleteTaskBtn.classList.add('hidden');
  modal.classList.remove('hidden');
}

export function openNewModalForType(type, editingId, ctx) {
  openNewModal(editingId, ctx);
  const target = document.querySelector(`.type-btn[data-type="${type}"]`);
  if (target) target.click();
}

export function closeModal(modal, modalError) {
  clearModalError(modalError);
  modal.classList.add('hidden');
}

export function saveModal(editingId, ctx) {
  const {
    modal, modalError, tasks, saveTasks, getCleanTasksFn, renderTasksFn,
    editLabel, editMsg, editGroup,
    editFlightMode, editLoopCount, editLoopInterval, editIntervalCount,
    editPostFlightAction, editPostFlightAppPath, editPostFlightUrl,
    editPostFlightFolder, editPostFlightScript,
    editHour, editMinute, editMinutes, editSeconds,
    editHolidayHour, editHolidayMinute, holidayChecklist, HOLIDAY_PRESETS,
    editAnniMonth, editAnniDay, editAnniHour, editAnniMinute,
    editUseImageCheckbox,
    stopCountdownFn, editAnniLunar,
  } = ctx;

  clearModalError(modalError);
  const type = document.querySelector('.type-btn.active').dataset.type;

  const flightMode = editFlightMode.value;
  const loopCount = parseInt(editLoopCount.value) || 3;
  const loopInterval = parseInt(editLoopInterval.value) || 5;
  const intervalCount = parseInt(editIntervalCount.value) || 10;

  if (ctx.editingId) {
    const task = tasks.find(t => t.id === ctx.editingId);
    if (!task) return;

    if (task._status === 'running' && stopCountdownFn) stopCountdownFn(task);

    task.label = editLabel.value.trim();
    task.msg = editMsg.value.trim();
    task.group = editGroup.value;
    task.type = type;
    task.flightMode = flightMode;
    task.loopCount = loopCount;
    task.loopInterval = loopInterval;
    task.intervalCount = intervalCount;
    task.imageData = ctx.editImageData || null;
    task.useImage = ctx.editImageData ? !!editUseImageCheckbox?.checked : false;
    task.color = ctx.selectedEditColor;
    task.postFlightAction = editPostFlightAction.value;
    task.postFlightAppPath = editPostFlightAppPath.value.trim();
    task.postFlightUrl = editPostFlightUrl.value.trim();
    task.postFlightFolder = editPostFlightFolder.value.trim();
    task.postFlightScript = editPostFlightScript.value.trim();

    if (type === 'alarm') {
      task.hour = Math.min(23, Math.max(0, parseInt(editHour.value) || 0));
      task.minute = Math.min(59, Math.max(0, parseInt(editMinute.value) || 0));
      task.repeat = collectRepeatFromUI();
      task._lastTriggeredDate = null;
    } else if (type === 'countdown') {
      const mins = parseInt(editMinutes.value) || 0;
      const secs = Math.min(59, Math.max(0, parseInt(editSeconds.value) || 0));
      task.duration = mins * 60 + secs;
      if (task.duration <= 0) task.duration = 60;
      task._remaining = task.duration;
    } else if (type === 'holiday') {
      const checkedBoxes = holidayChecklist.querySelectorAll('input:checked');
      if (checkedBoxes.length === 0) {
        showToastFn('请至少选择一个节假日');
        return;
      }
      const useKey = checkedBoxes[0].value;
      const preset = HOLIDAY_PRESETS[useKey];
      task.holidayKey = useKey;
      task.month = preset ? preset.month : 1;
      task.day = preset ? preset.day : 1;
      task.hour = Math.min(23, Math.max(0, parseInt(editHolidayHour.value) || 0));
      task.minute = Math.min(59, Math.max(0, parseInt(editHolidayMinute.value) || 0));
      task.lunar = preset ? !!preset.lunar : false;
      task.label = task.label || formatHolidayLabel(preset);
      task._lastTriggeredDate = null;
    } else if (type === 'anniversary') {
      const anniversary = parseAnniversaryValues(editAnniMonth, editAnniDay, editAnniHour, editAnniMinute);
      if (!validateAnniversaryValues(anniversary, editAnniMonth, editAnniDay, modalError)) return;
      task.month = anniversary.month;
      task.day = anniversary.day;
      task.hour = anniversary.hour;
      task.minute = anniversary.minute;
      task.lunar = !!(editAnniLunar && editAnniLunar.checked);
      task._lastTriggeredDate = null;
    }
  } else {
    let task;
    if (type === 'alarm') {
      task = createAlarmTask();
      task.label = editLabel.value.trim();
      task.msg = editMsg.value.trim();
      task.hour = Math.min(23, Math.max(0, parseInt(editHour.value) || 0));
      task.minute = Math.min(59, Math.max(0, parseInt(editMinute.value) || 0));
      task.repeat = collectRepeatFromUI();
    } else if (type === 'countdown') {
      task = createCountdownTask();
      task.label = editLabel.value.trim();
      task.msg = editMsg.value.trim();
      const mins = parseInt(editMinutes.value) || 0;
      const secs = Math.min(59, Math.max(0, parseInt(editSeconds.value) || 0));
      task.duration = mins * 60 + secs;
      if (task.duration <= 0) task.duration = 60;
      task._remaining = task.duration;
    } else if (type === 'holiday') {
      const checkedBoxes = holidayChecklist.querySelectorAll('input:checked');
      if (checkedBoxes.length === 0) {
        showToastFn('请至少选择一个节假日');
        return;
      }
      const hour = Math.min(23, Math.max(0, parseInt(editHolidayHour.value) || 0));
      const minute = Math.min(59, Math.max(0, parseInt(editHolidayMinute.value) || 0));
      const msg = editMsg.value.trim();
      checkedBoxes.forEach((cb, idx) => {
        const key = cb.value;
        const preset = HOLIDAY_PRESETS[key];
        const t = createHolidayTask();
        t.holidayKey = key;
        t.label = formatHolidayLabel(preset);
        t.msg = idx === 0 ? msg : '';
        t.flightMode = flightMode;
        t.loopCount = loopCount;
        t.loopInterval = loopInterval;
        t.intervalCount = intervalCount;
        t.postFlightAction = editPostFlightAction.value;
        t.postFlightAppPath = editPostFlightAppPath.value.trim();
        t.postFlightUrl = editPostFlightUrl.value.trim();
        t.month = preset ? preset.month : 1;
        t.day = preset ? preset.day : 1;
        t.hour = hour;
        t.minute = minute;
        t.lunar = preset ? !!preset.lunar : false;
        t.imageData = ctx.editImageData || null;
        t.useImage = ctx.editImageData ? !!editUseImageCheckbox?.checked : false;
        t.color = ctx.selectedEditColor;
        tasks.push(t);
      });
      closeModal(modal, modalError);
      saveTasks(getCleanTasksFn(tasks));
      renderTasksFn();
      return;
    } else if (type === 'anniversary') {
      task = createAnniversaryTask();
      task.label = editLabel.value.trim() || '纪念日';
      task.msg = editMsg.value.trim();
      task.flightMode = flightMode;
      task.loopCount = loopCount;
      task.loopInterval = loopInterval;
      task.intervalCount = intervalCount;
      const anniversary = parseAnniversaryValues(editAnniMonth, editAnniDay, editAnniHour, editAnniMinute);
      if (!validateAnniversaryValues(anniversary, editAnniMonth, editAnniDay, modalError)) return;
      task.month = anniversary.month;
      task.day = anniversary.day;
      task.hour = anniversary.hour;
      task.minute = anniversary.minute;
      task.lunar = !!(editAnniLunar && editAnniLunar.checked);
    }
    task.imageData = ctx.editImageData || null;
    task.useImage = ctx.editImageData ? !!editUseImageCheckbox?.checked : false;
    task.color = ctx.selectedEditColor;
    task.group = editGroup.value;
    task.postFlightAction = editPostFlightAction.value;
    task.postFlightAppPath = editPostFlightAppPath.value.trim();
    task.postFlightUrl = editPostFlightUrl.value.trim();
    task.postFlightFolder = editPostFlightFolder.value.trim();
    task.postFlightScript = editPostFlightScript.value.trim();
    tasks.push(task);
  }

  closeModal(modal, modalError);
  saveTasks(getCleanTasksFn(tasks));
  renderTasksFn();
}

export function deleteTask(task, tasks, closeModalFn, saveTasks, getCleanTasksFn, renderTasksFn, stopCountdownFn) {
  if (stopCountdownFn && task._status === 'running') stopCountdownFn(task);
  const idx = tasks.findIndex(t => t.id === task.id);
  if (idx >= 0) tasks.splice(idx, 1);
  if (closeModalFn) closeModalFn();
  saveTasks(getCleanTasksFn(tasks));
  renderTasksFn();
}

function parseAnniversaryValues(editAnniMonth, editAnniDay, editAnniHour, editAnniMinute) {
  const month = Math.min(12, Math.max(1, parseInt(editAnniMonth.value) || 1));
  const day = Math.min(31, Math.max(1, parseInt(editAnniDay.value) || 1));
  const hour = Math.min(23, Math.max(0, parseInt(editAnniHour.value) || 0));
  const minute = Math.min(59, Math.max(0, parseInt(editAnniMinute.value) || 0));
  return { month, day, hour, minute };
}

function validateAnniversaryValues({ month, day }, editAnniMonth, editAnniDay, modalError) {
  if (day > getMaxDayForMonth(month)) {
    markFieldError([editAnniMonth, editAnniDay]);
    showModalError(`该日期不存在：${month} 月最多只有 ${getMaxDayForMonth(month)} 天`, modalError);
    return false;
  }
  return true;
}

function clearModalError(modalError) {
  modalError.textContent = '';
  modalError.classList.add('hidden');
  clearFieldErrors();
}

function showModalError(message, modalError) {
  modalError.textContent = message;
  modalError.classList.remove('hidden');
}

function markFieldError(elements) {
  elements.filter(Boolean).forEach(el => el.classList.add('field-error'));
}

function clearFieldErrors() {
  document.querySelectorAll('.field-error').forEach(el => el.classList.remove('field-error'));
}

export function validateUpload(file, validTypes, maxSize, kindLabel, btnEl) {
  if (!file) return false;
  const fileName = file.name || '';
  const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
  const validExtensions = kindLabel === '图片' ? new Set(['png', 'jpg', 'jpeg', 'gif']) : new Set(['mp3', 'wav', 'ogg', 'mpeg']);
  const typeOk = !!file.type && validTypes.has(file.type);
  const extOk = !!ext && validExtensions.has(ext);
  if (!typeOk && !extOk) {
    markFieldError([btnEl]);
    showToastFn(`${kindLabel}格式不支持`);
    return false;
  }
  if (file.size > maxSize) {
    markFieldError([btnEl]);
    showToastFn(`${kindLabel}过大，请控制在 ${Math.round(maxSize / 1024 / 1024)}MB 以内`);
    return false;
  }
  return true;
}

export function initHolidayChecklist(holidayChecklist, HOLIDAY_PRESETS) {
  holidayChecklist.innerHTML = '';

  const statutorySection = document.createElement('div');
  statutorySection.className = 'holiday-subsection';

  const statutoryTitle = document.createElement('div');
  statutoryTitle.className = 'holiday-subtitle';
  statutoryTitle.textContent = '法定假日';
  statutorySection.appendChild(statutoryTitle);

  const solarTermSection = document.createElement('div');
  solarTermSection.className = 'holiday-subsection';

  const solarTermTitle = document.createElement('div');
  solarTermTitle.className = 'holiday-subtitle';
  solarTermTitle.textContent = '二十四节气';
  solarTermSection.appendChild(solarTermTitle);

  for (const [key, preset] of Object.entries(HOLIDAY_PRESETS)) {
    const label = document.createElement('label');
    label.className = 'holiday-item';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = key;
    label.appendChild(cb);

    let displayText = preset.label;
    if (preset.category === 'solar_term') {
      displayText += `（${preset.month}月${preset.day}日）`;
    } else if (preset.lunar) {
      displayText += '（农历）';
    } else {
      displayText += `（${preset.month}月${preset.day}日）`;
    }
    label.appendChild(document.createTextNode(displayText));

    if (preset.category === 'solar_term') {
      solarTermSection.appendChild(label);
    } else {
      statutorySection.appendChild(label);
    }
  }

  if (statutorySection.childNodes.length > 1) {
    holidayChecklist.appendChild(statutorySection);
  }
  if (solarTermSection.childNodes.length > 1) {
    holidayChecklist.appendChild(solarTermSection);
  }
}
