import { FoodItem } from '../types/food';

const mockItems: FoodItem[] = [
  { id: '1', name: '牛乳', stockLevel: 2, tags: [], location: 'fridge', expiryDate: '2099-12-31' },
  { id: '3', name: 'ハム', stockLevel: 1, tags: [], location: 'fridge' },
  { id: '4', name: '豆腐', stockLevel: 1, tags: [], location: 'fridge', expiryDate: '2000-01-01' },
  { id: '5', name: 'ヨーグルト', stockLevel: 0, tags: [], location: 'fridge', expiryDate: '2000-02-01' },
  { id: '6', name: 'レタス', stockLevel: 1, tags: [], location: 'vegetable', expiryDate: '2000-01-01' },
];
const mockRepo = {
  getAll: jest.fn(),
  add: jest.fn(),
  update: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn(),
  updateStock: jest.fn(),
};

jest.mock('../hooks/useRepository', () => ({ useRepository: () => mockRepo }));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('../context/SharingContext', () => ({ useSharing: () => ({ ownerUid: null }) }));
jest.mock('../context/AppSettingsContext', () => ({
  useAppSettings: () => ({ statusMode: '3step' }),
}));
jest.mock('../services/PushNotificationService', () => ({
  getManualNotifyState: jest.fn(),
  sendManualNotifyToGroup: jest.fn(),
  ManualNotifyRateLimitedError: class extends Error {},
  NoRecipientsError: class extends Error {},
  MANUAL_NOTIFY_COOLDOWN_MS: 300000,
}));

import React from 'react';
import { Alert, AlertButton } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import StorageScreen from '../screens/StorageScreen';

function pressAlertButton(text: string) {
  const buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)[2] as AlertButton[];
  act(() => buttons.find((b) => b.text === text)!.onPress?.());
}

async function renderScreen() {
  const utils = render(<StorageScreen onOpenSettings={jest.fn()} />);
  await waitFor(() => expect(utils.getByTestId('btn-add-food')).toBeTruthy());
  return utils;
}

// 最初のテストで StorageScreen とその依存モジュールを読み込むため、CI では既定の5秒を超えることがある
jest.setTimeout(20000);

describe('StorageScreen 期限切れの賞味期限の一括削除', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo.getAll.mockResolvedValue(mockItems.map((item) => ({ ...item })));
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('表示中の保管場所で期限切れの件数をボタンに表示する', async () => {
    const { getByTestId } = await renderScreen();
    expect(getByTestId('btn-clear-expired-dates')).toHaveTextContent('期限切れの賞味期限を削除（2件）');
  });

  it('確認して削除すると、期限切れの食材の賞味期限だけを消して保存する', async () => {
    const { getByTestId, queryByTestId } = await renderScreen();

    fireEvent.press(getByTestId('btn-clear-expired-dates'));
    expect(Alert.alert).toHaveBeenCalledWith(
      '賞味期限の削除',
      expect.stringContaining('2件'),
      expect.any(Array),
    );
    pressAlertButton('削除する');

    await waitFor(() => expect(mockRepo.update).toHaveBeenCalledTimes(2));
    expect(mockRepo.update).toHaveBeenCalledWith(expect.objectContaining({ id: '4', expiryDate: undefined }));
    expect(mockRepo.update).toHaveBeenCalledWith(expect.objectContaining({ id: '5', expiryDate: undefined }));
    // 食材は残り、賞味期限はハイフン表示になる
    expect(getByTestId('expiry-4')).toHaveTextContent('賞味期限 ----年-月-日');
    expect(queryByTestId('expiry-badge-4')).toBeNull();
    // 期限内の食材はそのまま
    expect(getByTestId('expiry-1')).toHaveTextContent('賞味期限 2099年12月31日');
    // 対象がなくなるとボタンを隠す
    expect(queryByTestId('btn-clear-expired-dates')).toBeNull();
  });

  it('キャンセルすると何も変更しない', async () => {
    const { getByTestId } = await renderScreen();

    fireEvent.press(getByTestId('btn-clear-expired-dates'));
    pressAlertButton('キャンセル');

    expect(mockRepo.update).not.toHaveBeenCalled();
    expect(getByTestId('expiry-badge-4')).toBeTruthy();
  });

  it('期限切れがない保管場所ではボタンを表示しない', async () => {
    const { getByTestId, queryByTestId } = await renderScreen();
    fireEvent.press(getByTestId('tab-pantry'));
    expect(queryByTestId('btn-clear-expired-dates')).toBeNull();
  });

  it('賞味期限順の表示中は保管場所をまたいで対象にする', async () => {
    const { getByTestId } = await renderScreen();
    fireEvent.press(getByTestId('btn-expiry-sort-view'));
    expect(getByTestId('btn-clear-expired-dates')).toHaveTextContent('期限切れの賞味期限を削除（3件）');
  });
});
