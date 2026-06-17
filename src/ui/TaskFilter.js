export function initTaskFilter(ctx) {
  const { renderTaskView } = ctx;
  const taskSearchInput = document.getElementById('taskSearchInput');
  const taskSearchClear = document.getElementById('taskSearchClear');
  const taskTypeChips = document.querySelectorAll('.task-type-chip[data-type]');
  const taskGroupChips = document.querySelectorAll('.task-type-chip[data-group]');

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
  taskTypeChips.forEach(chip => {
    chip.addEventListener('click', () => {
      taskTypeFilter = chip.dataset.type || 'all';
      taskTypeChips.forEach(c => c.classList.toggle('is-active', c === chip));
      renderTaskView();
    });
  });
  taskGroupChips.forEach(chip => {
    chip.addEventListener('click', () => {
      taskGroupFilter = chip.dataset.group || 'all';
      taskGroupChips.forEach(c => c.classList.toggle('is-active', c === chip));
      renderTaskView();
    });
  });

  return () => ({ taskSearchKeyword, taskTypeFilter, taskGroupFilter });
}
