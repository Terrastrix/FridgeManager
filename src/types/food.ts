export type StorageLocation = 'fridge' | 'vegetable' | 'freezer' | 'pantry';

/** 0: 全くない  1: ちょっとある  2: 買ったばかり */
export type StockLevel = 0 | 1 | 2;

export const STOCK_LABELS: Record<StockLevel, string> = {
  0: '全くない',
  1: 'ちょっとある',
  2: '買ったばかり',
};

/** 在庫ステータスの表示モード（2段階「ある/ない」 or 3段階） */
export type StatusMode = '2step' | '3step';

export const LOCATION_LABELS: Record<StorageLocation, string> = {
  fridge: '冷蔵庫',
  vegetable: '野菜室',
  freezer: '冷凍庫',
  pantry: 'パントリー',
};

export const STORAGE_LOCATIONS: StorageLocation[] = [
  'fridge',
  'vegetable',
  'freezer',
  'pantry',
];

export interface FoodItem {
  id: string;
  name: string;
  icon?: string;
  stockLevel: StockLevel;
  /** ISO date string 'YYYY-MM-DD'、未設定は空文字。冷蔵庫・野菜室の食材だけが持つ（purchaseDate と排他） */
  expiryDate?: string;
  /** 購入日 'YYYY-MM-DD'。冷凍庫・パントリーの食材だけが持つ（expiryDate と排他） */
  purchaseDate?: string;
  /** 賞味期限の目安日数（「買ってきた」時の初期値 = 今日 + この日数） */
  defaultExpiryDays?: number;
  tags: string[];
  location: StorageLocation;
}
