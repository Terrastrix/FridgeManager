import { CloudRepository } from '../db/CloudRepository';
import { FoodItem } from '../types/food';

// firebase/firestore をモック
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  query: jest.fn((...args) => args),
  orderBy: jest.fn(),
  onSnapshot: jest.fn(),
}));

// firebase config をモック
jest.mock('../config/firebase', () => ({
  db: {},
}));

import { onSnapshot } from 'firebase/firestore';

const sampleItems: FoodItem[] = [
  { id: '1', name: '牛乳', stockLevel: 2, tags: [], location: 'fridge' },
  { id: '2', name: '卵', stockLevel: 2, tags: [], location: 'fridge' },
];

function makeSnapshotDocs(items: FoodItem[]) {
  return {
    docs: items.map((item) => ({
      id: item.id,
      data: () => ({
        name: item.name,
        icon: item.icon ?? null,
        stockLevel: item.stockLevel,
        expiryDate: item.expiryDate ?? null,
        purchaseDate: item.purchaseDate ?? null,
        tags: item.tags,
        location: item.location,
      }),
    })),
  };
}

describe('CloudRepository.subscribe', () => {
  const uid = 'test-uid';
  let repo: CloudRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new CloudRepository(uid);
  });

  it('onSnapshot を呼び出す', () => {
    (onSnapshot as jest.Mock).mockReturnValue(() => {});
    const callback = jest.fn();

    repo.subscribe(callback);

    expect(onSnapshot).toHaveBeenCalledTimes(1);
  });

  it('スナップショット受信時にコールバックが FoodItem[] で呼ばれる', () => {
    let capturedCallback: ((snapshot: ReturnType<typeof makeSnapshotDocs>) => void) | null = null;
    (onSnapshot as jest.Mock).mockImplementation((_query, cb) => {
      capturedCallback = cb;
      return () => {};
    });

    const callback = jest.fn();
    repo.subscribe(callback);

    capturedCallback!(makeSnapshotDocs(sampleItems));

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith([
      expect.objectContaining({ id: '1', name: '牛乳' }),
      expect.objectContaining({ id: '2', name: '卵' }),
    ]);
  });

  it('購入日を読み、冷凍庫・パントリーに残っている賞味期限は使わない', () => {
    let capturedCallback: ((snapshot: ReturnType<typeof makeSnapshotDocs>) => void) | null = null;
    (onSnapshot as jest.Mock).mockImplementation((_query, cb) => {
      capturedCallback = cb;
      return () => {};
    });

    const callback = jest.fn();
    repo.subscribe(callback);

    capturedCallback!(
      makeSnapshotDocs([
        {
          id: '10',
          name: '冷凍餃子',
          stockLevel: 1,
          tags: [],
          location: 'freezer',
          expiryDate: '2026-08-01',
          purchaseDate: '2026-03-20',
        },
      ]),
    );

    const [[items]] = callback.mock.calls;
    expect(items[0].purchaseDate).toBe('2026-03-20');
    expect(items[0].expiryDate).toBeUndefined();
  });

  it('スナップショットが複数回来るたびにコールバックが呼ばれる', () => {
    let capturedCallback: ((snapshot: ReturnType<typeof makeSnapshotDocs>) => void) | null = null;
    (onSnapshot as jest.Mock).mockImplementation((_query, cb) => {
      capturedCallback = cb;
      return () => {};
    });

    const callback = jest.fn();
    repo.subscribe(callback);

    capturedCallback!(makeSnapshotDocs(sampleItems));
    capturedCallback!(makeSnapshotDocs([sampleItems[0]]));

    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback.mock.calls[1][0]).toHaveLength(1);
  });

  it('返り値の関数を呼ぶと onSnapshot の購読が解除される', () => {
    const unsubscribeMock = jest.fn();
    (onSnapshot as jest.Mock).mockReturnValue(unsubscribeMock);

    const unsubscribe = repo.subscribe(jest.fn());
    unsubscribe();

    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
  });

  it('空のコレクションでも空配列でコールバックが呼ばれる', () => {
    let capturedCallback: ((snapshot: ReturnType<typeof makeSnapshotDocs>) => void) | null = null;
    (onSnapshot as jest.Mock).mockImplementation((_query, cb) => {
      capturedCallback = cb;
      return () => {};
    });

    const callback = jest.fn();
    repo.subscribe(callback);

    capturedCallback!(makeSnapshotDocs([]));

    expect(callback).toHaveBeenCalledWith([]);
  });
});
