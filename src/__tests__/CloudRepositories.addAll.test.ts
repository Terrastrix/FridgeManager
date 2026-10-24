jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db, ...path) => path.join('/')),
  doc: jest.fn((colRef, id) => `${colRef}/${id}`),
}));
jest.mock('../config/firebase', () => ({ db: {} }));
jest.mock('../db/batchWrite', () => ({ setAllInBatches: jest.fn().mockResolvedValue(undefined) }));

import { setAllInBatches } from '../db/batchWrite';
import { CloudRepository } from '../db/CloudRepository';
import { CloudRecipeRepository } from '../db/CloudRecipeRepository';
import { CloudShoppingRepository } from '../db/CloudShoppingRepository';

const mockSetAll = setAllInBatches as jest.Mock;

// addAll に渡した各要素が、どのドキュメントにどんな内容で書かれるかを取り出す
function entries() {
  const [items, toEntry] = mockSetAll.mock.calls[0];
  return (items as unknown[]).map((item) => toEntry(item));
}

describe('Cloud*Repository.addAll', () => {
  beforeEach(() => mockSetAll.mockClear());

  it('食品を users/{uid}/food_items に一括書き込みする', async () => {
    await new CloudRepository('u1').addAll([
      { id: '1', name: '牛乳', stockLevel: 2, tags: [], location: 'fridge' },
    ]);

    expect(mockSetAll).toHaveBeenCalledTimes(1);
    expect(entries()).toEqual([
      [
        'users/u1/food_items/1',
        expect.objectContaining({ name: '牛乳', stockLevel: 2, location: 'fridge' }),
      ],
    ]);
  });

  it('食品の購入日を書き込み、冷凍庫・パントリーの賞味期限は null にする', async () => {
    await new CloudRepository('u1').addAll([
      {
        id: '10',
        name: '冷凍餃子',
        stockLevel: 1,
        tags: [],
        location: 'freezer',
        expiryDate: '2026-08-01',
        purchaseDate: '2026-03-20',
      },
    ]);

    expect(entries()).toEqual([
      [
        'users/u1/food_items/10',
        expect.objectContaining({ expiryDate: null, purchaseDate: '2026-03-20' }),
      ],
    ]);
  });

  it('レシピを users/{uid}/recipes に一括書き込みする', async () => {
    await new CloudRecipeRepository('u1').addAll([
      { id: '2', name: '親子丼', ingredients: [{ name: '卵' }] },
    ]);

    expect(entries()).toEqual([
      [
        'users/u1/recipes/2',
        expect.objectContaining({ name: '親子丼', ingredients: [{ name: '卵', quantity: null }] }),
      ],
    ]);
  });

  it('買い物リストを users/{uid}/shopping_items に一括書き込みする', async () => {
    await new CloudShoppingRepository('u1').addAll([{ id: '3', name: 'パン', checked: false }]);

    expect(entries()).toEqual([
      ['users/u1/shopping_items/3', expect.objectContaining({ name: 'パン', checked: false })],
    ]);
  });
});
