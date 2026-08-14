// Lightweight state manager with change notifications.
// Modules can subscribe to state changes via state.on('key', callback).
// This replaces the pattern of passing setXxx callbacks between modules.

export function createAppState() {
  const listeners = new Map();
  const state = {
    tasks: [],
    editingId: null,
    expandedTaskId: null,
    isMuted: false,
    isConfigOpen: false,
    customImageData: '',
    editImageData: '',
    customAudioData: '',
    customAudioName: '',
    isStatsOpen: false,
    getTaskFilterState: null,
  };

  function notify(key, value) {
    const fns = listeners.get(key);
    if (fns) fns.forEach(fn => { try { fn(value); } catch (e) { console.error(`state[${key}] listener error:`, e); } });
  }

  const api = {
    on(key, fn) {
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key).add(fn);
      return () => listeners.get(key)?.delete(fn);
    },
    get tasks() { return state.tasks; },
    set tasks(value) { state.tasks = value; notify('tasks', value); },
    get editingId() { return state.editingId; },
    set editingId(value) { state.editingId = value; notify('editingId', value); },
    get expandedTaskId() { return state.expandedTaskId; },
    set expandedTaskId(value) { state.expandedTaskId = value; notify('expandedTaskId', value); },
    get isMuted() { return state.isMuted; },
    set isMuted(value) { state.isMuted = value; notify('isMuted', value); },
    get isConfigOpen() { return state.isConfigOpen; },
    set isConfigOpen(value) { state.isConfigOpen = value; notify('isConfigOpen', value); },
    get customImageData() { return state.customImageData; },
    set customImageData(value) { state.customImageData = value; notify('customImageData', value); },
    get editImageData() { return state.editImageData; },
    set editImageData(value) { state.editImageData = value; notify('editImageData', value); },
    get customAudioData() { return state.customAudioData; },
    set customAudioData(value) { state.customAudioData = value; notify('customAudioData', value); },
    get customAudioName() { return state.customAudioName; },
    set customAudioName(value) { state.customAudioName = value; notify('customAudioName', value); },
    get isStatsOpen() { return state.isStatsOpen; },
    set isStatsOpen(value) { state.isStatsOpen = value; notify('isStatsOpen', value); },
    get getTaskFilterState() { return state.getTaskFilterState; },
    set getTaskFilterState(value) { state.getTaskFilterState = value; notify('getTaskFilterState', value); },
  };

  return api;
}
