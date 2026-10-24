jest.mock('../context/AppSettingsContext', () => ({
  useAppSettings: () => ({ statusMode: '3step' }),
}));

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import FoodItemCard from '../components/storage/FoodItemCard';
import AddFoodModal from '../components/storage/AddFoodModal';
import EditFoodModal from '../components/storage/EditFoodModal';
import PurchasedModal from '../components/recipe/PurchasedModal';
import { FoodItem } from '../types/food';
import { toISODate } from '../utils/foodDates';

function food(overrides: Partial<FoodItem>): FoodItem {
  return { id: '1', name: '牛乳', stockLevel: 2, tags: [], location: 'fridge', ...overrides };
}

function renderCard(item: FoodItem) {
  return render(
    <FoodItemCard
      item={item}
      isSimple={false}
      showDeleteButton={false}
      onStockChange={jest.fn()}
      onDelete={jest.fn()}
      onEdit={jest.fn()}
      onToggleView={jest.fn()}
    />,
  );
}

describe('FoodItemCard の日付表示', () => {
  it('賞味期限が未設定ならハイフンで表示する', () => {
    const { getByTestId } = renderCard(food({ id: '3', name: 'ハム' }));
    expect(getByTestId('expiry-3')).toHaveTextContent('賞味期限 ----年-月-日');
  });

  it('賞味期限が設定されていれば年月日で表示する', () => {
    const { getByTestId } = renderCard(food({ expiryDate: '2099-12-31' }));
    expect(getByTestId('expiry-1')).toHaveTextContent('賞味期限 2099年12月31日');
  });

  it('冷凍庫の食材は購入日を表示し、期限切れバッジは出さない', () => {
    const { getByTestId, queryByTestId } = renderCard(
      food({ id: '10', location: 'freezer', purchaseDate: '2026-03-20', expiryDate: '2000-01-01' }),
    );
    expect(getByTestId('purchase-date-10')).toHaveTextContent('購入日 2026年3月20日');
    expect(queryByTestId('expiry-10')).toBeNull();
    expect(queryByTestId('expiry-badge-10')).toBeNull();
  });

  it('パントリーの購入日が未設定ならハイフンで表示する', () => {
    const { getByTestId } = renderCard(food({ id: '14', location: 'pantry' }));
    expect(getByTestId('purchase-date-14')).toHaveTextContent('購入日 ----年-月-日');
  });
});

describe('AddFoodModal', () => {
  it('冷蔵庫では賞味期限と目安日数を入力する', () => {
    const { getByTestId, queryByTestId, getByText } = render(
      <AddFoodModal visible location="fridge" onAdd={jest.fn()} onClose={jest.fn()} />,
    );
    expect(getByText('賞味期限')).toBeTruthy();
    expect(getByTestId('add-food-expiry-input')).toBeTruthy();
    expect(getByTestId('add-food-expiry-days-input')).toBeTruthy();
    expect(queryByTestId('add-food-purchase-date-input')).toBeNull();
  });

  it('パントリーでは購入日だけを入力し、目安日数の欄を出さない', () => {
    const { getByTestId, queryByTestId, getByText, queryByText } = render(
      <AddFoodModal visible location="pantry" onAdd={jest.fn()} onClose={jest.fn()} />,
    );
    expect(getByText('購入日')).toBeTruthy();
    expect(queryByText('賞味期限')).toBeNull();
    expect(getByTestId('add-food-purchase-date-input')).toBeTruthy();
    expect(queryByTestId('add-food-expiry-input')).toBeNull();
    expect(queryByTestId('add-food-expiry-days-input')).toBeNull();
  });

  it('冷凍庫に追加した食材は賞味期限も目安日数も持たない', () => {
    const onAdd = jest.fn();
    const { getByTestId } = render(
      <AddFoodModal visible location="freezer" onAdd={onAdd} onClose={jest.fn()} />,
    );
    fireEvent.changeText(getByTestId('add-food-name-input'), '冷凍うどん');
    fireEvent.press(getByTestId('add-food-submit'));

    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ name: '冷凍うどん', location: 'freezer', defaultExpiryDays: undefined }),
    );
    expect(onAdd.mock.calls[0][0].expiryDate).toBeUndefined();
  });
});

