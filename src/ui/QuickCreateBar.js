import { parseQuickInput, formatPreview } from '../tasks/QuickCreateParser.js';
import { createAlarmTask, createCountdownTask } from '../tasks/TaskFactory.js';
import { t } from '../i18n/index.js';

let showToastFn = (msg) => console.warn('[QuickCreateBar] showToast called before init:', msg);
let saveTasksFn = null;
let getCleanTasksFn = null;
let renderTaskViewFn = null;
let stateRef = null;

export function setQuickCreateDeps({ showToast, saveTasks, getCleanTasks, renderTaskView, state }) {
  showToastFn = showToast;
  saveTasksFn = saveTasks;
  getCleanTasksFn = getCleanTasks;
  renderTaskViewFn = renderTaskView;
  stateRef = state;
}

export function initQuickCreate() {
  const input = document.getElementById('quickCreateInput');
  const preview = document.getElementById('quickCreatePreview');
  const createBtn = document.getElementById('quickCreateBtn');
  const clearBtn = document.getElementById('quickCreateClear');
  if (!input || !preview || !createBtn) return;

  let currentResult = null;

  input.addEventListener('input', () => {
    const val = input.value.trim();
    clearBtn.hidden = val.length === 0;

    if (val.length === 0) {
      preview.classList.add('hidden');
      currentResult = null;
      createBtn.disabled = true;
      return;
    }

    currentResult = parseQuickInput(val);
    if (currentResult) {
      preview.textContent = formatPreview(currentResult);
      preview.classList.remove('hidden');
      createBtn.disabled = false;
    } else {
      preview.classList.add('hidden');
      createBtn.disabled = true;
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !createBtn.disabled) {
      e.preventDefault();
      createBtn.click();
    }
    if (e.key === 'Escape') {
      input.value = '';
      input.dispatchEvent(new Event('input'));
      input.blur();
    }
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    input.dispatchEvent(new Event('input'));
    input.focus();
  });

  createBtn.addEventListener('click', () => {
    if (!currentResult || !stateRef || !saveTasksFn) return;

    let task;
    if (currentResult.type === 'alarm') {
      task = createAlarmTask();
      task.label = currentResult.label;
      task.msg = currentResult.msg || '';
      task.hour = currentResult.hour;
      task.minute = currentResult.minute;
      task.repeat = currentResult.repeat || { type: 'weekly', days: [] };
      if (currentResult.isTomorrow) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        task.repeat = { type: 'weekly', days: [tomorrow.getDay()] };
      }
    } else {
      task = createCountdownTask();
      task.label = currentResult.label;
      task.msg = currentResult.msg || '';
      task.duration = currentResult.duration;
      task._remaining = currentResult.duration;
    }

    stateRef.tasks.push(task);
    saveTasksFn(getCleanTasksFn(stateRef.tasks));
    if (renderTaskViewFn) renderTaskViewFn();

    showToastFn(t('quick_create.success', { label: task.label }));

    input.value = '';
    input.dispatchEvent(new Event('input'));
    input.blur();
  });

  input.addEventListener('focus', () => {
    input.parentElement.classList.add('quick-create-bar--focused');
  });

  input.addEventListener('blur', () => {
    setTimeout(() => {
      input.parentElement.classList.remove('quick-create-bar--focused');
    }, 150);
  });
}
