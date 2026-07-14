const FILTER_STORAGE_KEY = 'taskFilterState';

function loadFilterState() {
  try {
    const saved = JSON.parse(localStorage.getItem(FILTER_STORAGE_KEY));
    if (saved && typeof saved === 'object') return saved;
  } catch {}
  return {};
}

function saveFilterState(state) {
  try { localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(state)); } catch {}
}

export function initTaskFilter(ctx) {
  const { renderTaskView } = ctx;
  const taskSearchInput = document.getElementById('taskSearchInput');
  const taskSearchClear = document.getElementById('taskSearchClear');
  const taskTypeSelect = document.getElementById('taskTypeSelect');
  const taskGroupSelect = document.getElementById('taskGroupSelect');

  const saved = loadFilterState();
  let taskSearchKeyword = saved.keyword || '';
  let taskTypeFilter = saved.type || 'all';
  let taskGroupFilter = saved.group || 'all';

  if (taskSearchInput && taskSearchKeyword) {
    taskSearchInput.value = taskSearchKeyword;
    if (taskSearchClear) taskSearchClear.hidden = false;
  }
  if (taskTypeSelect) taskTypeSelect.value = taskTypeFilter;
  if (taskGroupSelect) taskGroupSelect.value = taskGroupFilter;

  const persist = () => saveFilterState({ keyword: taskSearchKeyword, type: taskTypeFilter, group: taskGroupFilter });

  if (taskSearchInput) {
    taskSearchInput.addEventListener('input', () => {
      taskSearchKeyword = taskSearchInput.value.trim().toLowerCase();
      if (taskSearchClear) taskSearchClear.hidden = !taskSearchKeyword;
      persist();
      renderTaskView();
    });
    taskSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && taskSearchInput.value) {
        e.stopPropagation();
        taskSearchInput.value = '';
        taskSearchKeyword = '';
        if (taskSearchClear) taskSearchClear.hidden = true;
        persist();
        renderTaskView();
      }
    });
  }
  if (taskSearchClear) {
    taskSearchClear.addEventListener('click', () => {
      if (!taskSearchInput) return;
      taskSearchInput.value = '';
      taskSearchKeyword = '';
      taskSearchClear.hidden = true;
      persist();
      renderTaskView();
      taskSearchInput.focus();
    });
  }
  if (taskTypeSelect) {
    taskTypeSelect.addEventListener('change', () => {
      taskTypeFilter = taskTypeSelect.value || 'all';
      persist();
      renderTaskView();
    });
  }
  if (taskGroupSelect) {
    taskGroupSelect.addEventListener('change', () => {
      taskGroupFilter = taskGroupSelect.value || 'all';
      persist();
      renderTaskView();
    });
  }

  return () => ({ taskSearchKeyword, taskTypeFilter, taskGroupFilter });
}