describe('EditFoodModal', () => {
  it('パントリーの食材は購入日を編集し、保存しても目安日数は残す', () => {
    const onSave = jest.fn();
    const item = food({ id: '13', name: '米', location: 'pantry', purchaseDate: '2026-03-15', defaultExpiryDays: 365 });
    const { getByTestId, queryByTestId } = render(
      <EditFoodModal visible item={item} onSave={onSave} onClose={jest.fn()} />,
    );
    expect(getByTestId('edit-food-purchase-date-input')).toHaveTextContent(/2026年3月15日/);
    expect(queryByTestId('edit-food-expiry-days-input')).toBeNull();

    fireEvent.press(getByTestId('edit-food-submit'));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ id: '13', purchaseDate: '2026-03-15', expiryDate: undefined, defaultExpiryDays: 365 }),
    );
  });

  it('購入日をクリアして保存できる', () => {
    const onSave = jest.fn();
    const item = food({ id: '13', location: 'pantry', purchaseDate: '2026-03-15' });
    const { getByTestId } = render(
      <EditFoodModal visible item={item} onSave={onSave} onClose={jest.fn()} />,
    );
    fireEvent.press(getByTestId('edit-food-purchase-date-input-clear'));
    fireEvent.press(getByTestId('edit-food-submit'));
    expect(onSave.mock.calls[0][0].purchaseDate).toBeUndefined();
  });

  it('冷蔵庫の食材は賞味期限を編集する', () => {
    const onSave = jest.fn();
    const item = food({ expiryDate: '2026-04-08', defaultExpiryDays: 7 });
    const { getByTestId } = render(
      <EditFoodModal visible item={item} onSave={onSave} onClose={jest.fn()} />,
    );
    expect(getByTestId('edit-food-expiry-input')).toHaveTextContent(/2026年4月8日/);

    fireEvent.press(getByTestId('edit-food-submit'));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ expiryDate: '2026-04-08', purchaseDate: undefined, defaultExpiryDays: 7 }),
    );
  });
});

describe('PurchasedModal', () => {
  const shoppingItem = { id: 's1', name: '冷凍餃子', checked: false };

  it('冷凍庫の食材を買ってきたら購入日（今日）を初期値にする', () => {
    const onConfirm = jest.fn();
    const matched = food({ id: '10', name: '冷凍餃子', location: 'freezer', defaultExpiryDays: 90 });
    const { getByTestId, getByText } = render(
      <PurchasedModal visible item={shoppingItem} matchedFood={matched} onConfirm={onConfirm} onClose={jest.fn()} />,
    );
    expect(getByText('購入日')).toBeTruthy();
    fireEvent.press(getByTestId('purchased-submit'));
    expect(onConfirm).toHaveBeenCalledWith(toISODate(new Date()), 'freezer');
  });

  it('新しい食材の保管場所をパントリーに切り替えると購入日の入力になる', () => {
    const onConfirm = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <PurchasedModal visible item={shoppingItem} matchedFood={null} onConfirm={onConfirm} onClose={jest.fn()} />,
    );
    expect(getByTestId('purchased-expiry-input')).toBeTruthy();

    fireEvent.press(getByTestId('purchased-location-pantry'));
    expect(getByTestId('purchased-purchase-date-input')).toBeTruthy();
    expect(queryByTestId('purchased-expiry-input')).toBeNull();

    fireEvent.press(getByTestId('purchased-submit'));
    expect(onConfirm).toHaveBeenCalledWith(toISODate(new Date()), 'pantry');
  });
});
