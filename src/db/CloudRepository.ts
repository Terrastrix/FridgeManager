import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { setAllInBatches } from './batchWrite';
import { FoodItem, StockLevel } from '../types/food';
import { FoodRepository } from './FoodRepository';
import { normalizeFoodDates } from '../utils/foodDates';

function foodItemPath(uid: string) {
  return collection(db, 'users', uid, 'food_items');
}

function toDoc(item: FoodItem): Record<string, unknown> {
  const normalized = normalizeFoodDates(item);
  return {
    name: normalized.name,
    icon: normalized.icon ?? null,
    stockLevel: normalized.stockLevel,
    expiryDate: normalized.expiryDate ?? null,
    defaultExpiryDays: normalized.defaultExpiryDays ?? null,
    purchaseDate: normalized.purchaseDate ?? null,
    tags: normalized.tags,
    location: normalized.location,
  };
}

function fromDoc(id: string, data: Record<string, unknown>): FoodItem {
  // 購入日を導入する前に冷凍庫・パントリーで記録した賞味期限は使わない
  return normalizeFoodDates({
    id,
    name: data.name as string,
    icon: (data.icon as string | null) ?? undefined,
    stockLevel: data.stockLevel as StockLevel,
    expiryDate: (data.expiryDate as string | null) ?? undefined,
    defaultExpiryDays: (data.defaultExpiryDays as number | null) ?? undefined,
    purchaseDate: (data.purchaseDate as string | null) ?? undefined,
    tags: data.tags as string[],
    location: data.location as FoodItem['location'],
  });
}

export class CloudRepository implements FoodRepository {
  constructor(private readonly uid: string) {}

  async getAll(): Promise<FoodItem[]> {
    const q = query(foodItemPath(this.uid), orderBy('__name__'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => fromDoc(d.id, d.data() as Record<string, unknown>));
  }

  subscribe(callback: (items: FoodItem[]) => void): () => void {
    const q = query(foodItemPath(this.uid), orderBy('__name__'));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map((d) => fromDoc(d.id, d.data() as Record<string, unknown>)));
    });
  }

  async add(item: FoodItem): Promise<void> {
    await setDoc(doc(foodItemPath(this.uid), item.id), toDoc(item));
  }

  // 移行時などの複数件保存はバッチで一括書き込みする
  async addAll(items: FoodItem[]): Promise<void> {
    await setAllInBatches(items, (item) => [doc(foodItemPath(this.uid), item.id), toDoc(item)]);
  }

  async update(item: FoodItem): Promise<void> {
    await updateDoc(doc(foodItemPath(this.uid), item.id), toDoc(item));
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(foodItemPath(this.uid), id));
  }

  async updateStock(id: string, level: StockLevel): Promise<void> {
    await updateDoc(doc(foodItemPath(this.uid), id), { stockLevel: level });
  }
}
