export function initTauriListeners(ctx) {
  const { listen, isTauriRuntime, tasksRef, stopLoopSoundLocal, clearAllSequences, clearFlightQueue, clearFlightStreak,
    pauseCountdown, stopCountdown, startCountdown, muteBtn, invoke, showToast, createCountdownTask,
    triggerEmergencyLanding, saveTasks, getCleanTasks, renderTaskView,
    autoCheckForUpdate,
    getCurrentWebviewWindow } = ctx;

  if (isTauriRuntime) {
    listen('timer-start', () => {
      const tasks = tasksRef.get();
      tasks.forEach(t => { if (t.type === 'countdown' && t.enabled && (t._status === 'idle' || t._status === 'paused')) startCountdown(t); });
    });
    listen('timer-pause', () => {
      stopLoopSoundLocal();
      const tasks = tasksRef.get();
      tasks.forEach(t => { if (t.type === 'countdown' && t._status === 'running') pauseCountdown(t); });
    });
    listen('timer-stop', () => {
      stopLoopSoundLocal();
      clearAllSequences(); clearFlightQueue(); clearFlightStreak();
      const tasks = tasksRef.get();
      tasks.forEach(t => { if (t.type === 'countdown' && (t._status === 'running' || t._status === 'paused')) stopCountdown(t); });
    });
    listen('toggle-mute', () => muteBtn.click());
    listen('skip-current-flight', () => {
      stopLoopSoundLocal(); clearFlightQueue();
      invoke('close_flight_windows').catch(() => {});
      showToast('已跳过');
    });
    listen('emergency-landing', () => { void triggerEmergencyLanding(tasksRef.get()); });
    listen('quick-countdown', (event) => {
      const duration = event.payload;
      const task = createCountdownTask();
      const mins = Math.floor(duration / 60);
      task.label = `快速倒计时 ${mins} 分钟`;
      task.duration = duration; task._remaining = duration; task._status = 'idle';
      const tasks = tasksRef.get();
      tasks.push(task);
      saveTasks(getCleanTasks(tasks));
      startCountdown(task);
      renderTaskView();
      showToast(`已启动 ${mins} 分钟倒计时`);
    });

    const w = getCurrentWebviewWindow();
    w.onCloseRequested(async (e) => {
      e.preventDefault();
      await saveTasks(getCleanTasks(tasksRef.get()));
      await w.hide();
    });

    setTimeout(() => { void autoCheckForUpdate(); }, 3000);
  }
}
