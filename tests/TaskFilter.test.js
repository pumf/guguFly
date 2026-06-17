import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initTaskFilter } from '../src/ui/TaskFilter.js';

function createChip(dataset) {
  return {
    dataset,
    classList: { toggle: vi.fn() },
    addEventListener: vi.fn(),
  };
}

describe('TaskFilter', () => {
  let originalDocument;

  beforeEach(() => {
    originalDocument = globalThis.document;
  });

  afterEach(() => {
    globalThis.document = originalDocument;
  });

  it('filters task list through search and chips', () => {
    const handlers = {};
    const taskSearchInput = {
      value: '',
      addEventListener: vi.fn((type, handler) => { handlers[`search:${type}`] = handler; }),
      focus: vi.fn(),
    };
    const taskSearchClear = { hidden: true, addEventListener: vi.fn((type, handler) => { handlers[`clear:${type}`] = handler; }) };
    const typeChip = createChip({ type: 'alarm' });
    const groupChip = createChip({ group: 'work' });

    globalThis.document = {
      getElementById: vi.fn((id) => {
        if (id === 'taskSearchInput') return taskSearchInput;
        if (id === 'taskSearchClear') return taskSearchClear;
        return null;
      }),
      querySelectorAll: vi.fn((selector) => {
        if (selector === '.task-type-chip[data-type]') return [typeChip];
        if (selector === '.task-type-chip[data-group]') return [groupChip];
        return [];
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

    typeChip.addEventListener.mock.calls[0][1]();
    expect(getState().taskTypeFilter).toBe('alarm');
    expect(typeChip.classList.toggle).toHaveBeenCalledWith('is-active', true);

    groupChip.addEventListener.mock.calls[0][1]();
    expect(getState().taskGroupFilter).toBe('work');
    expect(groupChip.classList.toggle).toHaveBeenCalledWith('is-active', true);
  });
});
