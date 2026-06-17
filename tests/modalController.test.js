import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { saveModal } from '../src/ui/ModalController.js';
import { HOLIDAY_PRESETS } from '../src/tasks/HolidayPresets.js';

describe('saveModal', () => {
  let originalDocument;

  beforeEach(() => {
    originalDocument = globalThis.document;
  });

  afterEach(() => {
    globalThis.document = originalDocument;
  });

  it('creates a new alarm task and persists it', () => {
    globalThis.document = {
      querySelector: vi.fn(() => ({ dataset: { type: 'alarm' } })),
      querySelectorAll: vi.fn(() => []),
      getElementById: vi.fn(() => null),
    };

    const modal = { classList: { add: vi.fn() } };
    const modalError = { textContent: '', classList: { add: vi.fn(), remove: vi.fn() } };
    const tasks = [];
    const saveTasks = vi.fn();
    const renderTasksFn = vi.fn();

    saveModal(null, {
      modal,
      modalError,
      tasks,
      saveTasks,
      getCleanTasksFn: (value) => value,
      renderTasksFn,
      editLabel: { value: '晨会' },
      editMsg: { value: '开会啦' },
      editGroup: { value: 'work' },
      editingId: null,
      editFlightMode: { value: 'once' },
      editLoopCount: { value: '3' },
      editLoopInterval: { value: '5' },
      editIntervalCount: { value: '10' },
      editPostFlightAction: { value: 'none' },
      editPostFlightAppPath: { value: '' },
      editPostFlightUrl: { value: '' },
      editPostFlightFolder: { value: '' },
      editPostFlightScript: { value: '' },
      editHour: { value: '9' },
      editMinute: { value: '30' },
      editMinutes: { value: '25' },
      editSeconds: { value: '0' },
      editHolidayHour: { value: '9' },
      editHolidayMinute: { value: '0' },
      holidayChecklist: { querySelectorAll: vi.fn(() => []) },
      HOLIDAY_PRESETS,
      editAnniMonth: { value: '1', classList: { add: vi.fn() } },
      editAnniDay: { value: '1', classList: { add: vi.fn() } },
      editAnniHour: { value: '9' },
      editAnniMinute: { value: '0' },
      editUseImageCheckbox: { checked: false },
      selectedEditColor: 'blue',
      editImageData: '',
      stopCountdownFn: vi.fn(),
    });

    expect(tasks).toHaveLength(1);
    expect(tasks[0].type).toBe('alarm');
    expect(tasks[0].label).toBe('晨会');
    expect(tasks[0].msg).toBe('开会啦');
    expect(tasks[0].hour).toBe(9);
    expect(tasks[0].minute).toBe(30);
    expect(tasks[0].group).toBe('work');
    expect(saveTasks).toHaveBeenCalledWith(tasks);
    expect(renderTasksFn).toHaveBeenCalled();
  });

  it('creates multiple holiday tasks when multiple presets are selected', () => {
    globalThis.document = {
      querySelector: vi.fn(() => ({ dataset: { type: 'holiday' } })),
      querySelectorAll: vi.fn(() => []),
      getElementById: vi.fn(() => null),
    };

    const tasks = [];
    const saveTasks = vi.fn();
    const renderTasksFn = vi.fn();

    saveModal(null, {
      modal: { classList: { add: vi.fn() } },
      modalError: { textContent: '', classList: { add: vi.fn(), remove: vi.fn() } },
      tasks,
      saveTasks,
      getCleanTasksFn: (value) => value,
      renderTasksFn,
      editLabel: { value: '' },
      editMsg: { value: '节日快乐' },
      editGroup: { value: '' },
      editingId: null,
      editFlightMode: { value: 'once' },
      editLoopCount: { value: '3' },
      editLoopInterval: { value: '5' },
      editIntervalCount: { value: '10' },
      editPostFlightAction: { value: 'none' },
      editPostFlightAppPath: { value: '' },
      editPostFlightUrl: { value: '' },
      editPostFlightFolder: { value: '' },
      editPostFlightScript: { value: '' },
      editHour: { value: '9' },
      editMinute: { value: '30' },
      editMinutes: { value: '25' },
      editSeconds: { value: '0' },
      editHolidayHour: { value: '8' },
      editHolidayMinute: { value: '15' },
      holidayChecklist: {
        querySelectorAll: vi.fn(() => [
          { value: 'new_year' },
          { value: 'christmas' },
        ]),
      },
      HOLIDAY_PRESETS,
      editAnniMonth: { value: '1', classList: { add: vi.fn() } },
      editAnniDay: { value: '1', classList: { add: vi.fn() } },
      editAnniHour: { value: '9' },
      editAnniMinute: { value: '0' },
      editUseImageCheckbox: { checked: false },
      selectedEditColor: 'gold',
      editImageData: '',
      stopCountdownFn: vi.fn(),
    });

    expect(tasks).toHaveLength(2);
    expect(tasks[0].holidayKey).toBe('new_year');
    expect(tasks[1].holidayKey).toBe('christmas');
    expect(tasks[0].msg).toBe('节日快乐');
    expect(tasks[1].msg).toBe('');
    expect(saveTasks).toHaveBeenCalledWith(tasks);
    expect(renderTasksFn).toHaveBeenCalled();
  });
});
