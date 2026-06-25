import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';

let notificationPermissionGranted = false;

export async function initNotificationPermission() {
  try {
    notificationPermissionGranted = await isPermissionGranted();
    if (!notificationPermissionGranted) {
      const result = await requestPermission();
      notificationPermissionGranted = result === 'granted';
    }
  } catch {
    notificationPermissionGranted = false;
  }
}

// Map task type / category to a distinguishing emoji so the user
// can tell at a glance what kind of flight is starting.
function titleForTask(taskLabel, taskType) {
  const label = taskLabel || '咕咕机长';
  switch (taskType) {
    case 'holiday': return `🎉 ${label}`;
    case 'anniversary': return `💝 ${label}`;
    case 'alarm': return `⏰ ${label}`;
    case 'countdown': return `⏱ ${label}`;
    default: return `✈ ${label}`;
  }
}

export async function notifyFlightTriggered(taskLabel, msg, taskType) {
  try {
    const grantedNow = await isPermissionGranted();
    if (!grantedNow) return;
  } catch {
    return;
  }
  try {
    sendNotification({
      title: titleForTask(taskLabel, taskType),
      body: msg || '该任务已触发',
    });
  } catch (error) {
    console.error('send notification failed:', error);
  }
}
