export function initTaskFilter(ctx) {
  const { renderTaskView } = ctx;
  const taskSearchInput = document.getElementById('taskSearchInput');
  const taskSearchClear = document.getElementById('taskSearchClear');
  const taskTypeSelect = document.getElementById('taskTypeSelect');
  const taskGroupSelect = document.getElementById('taskGroupSelect');

  let taskSearchKeyword = '';
  let taskTypeFilter = 'all';
  let taskGroupFilter = 'all';

  if (taskSearchInput) {
    taskSearchInput.addEventListener('input', () => {
      taskSearchKeyword = taskSearchInput.value.trim().toLowerCase();
      if (taskSearchClear) taskSearchClear.hidden = !taskSearchKeyword;
      renderTaskView();
    });
    taskSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && taskSearchInput.value) {
        e.stopPropagation();
        taskSearchInput.value = '';
        taskSearchKeyword = '';
        if (taskSearchClear) taskSearchClear.hidden = true;
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
      renderTaskView();
      taskSearchInput.focus();
    });
  }
  if (taskTypeSelect) {
    taskTypeSelect.addEventListener('change', () => {
      taskTypeFilter = taskTypeSelect.value || 'all';
      renderTaskView();
    });
  }
  if (taskGroupSelect) {
    taskGroupSelect.addEventListener('change', () => {
      taskGroupFilter = taskGroupSelect.value || 'all';
      renderTaskView();
    });
  }

  return () => ({ taskSearchKeyword, taskTypeFilter, taskGroupFilter });
}
