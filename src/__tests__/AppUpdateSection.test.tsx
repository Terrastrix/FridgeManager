const mockFetchLatestUpdate = jest.fn();
const mockRestart = jest.fn().mockResolvedValue(undefined);
let mockInfo = {
  isEnabled: true,
  runtimeVersion: '1.0.0' as string | null,
  channel: 'production' as string | null,
  isEmbeddedLaunch: true,
  createdAt: null as Date | null,
};

jest.mock('../services/AppUpdateService', () => ({
  ...jest.requireActual('../services/AppUpdateService'),
  getCurrentUpdateInfo: () => mockInfo,
  fetchLatestUpdate: () => mockFetchLatestUpdate(),
  restartToApplyUpdate: () => mockRestart(),
}));
jest.mock('expo-updates', () => ({}));

import React from 'react';
import { Alert, AlertButton } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import AppUpdateSection from '../components/AppUpdateSection';

function lastAlert() {
  const call = (Alert.alert as jest.Mock).mock.calls.at(-1);
  return { title: call[0] as string, buttons: (call[2] ?? []) as AlertButton[] };
}

describe('AppUpdateSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInfo = { isEnabled: true, runtimeVersion: '1.0.0', channel: 'production', isEmbeddedLaunch: true, createdAt: null };
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('今動いている内容とランタイムバージョンを表示する', () => {
    const { getByTestId } = render(<AppUpdateSection />);
    expect(getByTestId('app-update-current')).toHaveTextContent('現在の内容: アプリに内蔵された版');
    expect(getByTestId('app-update-runtime')).toHaveTextContent('ランタイムバージョン 1.0.0（production）');
  });

  it('更新が無効なビルドでは確認ボタンを出さない', () => {
    mockInfo = { ...mockInfo, isEnabled: false, runtimeVersion: null, channel: null };
    const { queryByTestId, getByTestId } = render(<AppUpdateSection />);
    expect(queryByTestId('btn-check-update')).toBeNull();
    expect(getByTestId('app-update-current')).toHaveTextContent('現在の内容: 開発用のビルド（更新は無効）');
  });

  it('新しい更新をダウンロードしたら、再起動するか確認して再起動する', async () => {
    mockFetchLatestUpdate.mockResolvedValue('downloaded');
    const { getByTestId } = render(<AppUpdateSection />);

    fireEvent.press(getByTestId('btn-check-update'));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    const { title, buttons } = lastAlert();
    expect(title).toBe('更新があります');

    await act(async () => {
      buttons.find((b) => b.text === '再起動する')!.onPress!();
    });
    expect(mockRestart).toHaveBeenCalledTimes(1);
  });

  it('最新なら最新である旨を伝え、再起動しない', async () => {
    mockFetchLatestUpdate.mockResolvedValue('upToDate');
    const { getByTestId } = render(<AppUpdateSection />);

    fireEvent.press(getByTestId('btn-check-update'));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('最新の状態です', expect.any(String)));
    expect(mockRestart).not.toHaveBeenCalled();
  });

  it('確認に失敗したらエラーを伝える', async () => {
    mockFetchLatestUpdate.mockRejectedValue(new Error('network'));
    const { getByTestId } = render(<AppUpdateSection />);

    fireEvent.press(getByTestId('btn-check-update'));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('更新を確認できませんでした', 'network'));
  });
});
