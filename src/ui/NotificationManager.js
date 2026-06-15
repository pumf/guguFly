import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';

let notificationPermissionGranted = false;

export async function initNotificationPermission() {
  try {
    notificationPermissionGranted = await isPermissionGranted();
    if (!notificationPermissionGranted) {
      const result = await requestPermission();
      notificationPermissionGranted = result === 'granted';
    }
  } catch (e) {
    notificationPermissionGranted = false;
  }
}

export function notifyFlightTriggered(taskLabel, msg) {
  if (!notificationPermissionGranted) return;
  try {
    sendNotification({
      title: taskLabel ? `✈ ${taskLabel}` : '✈ 咕咕机长',
      body: msg || '该任务已触发',
    });
  } catch (e) {}
}
