import { t } from '../i18n/index.js';

let barEl;
let selectAllBtn;
let deselectAllBtn;
let enableBtn;
let disableBtn;
let deleteBtn;
let cancelBtn;
let countEl;
let selectedTasks = new Set();
let isSelectionMode = false;
let tasksRef;
let saveTasksFn;
let getCleanTasksFn;
let renderTaskViewFn;
let showConfirmFn;
let showToastFn;

export function initBatchOperation(ctx) {
  tasksRef = ctx.tasksRef;
  saveTasksFn = ctx.saveTasks;
  getCleanTasksFn = ctx.getCleanTasks;
  renderTaskViewFn = ctx.renderTaskView;
  showConfirmFn = ctx.showConfirm;
  showToastFn = ctx.showToast;

  barEl = document.getElementById('batchOperationBar');
  selectAllBtn = document.getElementById('batchSelectAll');
  deselectAllBtn = document.getElementById('batchDeselectAll');
  enableBtn = document.getElementById('batchEnable');
  disableBtn = document.getElementById('batchDisable');
  deleteBtn = document.getElementById('batchDelete');
  cancelBtn = document.getElementById('batchCancel');
  countEl = document.getElementById('batchSelectedCount');

  selectAllBtn?.addEventListener('click', selectAll);
  deselectAllBtn?.addEventListener('click', deselectAll);
  enableBtn?.addEventListener('click', batchEnable);
  disableBtn?.addEventListener('click', batchDisable);
  deleteBtn?.addEventListener('click', batchDelete);
  cancelBtn?.addEventListener('click', exitSelectionMode);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isSelectionMode) {
      exitSelectionMode();
    }
  });
}

export function toggleSelectionMode() {
  if (isSelectionMode) {
    exitSelectionMode();
  } else {
    enterSelectionMode();
  }
}

export function enterSelectionMode() {
  isSelectionMode = true;
  selectedTasks.clear();
  barEl?.classList.remove('hidden');
  updateUI();
}

export function exitSelectionMode() {
  isSelectionMode = false;
  selectedTasks.clear();
  barEl?.classList.add('hidden');
  document.querySelectorAll('.task-card.selected').forEach(card => {
    card.classList.remove('selected');
  });
  updateUI();
}

export function isTaskSelected(taskId) {
  return selectedTasks.has(taskId);
}

export function toggleTaskSelection(taskId) {
  if (!isSelectionMode) return;
  if (selectedTasks.has(taskId)) {
    selectedTasks.delete(taskId);
  } else {
    selectedTasks.add(taskId);
  }
  updateUI();
}

function selectAll() {
  const tasks = tasksRef?.get() || [];
  tasks.forEach(task => selectedTasks.add(task.id));
  updateUI();
  document.querySelectorAll('.task-card').forEach(card => {
    card.classList.add('selected');
  });
}

function deselectAll() {
  selectedTasks.clear();
  updateUI();
  document.querySelectorAll('.task-card.selected').forEach(card => {
    card.classList.remove('selected');
  });
}

function batchEnable() {
  const tasks = tasksRef?.get() || [];
  let count = 0;
  tasks.forEach(task => {
    if (selectedTasks.has(task.id) && !task.enabled) {
      task.enabled = true;
      count++;
    }
  });
  if (count > 0) {
    saveTasksFn(getCleanTasksFn(tasks));
    renderTaskViewFn();
    showToastFn(t('batch.enabled', { count }));
  }
  exitSelectionMode();
}

function batchDisable() {
  const tasks = tasksRef?.get() || [];
  let count = 0;
  tasks.forEach(task => {
    if (selectedTasks.has(task.id) && task.enabled) {
      task.enabled = false;
      count++;
    }
  });
  if (count > 0) {
    saveTasksFn(getCleanTasksFn(tasks));
    renderTaskViewFn();
    showToastFn(t('batch.disabled', { count }));
  }
  exitSelectionMode();
}

async function batchDelete() {
  if (selectedTasks.size === 0) return;
  const confirmed = await showConfirmFn(t('batch.delete_confirm', { count: selectedTasks.size }));
  if (!confirmed) return;

  const tasks = tasksRef?.get() || [];
  const remaining = tasks.filter(task => !selectedTasks.has(task.id));
  const count = tasks.length - remaining.length;
  tasksRef.set(remaining);
  saveTasksFn(getCleanTasksFn(remaining));
  renderTaskViewFn();
  showToastFn(t('batch.deleted', { count }));
  exitSelectionMode();
}

function updateUI() {
  if (countEl) countEl.textContent = selectedTasks.size;
  const hasSelection = selectedTasks.size > 0;
  if (enableBtn) enableBtn.disabled = !hasSelection;
  if (disableBtn) disableBtn.disabled = !hasSelection;
  if (deleteBtn) deleteBtn.disabled = !hasSelection;
}

export function getSelectedTasks() {
  return selectedTasks;
}

export function isSelectionModeActive() {
  return isSelectionMode;
}
