const BACKUP_VERSION = 1;
const BACKUP_KIND = 'gugufly-tasks';

const EXPORTABLE_KEYS = [
  'speed', 'height', 'effect', 'plane', 'particle', 'bubble', 'bubblePosition',
  'sound', 'soundMode', 'useSound', 'useImage', 'muted',
];

function pad2(n) { return String(n).padStart(2, '0'); }

function formatDateForFile(date = new Date()) {
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}-${pad2(date.getHours())}${pad2(date.getMinutes())}`;
}

function buildBackupPayload(tasks, settingsMap) {
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
    appVersion: '0.1.0',
    tasks,
    settings: exportedSettings,
  };
}

function validateBackup(data) {
  if (!data || typeof data !== 'object') return '文件不是有效的备份';
  if (data.kind !== BACKUP_KIND) return '不是咕咕机长的备份文件';
  if (!Array.isArray(data.tasks)) return '备份里没有任务数据';
  for (const t of data.tasks) {
    if (!t || typeof t !== 'object') return '任务数据格式不正确';
    if (!['alarm', 'countdown', 'holiday', 'anniversary'].includes(t.type)) {
      return `存在未知任务类型：${t.type}`;
    }
    if (typeof t.id !== 'number') return '任务缺少 id';
  }
  return null;
}

export function exportTasksAsJson(tasks, settingsMap = {}) {
  const payload = buildBackupPayload(tasks, settingsMap);
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
      } catch (e) {
        reject(new Error('文件不是合法 JSON'));
      }
    };
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsText(file);
  });
}

export { validateBackup, BACKUP_KIND, BACKUP_VERSION };
