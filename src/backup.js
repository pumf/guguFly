import { t as _t } from './i18n/index.js';
import { pad2 } from './tasks/TaskUtils.js';

const BACKUP_VERSION = 1;
const BACKUP_KIND = 'gugufly-tasks';

const EXPORTABLE_KEYS = [
  'speed', 'height', 'effect', 'plane', 'particle', 'bubble', 'bubblePosition',
  'sound', 'soundMode', 'useSound', 'useImage', 'muted',
];

function formatDateForFile(date = new Date()) {
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}-${pad2(date.getHours())}${pad2(date.getMinutes())}`;
}

function buildBackupPayload(tasks, settingsMap, appVersion) {
  const exportedSettings = {};
  for (const key of EXPORTABLE_KEYS) {
    if (settingsMap[key] !== undefined) {
      exportedSettings[key] = settingsMap[key];
    }
  }
  return {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: appVersion || '0.0.0',
    tasks,
    settings: exportedSettings,
  };
}

function validateBackup(data) {
  if (!data || typeof data !== 'object') return _t('error.backup_invalid');
  if (data.kind !== BACKUP_KIND) return _t('error.backup_not_gugu');
  if (!Array.isArray(data.tasks)) return _t('error.backup_no_data');
  for (const task of data.tasks) {
    if (!task || typeof task !== 'object') return _t('error.backup_format');
    if (!['alarm', 'countdown', 'holiday', 'anniversary'].includes(task.type)) {
      return _t('error.backup_unknown_type', { type: task.type });
    }
    if (typeof task.id !== 'number') return _t('error.backup_missing_id');
  }
  return null;
}

export function exportTasksAsJson(tasks, settingsMap = {}, appVersion) {
  const payload = buildBackupPayload(tasks, settingsMap, appVersion);
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `gugufly-backup-${formatDateForFile()}.json`;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 0);
  return payload.tasks.length;
}

export function readBackupFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const err = validateBackup(data);
        if (err) return reject(new Error(err));
        resolve(data);
      } catch {
        reject(new Error(_t('error.backup_not_json')));
      }
    };
    reader.onerror = () => reject(new Error(_t('error.backup_read_failed')));
    reader.readAsText(file);
  });
}

export { validateBackup, BACKUP_KIND, BACKUP_VERSION };
