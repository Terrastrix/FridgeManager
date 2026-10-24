import {
  dateKindFor,
  formatJapaneseDate,
  getFoodDate,
  initialDateOnPurchase,
  normalizeFoodDates,
  toISODate,
  withFoodDate,
  UNSET_DATE_LABEL,
} from '../utils/foodDates';
import { FoodItem } from '../types/food';

function food(overrides: Partial<FoodItem>): FoodItem {
  return { id: '1', name: '牛乳', stockLevel: 2, tags: [], location: 'fridge', ...overrides };
}

describe('dateKindFor', () => {
  it('冷蔵庫・野菜室は賞味期限', () => {
    expect(dateKindFor('fridge')).toBe('expiry');
    expect(dateKindFor('vegetable')).toBe('expiry');
  });

  it('冷凍庫・パントリーは購入日', () => {
    expect(dateKindFor('freezer')).toBe('purchase');
    expect(dateKindFor('pantry')).toBe('purchase');
  });
});

describe('normalizeFoodDates', () => {
  it('冷凍庫の食材からは賞味期限を外し、購入日を残す', () => {
    const result = normalizeFoodDates(
      food({ location: 'freezer', expiryDate: '2026-08-01', purchaseDate: '2026-03-20' }),
    );
    expect(result.expiryDate).toBeUndefined();
    expect(result.purchaseDate).toBe('2026-03-20');
  });

  it('冷蔵庫の食材からは購入日を外し、賞味期限を残す', () => {
    const result = normalizeFoodDates(
      food({ location: 'fridge', expiryDate: '2026-08-01', purchaseDate: '2026-03-20' }),
    );
    expect(result.expiryDate).toBe('2026-08-01');
    expect(result.purchaseDate).toBeUndefined();
  });

  it('元のオブジェクトは変更しない', () => {
    const original = food({ location: 'pantry', expiryDate: '2026-08-01' });
    normalizeFoodDates(original);
    expect(original.expiryDate).toBe('2026-08-01');
  });
});

describe('getFoodDate', () => {
  it('保管場所に応じて賞味期限か購入日を返す', () => {
    expect(getFoodDate(food({ location: 'fridge', expiryDate: '2026-04-08' }))).toBe('2026-04-08');
    expect(getFoodDate(food({ location: 'pantry', purchaseDate: '2026-03-15' }))).toBe('2026-03-15');
    expect(getFoodDate(food({ location: 'pantry', expiryDate: '2026-04-08' }))).toBeUndefined();
  });
});

describe('withFoodDate', () => {
  it('パントリーなら購入日に入れて賞味期限を外す', () => {
    const result = withFoodDate(food({ location: 'pantry', expiryDate: '2026-04-08' }), '2026-10-24');
    expect(result.purchaseDate).toBe('2026-10-24');
    expect(result.expiryDate).toBeUndefined();
  });

  it('野菜室なら賞味期限に入れて購入日を外す', () => {
    const result = withFoodDate(food({ location: 'vegetable', purchaseDate: '2026-03-01' }), '2026-10-30');
    expect(result.expiryDate).toBe('2026-10-30');
    expect(result.purchaseDate).toBeUndefined();
  });

  it('undefined を渡すと日付を消す', () => {
    const result = withFoodDate(food({ location: 'freezer', purchaseDate: '2026-03-01' }), undefined);
    expect(result.purchaseDate).toBeUndefined();
  });
});

describe('initialDateOnPurchase', () => {
  const from = new Date(2026, 9, 24); // 2026-10-24

  it('購入日を記録する保管場所なら今日', () => {
    expect(initialDateOnPurchase('freezer', { defaultExpiryDays: 90 }, from)).toBe('2026-10-24');
    expect(initialDateOnPurchase('pantry', null, from)).toBe('2026-10-24');
  });

  it('賞味期限を記録する保管場所なら目安日数から計算する', () => {
    expect(initialDateOnPurchase('fridge', { defaultExpiryDays: 7 }, from)).toBe('2026-10-31');
    expect(initialDateOnPurchase('fridge', null, from)).toBe('2026-10-25');
  });
});

describe('toISODate', () => {
  it('月日を2桁にそろえる', () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('formatJapaneseDate', () => {
  it('ISO日付を年月日で表示する', () => {
    expect(formatJapaneseDate('2026-04-08')).toBe('2026年4月8日');
  });

  it('未設定はハイフンで表示する', () => {
    expect(UNSET_DATE_LABEL).toBe('----年-月-日');
    expect(formatJapaneseDate(undefined)).toBe('----年-月-日');
    expect(formatJapaneseDate('')).toBe('----年-月-日');
    expect(formatJapaneseDate('  ')).toBe('----年-月-日');
  });
});
