import { invoke } from '@tauri-apps/api/core';
import { createCountdownTask } from '../tasks/TaskFactory.js';
import { getCleanTasks } from '../tasks/TaskUtils.js';

export function initPostFlightHandler(ctx) {
  const {
    state, saveTasks, renderTaskView, startCountdown, showToast,
    triggerFlightWithMode, recordFlightTrigger, setSkipPostFlight,
    t,
  } = ctx;

  return async (action, { minutes, task }) => {
    if (!task) return;
    if (action === 'snooze') {
      const snoozeTask = createCountdownTask();
      snoozeTask.label = `${task.label}${t('task.snooze_suffix', { minutes })}`;
      snoozeTask.msg = task.msg || '';
      snoozeTask.duration = minutes * 60;
      snoozeTask._remaining = minutes * 60;
      state.tasks.push(snoozeTask);
      saveTasks(getCleanTasks(state.tasks));
      renderTaskView();
      startCountdown(snoozeTask);
      setSkipPostFlight(true);
      invoke('close_flight_windows').catch(err => console.warn('close flight windows failed:', err));
      showToast(t('toast.snoozed', { minutes, label: task.label }));
    } else if (action === 'skip') {
      setSkipPostFlight(true);
      invoke('close_flight_windows').catch(err => console.warn('close flight windows failed:', err));
      showToast(t('toast.skipped', { label: task.label }));
    } else if (action === 'repeat') {
      setSkipPostFlight(true);
      invoke('close_flight_windows').catch(err => console.warn('close flight windows failed:', err));
      if (task.type === 'countdown') {
        const repeatTask = createCountdownTask();
        repeatTask.label = `${task.label}${t('task.repeat_suffix')}`;
        repeatTask.msg = task.msg || '';
        repeatTask.duration = task.duration;
        repeatTask._remaining = task.duration;
        state.tasks.push(repeatTask);
        saveTasks(getCleanTasks(state.tasks));
        renderTaskView();
        startCountdown(repeatTask);
        showToast(t('toast.repeated', { label: repeatTask.label }));
      } else {
        triggerFlightWithMode(task, null, recordFlightTrigger, null, null);
      }
    }
  };
}
