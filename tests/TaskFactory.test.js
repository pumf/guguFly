import { describe, it, expect } from 'vitest';
import {
  createAlarmTask,
  createCountdownTask,
  createHolidayTask,
  createAnniversaryTask,
  createBaseTask,
  cloneTask,
  getTaskTypeMeta,
  setNextId,
  getNextId,
} from '../src/tasks/TaskFactory.js';

describe('createBaseTask', () => {
  it('creates task with required defaults', () => {
    const task = createBaseTask('alarm');
    expect(task.type).toBe('alarm');
    expect(task.enabled).toBe(true);
    expect(task.flightMode).toBe('once');
    expect(task.imageData).toBeNull();
    expect(task.color).toBeNull();
    expect(task.id).toBeGreaterThan(0);
  });
});

describe('createAlarmTask', () => {
  it('creates alarm with defaults', () => {
    const task = createAlarmTask();
    expect(task.type).toBe('alarm');
    expect(task.hour).toBe(12);
    expect(task.minute).toBe(0);
    expect(task.repeat).toEqual([]);
    expect(task._lastTriggeredDate).toBeNull();
  });
});

describe('createCountdownTask', () => {
  it('creates countdown with defaults', () => {
    const task = createCountdownTask();
    expect(task.type).toBe('countdown');
    expect(task.duration).toBe(1800);
    expect(task._remaining).toBe(1800);
    expect(task._status).toBe('idle');
  });
});

describe('createHolidayTask', () => {
  it('creates holiday with defaults', () => {
    const task = createHolidayTask();
    expect(task.type).toBe('holiday');
    expect(task.holidayKey).toBe('new_year');
    expect(task.month).toBe(1);
    expect(task.day).toBe(1);
  });
});

describe('createAnniversaryTask', () => {
  it('creates anniversary with current date', () => {
    const task = createAnniversaryTask();
    expect(task.type).toBe('anniversary');
    expect(task.hour).toBe(9);
    expect(task.minute).toBe(0);
  });
});

describe('cloneTask', () => {
  it('clones and resets runtime state', () => {
    const original = createCountdownTask();
    original._status = 'running';
    original._remaining = 500;
    const cloned = cloneTask(original);
    expect(cloned._status).toBe('idle');
    expect(cloned._remaining).toBe(original.duration);
    expect(cloned._timer).toBeNull();
    expect(cloned.id).toBe(original.id);
  });
});

describe('getTaskTypeMeta', () => {
  it('returns alarm meta', () => {
    const meta = getTaskTypeMeta({ type: 'alarm' });
    expect(meta.label).toBe('定时');
    expect(meta.className).toBe('alarm');
  });
  it('returns countdown meta', () => {
    const meta = getTaskTypeMeta({ type: 'countdown' });
    expect(meta.label).toBe('倒计时');
  });
  it('returns holiday meta', () => {
    const meta = getTaskTypeMeta({ type: 'holiday' });
    expect(meta.label).toBe('节假日');
  });
  it('returns default for unknown', () => {
    const meta = getTaskTypeMeta({ type: 'unknown' });
    expect(meta.label).toBe('任务');
  });
});

describe('setNextId / getNextId', () => {
  it('manages id counter', () => {
    setNextId(100);
    expect(getNextId()).toBe(100);
  });
});
