// import は jest.mock の外の変数より先に評価されるので、モックの状態はファクトリの中で作り、
// テストからは jest.requireMock で同じオブジェクトを操作する
jest.mock('expo-updates', () => ({
  __esModule: true,
  isEnabled: true,
  runtimeVersion: '1.0.0',
  channel: 'production',
  isEmbeddedLaunch: true,
  createdAt: null,
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn().mockResolvedValue({}),
  reloadAsync: jest.fn().mockResolvedValue(undefined),
}));

import {
  currentContentLabel,
  fetchLatestUpdate,
  getCurrentUpdateInfo,
  restartToApplyUpdate,
  CurrentUpdateInfo,
} from '../services/AppUpdateService';

const mockUpdates = jest.requireMock('expo-updates') as {
  isEnabled: boolean;
  checkForUpdateAsync: jest.Mock;
  fetchUpdateAsync: jest.Mock;
  reloadAsync: jest.Mock;
};

describe('AppUpdateService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdates.isEnabled = true;
  });

  describe('fetchLatestUpdate', () => {
    it('更新が無効なら確認しない', async () => {
      mockUpdates.isEnabled = false;
      await expect(fetchLatestUpdate()).resolves.toBe('disabled');
      expect(mockUpdates.checkForUpdateAsync).not.toHaveBeenCalled();
    });

    it('新しい更新がなければダウンロードしない', async () => {
      mockUpdates.checkForUpdateAsync.mockResolvedValue({ isAvailable: false });
      await expect(fetchLatestUpdate()).resolves.toBe('upToDate');
      expect(mockUpdates.fetchUpdateAsync).not.toHaveBeenCalled();
    });

    it('新しい更新があればダウンロードする', async () => {
      mockUpdates.checkForUpdateAsync.mockResolvedValue({ isAvailable: true });
      await expect(fetchLatestUpdate()).resolves.toBe('downloaded');
      expect(mockUpdates.fetchUpdateAsync).toHaveBeenCalledTimes(1);
    });

    it('確認に失敗したらエラーをそのまま返す', async () => {
      mockUpdates.checkForUpdateAsync.mockRejectedValue(new Error('network'));
      await expect(fetchLatestUpdate()).rejects.toThrow('network');
    });
  });

  it('restartToApplyUpdate はアプリを再読み込みする', async () => {
    await restartToApplyUpdate();
    expect(mockUpdates.reloadAsync).toHaveBeenCalledTimes(1);
  });

  it('getCurrentUpdateInfo は expo-updates の状態を返す', () => {
    expect(getCurrentUpdateInfo()).toEqual({
      isEnabled: true,
      runtimeVersion: '1.0.0',
      channel: 'production',
      isEmbeddedLaunch: true,
      createdAt: null,
    });
  });

  describe('currentContentLabel', () => {
    const base: CurrentUpdateInfo = {
      isEnabled: true,
      runtimeVersion: '1.0.0',
      channel: 'production',
      isEmbeddedLaunch: true,
      createdAt: null,
    };

    it('更新が無効なら開発用のビルドと表示する', () => {
      expect(currentContentLabel({ ...base, isEnabled: false })).toBe('開発用のビルド（更新は無効）');
    });

    it('内蔵の JavaScript で動いていればその旨を表示する', () => {
      expect(currentContentLabel(base)).toBe('アプリに内蔵された版');
    });

    it('配信された更新で動いていれば、その更新の日時を表示する', () => {
      expect(
        currentContentLabel({ ...base, isEmbeddedLaunch: false, createdAt: new Date(2026, 9, 25, 9, 5) }),
      ).toBe('2026年10月25日 9:05 に配信された更新');
    });
  });
});
