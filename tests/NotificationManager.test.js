import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  isPermissionGranted: vi.fn(),
  requestPermission: vi.fn(),
  sendNotification: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-notification', () => ({
  isPermissionGranted: mocks.isPermissionGranted,
  requestPermission: mocks.requestPermission,
  sendNotification: mocks.sendNotification,
}));

import { initNotificationPermission, notifyFlightTriggered } from '../src/ui/NotificationManager.js';

describe('NotificationManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests permission when not yet granted', async () => {
    mocks.isPermissionGranted.mockResolvedValueOnce(false);
    mocks.requestPermission.mockResolvedValueOnce('granted');

    await initNotificationPermission();

    expect(mocks.isPermissionGranted).toHaveBeenCalled();
    expect(mocks.requestPermission).toHaveBeenCalled();
  });

  it('does not send notification when permission is denied', async () => {
    mocks.isPermissionGranted.mockResolvedValueOnce(false);

    await notifyFlightTriggered('喝水', '记得喝水', 'alarm');

    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });

  it('sends typed notification when permission is granted', async () => {
    mocks.isPermissionGranted.mockResolvedValueOnce(true);

    await notifyFlightTriggered('喝水', '记得喝水', 'alarm');

    expect(mocks.sendNotification).toHaveBeenCalledWith({
      title: '⏰ 喝水',
      body: '记得喝水',
    });
  });

  it('swallows permission lookup errors', async () => {
    mocks.isPermissionGranted.mockRejectedValueOnce(new Error('denied'));

    await expect(notifyFlightTriggered('任务', '内容', 'alarm')).resolves.toBeUndefined();
    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });
});
