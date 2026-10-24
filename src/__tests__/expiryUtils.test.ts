import {
  defaultExpiryDateFor,
  initialPurchaseExpiryDate,
  getExpiryStatus,
  clearExpiredExpiryDates,
} from '../utils/expiryUtils';
import { FoodItem } from '../types/food';

describe('defaultExpiryDateFor', () => {
  const from = new Date(2026, 6, 20); // 2026-07-20

  it('目安日数が設定されていれば今日+日数のISO日付を返す', () => {
    expect(defaultExpiryDateFor({ defaultExpiryDays: 7 }, from)).toBe('2026-07-27');
  });

  it('月をまたぐ加算も正しく計算する', () => {
    expect(defaultExpiryDateFor({ defaultExpiryDays: 14 }, from)).toBe('2026-08-03');
  });

  it('0日なら今日を返す', () => {
    expect(defaultExpiryDateFor({ defaultExpiryDays: 0 }, from)).toBe('2026-07-20');
  });

  it('目安日数が未設定ならundefinedを返す', () => {
    expect(defaultExpiryDateFor({}, from)).toBeUndefined();
    expect(defaultExpiryDateFor(null, from)).toBeUndefined();
    expect(defaultExpiryDateFor(undefined, from)).toBeUndefined();
  });
});

describe('initialPurchaseExpiryDate', () => {
  const from = new Date(2026, 6, 20); // 2026-07-20

  it('目安日数が設定されていれば今日+日数を返す', () => {
    expect(initialPurchaseExpiryDate({ defaultExpiryDays: 14 }, from)).toBe('2026-08-03');
  });

  it('目安日数が未設定なら翌日を返す', () => {
    expect(initialPurchaseExpiryDate({}, from)).toBe('2026-07-21');
  });

  it('該当食材がない（新規品目）場合も翌日を返す', () => {
    expect(initialPurchaseExpiryDate(null, from)).toBe('2026-07-21');
    expect(initialPurchaseExpiryDate(undefined, from)).toBe('2026-07-21');
  });

  it('目安0日なら今日を返す（翌日フォールバックしない）', () => {
    expect(initialPurchaseExpiryDate({ defaultExpiryDays: 0 }, from)).toBe('2026-07-20');
  });
});

describe('getExpiryStatus', () => {
  it('未設定はnone', () => {
    expect(getExpiryStatus(undefined)).toBe('none');
    expect(getExpiryStatus('')).toBe('none');
  });

  it('過去日はexpired', () => {
    expect(getExpiryStatus('2000-01-01')).toBe('expired');
  });

  it('遠い未来はok', () => {
    expect(getExpiryStatus('2099-12-31')).toBe('ok');
  });

  it('基準日を渡せる（当日はexpired、3日後まではnear）', () => {
    const from = new Date(2026, 9, 24); // 2026-10-24
    expect(getExpiryStatus('2026-10-24', from)).toBe('expired');
    expect(getExpiryStatus('2026-10-27', from)).toBe('near');
    expect(getExpiryStatus('2026-10-28', from)).toBe('ok');
  });
});

describe('clearExpiredExpiryDates', () => {
  const from = new Date(2026, 9, 24); // 2026-10-24
  const items: FoodItem[] = [
    { id: '1', name: '豆腐', stockLevel: 1, tags: [], location: 'fridge', expiryDate: '2026-10-20' },
    { id: '2', name: '卵', stockLevel: 2, tags: [], location: 'fridge', expiryDate: '2026-11-30' },
    { id: '3', name: 'ハム', stockLevel: 1, tags: [], location: 'fridge' },
    { id: '4', name: 'レタス', stockLevel: 1, tags: ['葉物野菜'], location: 'vegetable', expiryDate: '2026-10-24' },
    { id: '5', name: '米', stockLevel: 2, tags: [], location: 'pantry', purchaseDate: '2026-03-15' },
  ];

  it('期限切れの食材だけを、賞味期限を外して返す', () => {
    const result = clearExpiredExpiryDates(items, from);
    expect(result.map((item) => item.id)).toEqual(['1', '4']);
    expect(result.every((item) => item.expiryDate === undefined)).toBe(true);
  });

  it('賞味期限以外の項目はそのまま残す', () => {
    const [tofu, lettuce] = clearExpiredExpiryDates(items, from);
    expect(tofu).toEqual({ id: '1', name: '豆腐', stockLevel: 1, tags: [], location: 'fridge', expiryDate: undefined });
    expect(lettuce.tags).toEqual(['葉物野菜']);
  });

  it('期限切れがなければ空配列', () => {
    expect(clearExpiredExpiryDates(items.slice(1, 3), from)).toEqual([]);
  });
});
