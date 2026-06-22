import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initTaskFilter } from '../src/ui/TaskFilter.js';

describe('TaskFilter', () => {
  let originalDocument;

  beforeEach(() => {
    originalDocument = globalThis.document;
  });

  afterEach(() => {
    globalThis.document = originalDocument;
  });

  it('filters task list through search and selects', () => {
    const handlers = {};
    const taskSearchInput = {
      value: '',
      addEventListener: vi.fn((type, handler) => { handlers[`search:${type}`] = handler; }),
      focus: vi.fn(),
    };
    const taskSearchClear = { hidden: true, addEventListener: vi.fn((type, handler) => { handlers[`clear:${type}`] = handler; }) };
    const taskTypeSelect = {
      value: 'all',
      addEventListener: vi.fn((type, handler) => { handlers[`type:${type}`] = handler; }),
    };
    const taskGroupSelect = {
      value: 'all',
      addEventListener: vi.fn((type, handler) => { handlers[`group:${type}`] = handler; }),
    };

    globalThis.document = {
      getElementById: vi.fn((id) => {
        if (id === 'taskSearchInput') return taskSearchInput;
        if (id === 'taskSearchClear') return taskSearchClear;
        if (id === 'taskTypeSelect') return taskTypeSelect;
        if (id === 'taskGroupSelect') return taskGroupSelect;
        return null;
      }),
    };

    const renderTaskView = vi.fn();
    const getState = initTaskFilter({ renderTaskView });

    handlers['search:input']();
    taskSearchInput.value = '会议';
    handlers['search:input']();
    expect(renderTaskView).toHaveBeenCalled();
    expect(getState().taskSearchKeyword).toBe('会议');
    expect(taskSearchClear.hidden).toBe(false);

    handlers['search:keydown']({ key: 'Escape', stopPropagation: vi.fn() });
    expect(taskSearchInput.value).toBe('');
    expect(getState().taskSearchKeyword).toBe('');

    taskTypeSelect.value = 'alarm';
    handlers['type:change']();
    expect(getState().taskTypeFilter).toBe('alarm');

    taskGroupSelect.value = 'work';
    handlers['group:change']();
    expect(getState().taskGroupFilter).toBe('work');
  });
});