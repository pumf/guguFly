import { t } from '../i18n/index.js';

export function initPomodoroUI(ctx) {
  const {
    getPomodoroState, startPomodoro, pausePomodoro, resumePomodoro,
    stopPomodoro, skipPomodoroPhase, setPomodoroTickCallback,
    isPomodoroActive,
  } = ctx;

  const pomodoroStartBtn = document.getElementById('pomodoroStartBtn');
  const pomodoroBar = document.getElementById('pomodoroBar');
  const pomodoroPhaseEl = document.getElementById('pomodoroPhase');
  const pomodoroTimerEl = document.getElementById('pomodoroTimer');
  const pomodoroRoundEl = document.getElementById('pomodoroRound');
  const pomodoroPauseBtn = document.getElementById('pomodoroPauseBtn');
  const pomodoroSkipBtn = document.getElementById('pomodoroSkipBtn');
  const pomodoroStopBtn = document.getElementById('pomodoroStopBtn');

  function updatePomodoroUI() {
    const pState = getPomodoroState();
    if (!pState.active) {
      pomodoroBar?.classList.add('hidden');
      return;
    }
    pomodoroBar?.classList.remove('hidden');
    if (pomodoroPhaseEl) pomodoroPhaseEl.textContent = pState.phase === 'work' ? (pState.round > 0 ? t('pomodoro.focus_round', { round: pState.round }) : t('pomodoro.focusing')) : pState.phase === 'shortBreak' ? t('pomodoro.short_rest') : t('pomodoro.long_rest');
    const mins = Math.floor(pState.remaining / 60);
    const secs = pState.remaining % 60;
    if (pomodoroTimerEl) pomodoroTimerEl.textContent = `${mins}:${String(secs).padStart(2, '0')}`;
    if (pomodoroRoundEl) pomodoroRoundEl.textContent = t('pomodoro.round', { round: pState.round, total: pState.totalRounds });
    if (pomodoroPauseBtn) {
      pomodoroPauseBtn.innerHTML = pState.task?._status === 'paused'
        ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>'
        : '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
    }
  }

  setPomodoroTickCallback(updatePomodoroUI);

  pomodoroStartBtn?.addEventListener('click', () => {
    if (isPomodoroActive()) return;
    startPomodoro(25);
    updatePomodoroUI();
  });

  pomodoroPauseBtn?.addEventListener('click', () => {
    const pState = getPomodoroState();
    if (pState.task?._status === 'paused') {
      resumePomodoro();
    } else {
      pausePomodoro();
    }
    updatePomodoroUI();
  });

  pomodoroSkipBtn?.addEventListener('click', () => {
    skipPomodoroPhase();
    updatePomodoroUI();
  });

  pomodoroStopBtn?.addEventListener('click', () => {
    stopPomodoro();
    updatePomodoroUI();
  });

  return { updatePomodoroUI };
}
