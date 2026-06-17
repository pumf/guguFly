import { describe, it, expect } from 'vitest';
import { validateBackup, BACKUP_KIND, BACKUP_VERSION } from '../src/backup.js';

describe('validateBackup', () => {
  it('rejects non-object', () => {
    expect(validateBackup(null)).toBe('文件不是有效的备份');
    expect(validateBackup(123)).toBe('文件不是有效的备份');
    expect(validateBackup('string')).toBe('文件不是有效的备份');
  });

  it('rejects wrong kind', () => {
    expect(validateBackup({ kind: 'other', tasks: [] })).toBe('不是咕咕机长的备份文件');
  });

  it('rejects missing tasks array', () => {
    expect(validateBackup({ kind: BACKUP_KIND })).toBe('备份里没有任务数据');
    expect(validateBackup({ kind: BACKUP_KIND, tasks: 'not-array' })).toBe('备份里没有任务数据');
  });

  it('rejects tasks with invalid type', () => {
    const data = { kind: BACKUP_KIND, tasks: [{ id: 1, type: 'unknown' }] };
    expect(validateBackup(data)).toBe('存在未知任务类型：unknown');
  });

  it('rejects tasks without id', () => {
    const data = { kind: BACKUP_KIND, tasks: [{ type: 'alarm' }] };
    expect(validateBackup(data)).toBe('任务缺少 id');
  });

  it('rejects tasks with non-number id', () => {
    const data = { kind: BACKUP_KIND, tasks: [{ id: 'abc', type: 'alarm' }] };
    expect(validateBackup(data)).toBe('任务缺少 id');
  });

  it('rejects non-object task', () => {
    const data = { kind: BACKUP_KIND, tasks: [null] };
    expect(validateBackup(data)).toBe('任务数据格式不正确');
    const data2 = { kind: BACKUP_KIND, tasks: ['string'] };
    expect(validateBackup(data2)).toBe('任务数据格式不正确');
  });

  it('accepts valid backup data', () => {
    const data = {
      kind: BACKUP_KIND,
      version: BACKUP_VERSION,
      tasks: [
        { id: 1, type: 'alarm', enabled: true, hour: 8, minute: 0 },
        { id: 2, type: 'countdown', enabled: true, minutes: 25 },
        { id: 3, type: 'holiday', enabled: true, month: 12, day: 25 },
        { id: 4, type: 'anniversary', enabled: true, month: 1, day: 1 },
      ],
    };
    expect(validateBackup(data)).toBeNull();
  });

  it('accepts backup with empty tasks', () => {
    const data = { kind: BACKUP_KIND, version: BACKUP_VERSION, tasks: [] };
    expect(validateBackup(data)).toBeNull();
  });
});
