import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';

export function detectTauriRuntime() {
  try {
    getCurrentWebviewWindow();
    return true;
  } catch {
    return false;
  }
}
