import { FoodItem, StorageLocation } from '../types/food';
import { initialPurchaseExpiryDate } from './expiryUtils';

/** 食材に記録する日付の種類。賞味期限と購入日はどちらか一方だけを記録する */
export type FoodDateKind = 'expiry' | 'purchase';

export const FOOD_DATE_LABELS: Record<FoodDateKind, string> = {
  expiry: '賞味期限',
  purchase: '購入日',
};

/** 未設定の日付の表示 */
export const UNSET_DATE_LABEL = '----年-月-日';

type DatedFood = Pick<FoodItem, 'location' | 'expiryDate' | 'purchaseDate'>;

/** 冷凍庫・パントリーは購入日、それ以外は賞味期限を記録する */
export function dateKindFor(location: StorageLocation): FoodDateKind {
  return location === 'freezer' || location === 'pantry' ? 'purchase' : 'expiry';
}

/** 保管場所に合わない方の日付を外す */
export function normalizeFoodDates<T extends DatedFood>(item: T): T {
  if (dateKindFor(item.location) === 'purchase') return { ...item, expiryDate: undefined };
  return { ...item, purchaseDate: undefined };
}

/** 保管場所に応じて賞味期限か購入日を返す */
export function getFoodDate(item: DatedFood): string | undefined {
  return dateKindFor(item.location) === 'purchase' ? item.purchaseDate : item.expiryDate;
}

/** 保管場所に応じて賞味期限か購入日に date を入れ、もう一方は外す */
export function withFoodDate<T extends DatedFood>(item: T, date: string | undefined): T {
  if (dateKindFor(item.location) === 'purchase') {
    return { ...item, expiryDate: undefined, purchaseDate: date };
  }
  return { ...item, expiryDate: date, purchaseDate: undefined };
}

/**
 * 「買ってきた」時の日付の初期値。
 * 購入日を記録する保管場所なら今日、賞味期限なら目安日数から計算した日付
 */
export function initialDateOnPurchase(
  location: StorageLocation,
  food: { defaultExpiryDays?: number } | null | undefined,
  from: Date = new Date(),
): string {
  if (dateKindFor(location) === 'purchase') return toISODate(from);
  return initialPurchaseExpiryDate(food, from);
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 'YYYY-MM-DD' を「2026年4月8日」の形にする。未設定は UNSET_DATE_LABEL */
export function formatJapaneseDate(iso: string | undefined): string {
  if (!iso || !iso.trim()) return UNSET_DATE_LABEL;
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parseInt(parts[0])}年${parseInt(parts[1])}月${parseInt(parts[2])}日`;
}
