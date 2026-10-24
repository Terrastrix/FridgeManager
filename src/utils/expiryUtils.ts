import { FoodItem } from '../types/food';

export type ExpiryStatus = 'expired' | 'near' | 'ok' | 'none';

/**
 * 食材に目安日数（defaultExpiryDays）が設定されていれば「今日 + 日数」のISO日付、なければ undefined
 */
export function defaultExpiryDateFor(
  food: { defaultExpiryDays?: number } | null | undefined,
  from: Date = new Date(),
): string | undefined {
  const days = food?.defaultExpiryDays;
  if (days === undefined || days === null) return undefined;

  const d = new Date(from);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 「買ってきた」時の賞味期限初期値。
 * 目安日数が設定されていれば「今日 + 日数」、未設定（新規品目含む）なら翌日
 */
export function initialPurchaseExpiryDate(
  food: { defaultExpiryDays?: number } | null | undefined,
  from: Date = new Date(),
): string {
  return defaultExpiryDateFor(food, from) ?? (defaultExpiryDateFor({ defaultExpiryDays: 1 }, from) as string);
}

/** 賞味期限の状態を返す。near は残り3日以内（当日含まず）*/
export function getExpiryStatus(expiryDate: string | undefined, from: Date = new Date()): ExpiryStatus {
  if (!expiryDate || !expiryDate.trim()) return 'none';

  const today = new Date(from);
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);

  if (expiry <= today) return 'expired';

  const diffDays = (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays <= 3) return 'near';

  return 'ok';
}

/** 賞味期限が切れている食材だけを取り出し、賞味期限を外したものを返す */
export function clearExpiredExpiryDates(items: FoodItem[], from: Date = new Date()): FoodItem[] {
  return items
    .filter((item) => getExpiryStatus(item.expiryDate, from) === 'expired')
    .map((item) => ({ ...item, expiryDate: undefined }));
}
