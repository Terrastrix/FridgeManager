import * as SQLite from 'expo-sqlite';
import { FoodItem, StockLevel } from '../types/food';
import { FoodRepository } from './FoodRepository';
import rawInitialData from '../data/initialFoodItems.json';
import { normalizeFoodDates } from '../utils/foodDates';

const db = SQLite.openDatabaseSync('fridgemanager.db');

function initDB(): void {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS food_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT,
      stock_level INTEGER NOT NULL DEFAULT 2,
      expiry_date TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      location TEXT NOT NULL,
      default_expiry_days INTEGER,
      purchase_date TEXT
    );
  `);

  // 既存インストール向けマイグレーション（カラムが既にあれば失敗するので無視）
  for (const sql of [
    'ALTER TABLE food_items ADD COLUMN default_expiry_days INTEGER;',
    'ALTER TABLE food_items ADD COLUMN purchase_date TEXT;',
  ]) {
    try {
      db.execSync(sql);
    } catch {
      // 既にカラムが存在する
    }
  }

  const row = db.getFirstSync<{ count: number }>('SELECT COUNT(*) AS count FROM food_items;');
  if (row?.count === 0) {
    const initialItems = rawInitialData as FoodItem[];
    for (const item of initialItems) {
      insertItem(item);
    }
  }
}

function insertItem(item: FoodItem): void {
  const normalized = normalizeFoodDates(item);
  db.runSync(
    'INSERT INTO food_items (id, name, icon, stock_level, expiry_date, tags, location, default_expiry_days, purchase_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);',
    normalized.id,
    normalized.name,
    normalized.icon ?? null,
    normalized.stockLevel,
    normalized.expiryDate ?? null,
    JSON.stringify(normalized.tags),
    normalized.location,
    normalized.defaultExpiryDays ?? null,
    normalized.purchaseDate ?? null,
  );
}

interface FoodRow {
  id: string;
  name: string;
  icon: string | null;
  stock_level: number;
  expiry_date: string | null;
  tags: string;
  location: string;
  default_expiry_days: number | null;
  purchase_date: string | null;
}

function rowToFoodItem(row: FoodRow): FoodItem {
  // 購入日を導入する前に冷凍庫・パントリーで記録した賞味期限は使わない
  return normalizeFoodDates({
    id: row.id,
    name: row.name,
    icon: row.icon ?? undefined,
    stockLevel: row.stock_level as StockLevel,
    expiryDate: row.expiry_date ?? undefined,
    defaultExpiryDays: row.default_expiry_days ?? undefined,
    purchaseDate: row.purchase_date ?? undefined,
    tags: JSON.parse(row.tags) as string[],
    location: row.location as FoodItem['location'],
  });
}

export class LocalRepository implements FoodRepository {
  constructor() {
    initDB();
  }

  async getAll(): Promise<FoodItem[]> {
    const rows = db.getAllSync<FoodRow>('SELECT * FROM food_items ORDER BY CAST(id AS INTEGER), id;');
    return rows.map(rowToFoodItem);
  }

  async add(item: FoodItem): Promise<void> {
    insertItem(item);
  }

  async update(item: FoodItem): Promise<void> {
    const normalized = normalizeFoodDates(item);
    db.runSync(
      'UPDATE food_items SET name = ?, icon = ?, stock_level = ?, expiry_date = ?, tags = ?, location = ?, default_expiry_days = ?, purchase_date = ? WHERE id = ?;',
      normalized.name,
      normalized.icon ?? null,
      normalized.stockLevel,
      normalized.expiryDate ?? null,
      JSON.stringify(normalized.tags),
      normalized.location,
      normalized.defaultExpiryDays ?? null,
      normalized.purchaseDate ?? null,
      normalized.id,
    );
  }

  async delete(id: string): Promise<void> {
    db.runSync('DELETE FROM food_items WHERE id = ?;', id);
  }

  async updateStock(id: string, level: StockLevel): Promise<void> {
    db.runSync('UPDATE food_items SET stock_level = ? WHERE id = ?;', level, id);
  }
}
