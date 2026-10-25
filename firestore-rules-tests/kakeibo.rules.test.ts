import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  deleteDoc,
  doc,
  getDoc,
  increment,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';

// 家計簿（HouseAccountBook）のデータのルールを、Firestore エミュレータ上で検証する（npm run test:rules）
const OWNER = 'owner-uid';
const MEMBER = 'member-uid';
const STRANGER = 'stranger-uid';

let env: RulesTestEnvironment;

const dbAs = (uid: string) => env.authenticatedContext(uid).firestore();
const kakeibo = (uid: string, ...path: string[]) => doc(dbAs(uid), 'users', OWNER, ...path);

async function seed(path: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

async function joinMember() {
  await seed(`users/${OWNER}/members/${MEMBER}`, { joinedAt: Timestamp.now(), inviteCode: 'ABC234' });
}

const dining = (uid: string, overrides: Record<string, unknown> = {}) => ({
  date: '2026-10-20',
  month: '2026-10',
  storeId: 's_teppou',
  amount: 3200,
  note: '',
  createdBy: uid,
  createdByName: '家族',
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...overrides,
});

const newStore = (uid: string, overrides: Record<string, unknown> = {}) => ({
  name: '焼鳥 鉄砲',
  aliases: ['焼き鳥 鉄砲', '鉄砲'],
  kind: 'dining',
  createdBy: uid,
  createdAt: serverTimestamp(),
  ...overrides,
});

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-fridgemanager',
    firestore: { rules: readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8') },
  });
});

afterEach(async () => {
  await env.clearFirestore();
});

afterAll(async () => {
  await env.cleanup();
});

describe('家計簿: 月ごとのレシート（kakeibo_months）', () => {
  const month = { month: '2026-10', receipts: [], updatedAt: Timestamp.now() };

  it('オーナーは書き込める', async () => {
    await assertSucceeds(setDoc(kakeibo(OWNER, 'kakeibo_months', '2026-10'), month));
    await assertSucceeds(deleteDoc(kakeibo(OWNER, 'kakeibo_months', '2026-10')));
  });

  it('ドキュメント ID と month が年月の形で一致しないと書き込めない', async () => {
    await assertFails(setDoc(kakeibo(OWNER, 'kakeibo_months', '2026-11'), month));
    await assertFails(setDoc(kakeibo(OWNER, 'kakeibo_months', '202610'), { ...month, month: '202610' }));
  });

  it('決めた項目以外は書き込めない', async () => {
    await assertFails(setDoc(kakeibo(OWNER, 'kakeibo_months', '2026-10'), { ...month, extra: 1 }));
    await assertFails(setDoc(kakeibo(OWNER, 'kakeibo_months', '2026-10'), { ...month, receipts: 'x' }));
  });

  it('メンバーは読めるが書き込めない', async () => {
    await joinMember();
    await seed(`users/${OWNER}/kakeibo_months/2026-10`, month);
    await assertSucceeds(getDoc(kakeibo(MEMBER, 'kakeibo_months', '2026-10')));
    await assertFails(setDoc(kakeibo(MEMBER, 'kakeibo_months', '2026-10'), month));
    await assertFails(deleteDoc(kakeibo(MEMBER, 'kakeibo_months', '2026-10')));
  });

  it('他人は読めない', async () => {
    await seed(`users/${OWNER}/kakeibo_months/2026-10`, month);
    await assertFails(getDoc(kakeibo(STRANGER, 'kakeibo_months', '2026-10')));
  });
});

describe('家計簿: 外食の記録（kakeibo_dining）', () => {
  it('メンバーは自分の記録を入力できる', async () => {
    await joinMember();
    await assertSucceeds(setDoc(kakeibo(MEMBER, 'kakeibo_dining', 'd1'), dining(MEMBER)));
  });

  it('他人の名前（createdBy）では入力できない', async () => {
    await joinMember();
    await assertFails(setDoc(kakeibo(MEMBER, 'kakeibo_dining', 'd1'), dining(OWNER)));
  });

  it('メンバー以外は入力も閲覧もできない', async () => {
    await assertFails(setDoc(kakeibo(STRANGER, 'kakeibo_dining', 'd1'), dining(STRANGER)));
    await seed(`users/${OWNER}/kakeibo_dining/d1`, { ...dining(OWNER), createdAt: Timestamp.now() });
    await assertFails(getDoc(kakeibo(STRANGER, 'kakeibo_dining', 'd1')));
  });

  it.each([
    ['金額が0', { amount: 0 }],
    ['金額が小数', { amount: 3200.5 }],
    ['金額が文字列', { amount: '3200' }],
    ['日付の形が違う', { date: '2026/10/20' }],
    ['日付と月が合わない', { date: '2026-11-01' }],
    ['お店が空', { storeId: '' }],
    ['メモが長すぎる', { note: 'あ'.repeat(201) }],
    ['決めた項目以外がある', { extra: 1 }],
    ['作成日時がサーバーの時刻でない', { createdAt: Timestamp.fromDate(new Date('2020-01-01')) }],
  ])('%sときは入力できない', async (_label, overrides) => {
    await joinMember();
    await assertFails(setDoc(kakeibo(MEMBER, 'kakeibo_dining', 'd1'), dining(MEMBER, overrides)));
  });

  it('入力した本人とオーナーは直せる。ほかのメンバーは直せない', async () => {
    await joinMember();
    await seed(`users/${OWNER}/members/other-member`, { joinedAt: Timestamp.now(), inviteCode: 'ABC234' });
    await setDoc(kakeibo(MEMBER, 'kakeibo_dining', 'd1'), dining(MEMBER));
    const change = { amount: 3000, updatedAt: serverTimestamp() };
    await assertSucceeds(updateDoc(kakeibo(MEMBER, 'kakeibo_dining', 'd1'), change));
    await assertSucceeds(updateDoc(kakeibo(OWNER, 'kakeibo_dining', 'd1'), change));
    await assertFails(updateDoc(kakeibo('other-member', 'kakeibo_dining', 'd1'), change));
  });

  it('修正で入力者と作成日時は変えられない', async () => {
    await joinMember();
    await setDoc(kakeibo(MEMBER, 'kakeibo_dining', 'd1'), dining(MEMBER));
    await assertFails(
      updateDoc(kakeibo(OWNER, 'kakeibo_dining', 'd1'), { createdBy: OWNER, updatedAt: serverTimestamp() }),
    );
    await assertFails(
      updateDoc(kakeibo(MEMBER, 'kakeibo_dining', 'd1'), {
        createdAt: Timestamp.fromDate(new Date('2020-01-01')),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('削除はオーナーだけができる', async () => {
    await joinMember();
    await setDoc(kakeibo(MEMBER, 'kakeibo_dining', 'd1'), dining(MEMBER));
    await assertFails(deleteDoc(kakeibo(MEMBER, 'kakeibo_dining', 'd1')));
    await assertSucceeds(deleteDoc(kakeibo(OWNER, 'kakeibo_dining', 'd1')));
  });
});

describe('家計簿: 商品マスタと対応表（kakeibo_meta/products, fridge_aliases）', () => {
  it('オーナーは書き込める', async () => {
    await assertSucceeds(
      setDoc(kakeibo(OWNER, 'kakeibo_meta', 'products'), { products: {}, updatedAt: serverTimestamp() }),
    );
    await assertSucceeds(
      setDoc(kakeibo(OWNER, 'kakeibo_meta', 'fridge_aliases'), { aliases: {}, updatedAt: serverTimestamp() }),
    );
  });

  it('メンバーは読めるが書き込めない', async () => {
    await joinMember();
    await seed(`users/${OWNER}/kakeibo_meta/products`, { products: {} });
    await assertSucceeds(getDoc(kakeibo(MEMBER, 'kakeibo_meta', 'products')));
    await assertFails(setDoc(kakeibo(MEMBER, 'kakeibo_meta', 'products'), { products: { p1: { name: 'x' } } }));
    await assertFails(setDoc(kakeibo(MEMBER, 'kakeibo_meta', 'fridge_aliases'), { aliases: {} }));
  });

  it('決めていないドキュメントには、オーナーも書き込めない', async () => {
    await assertFails(setDoc(kakeibo(OWNER, 'kakeibo_meta', 'other'), { a: 1 }));
  });
});

describe('家計簿: お店マスタ（kakeibo_meta/stores）', () => {
  const existing = {
    stores: { s_morinaga: { name: 'モリナガ 津福店', aliases: [], kind: 'supermarket', createdBy: OWNER } },
  };

  it('メンバーは1件だけ新しいお店を足せる', async () => {
    await joinMember();
    await seed(`users/${OWNER}/kakeibo_meta/stores`, existing);
    await assertSucceeds(
      updateDoc(kakeibo(MEMBER, 'kakeibo_meta', 'stores'), {
        'stores.s_teppou': newStore(MEMBER),
        lastAddedStoreId: 's_teppou',
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('お店マスタがまだなければ、メンバーが最初の1件で作れる', async () => {
    await joinMember();
    await assertSucceeds(
      setDoc(kakeibo(MEMBER, 'kakeibo_meta', 'stores'), {
        stores: { s_teppou: newStore(MEMBER) },
        lastAddedStoreId: 's_teppou',
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('メンバーは既存のお店を直したり消したりできない', async () => {
    await joinMember();
    await seed(`users/${OWNER}/kakeibo_meta/stores`, existing);
    await assertFails(
      updateDoc(kakeibo(MEMBER, 'kakeibo_meta', 'stores'), {
        'stores.s_morinaga.name': 'モリナガ',
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      setDoc(kakeibo(MEMBER, 'kakeibo_meta', 'stores'), { stores: {}, updatedAt: serverTimestamp() }),
    );
    await assertFails(deleteDoc(kakeibo(MEMBER, 'kakeibo_meta', 'stores')));
  });

  it('メンバーは2件まとめて足したり、lastAddedStoreId と違うお店を足したりできない', async () => {
    await joinMember();
    await seed(`users/${OWNER}/kakeibo_meta/stores`, existing);
    await assertFails(
      updateDoc(kakeibo(MEMBER, 'kakeibo_meta', 'stores'), {
        'stores.s_a': newStore(MEMBER, { name: 'A' }),
        'stores.s_b': newStore(MEMBER, { name: 'B' }),
        lastAddedStoreId: 's_a',
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(kakeibo(MEMBER, 'kakeibo_meta', 'stores'), {
        'stores.s_a': newStore(MEMBER),
        lastAddedStoreId: 's_b',
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it.each([
    ['名前が空', { name: '' }],
    ['種類が決めた値でない', { kind: 'bar' }],
    ['追加した人が本人でない', { createdBy: OWNER }],
  ])('%sお店は足せない', async (_label, overrides) => {
    await joinMember();
    await seed(`users/${OWNER}/kakeibo_meta/stores`, existing);
    await assertFails(
      updateDoc(kakeibo(MEMBER, 'kakeibo_meta', 'stores'), {
        'stores.s_teppou': newStore(MEMBER, overrides),
        lastAddedStoreId: 's_teppou',
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('オーナーはお店の名前を直せる', async () => {
    await seed(`users/${OWNER}/kakeibo_meta/stores`, existing);
    await assertSucceeds(
      updateDoc(kakeibo(OWNER, 'kakeibo_meta', 'stores'), {
        'stores.s_morinaga.name': 'スーパーマーケット モリナガ 津福店',
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('他人は読めない', async () => {
    await seed(`users/${OWNER}/kakeibo_meta/stores`, existing);
    await assertFails(getDoc(kakeibo(STRANGER, 'kakeibo_meta', 'stores')));
  });
});

describe('家計簿: 更新番号（kakeibo_meta/version）', () => {
  it('メンバーは外食とお店の番号を1つ増やせる', async () => {
    await joinMember();
    await seed(`users/${OWNER}/kakeibo_meta/version`, { receipts: 3, dining: 5, stores: 2, products: 1 });
    await assertSucceeds(updateDoc(kakeibo(MEMBER, 'kakeibo_meta', 'version'), { dining: increment(1) }));
    await assertSucceeds(
      updateDoc(kakeibo(MEMBER, 'kakeibo_meta', 'version'), { dining: increment(1), stores: increment(1) }),
    );
  });

  it('メンバーはレシートや商品の番号を変えられず、2以上増やしたり減らしたりもできない', async () => {
    await joinMember();
    await seed(`users/${OWNER}/kakeibo_meta/version`, { receipts: 3, dining: 5 });
    await assertFails(updateDoc(kakeibo(MEMBER, 'kakeibo_meta', 'version'), { receipts: increment(1) }));
    await assertFails(updateDoc(kakeibo(MEMBER, 'kakeibo_meta', 'version'), { dining: increment(2) }));
    await assertFails(updateDoc(kakeibo(MEMBER, 'kakeibo_meta', 'version'), { dining: 4 }));
  });

  it('更新番号がまだなければ、メンバーは外食の番号を1にして作れる', async () => {
    await joinMember();
    await assertSucceeds(setDoc(kakeibo(MEMBER, 'kakeibo_meta', 'version'), { dining: 1 }));
  });

  it('項目のない番号は 0 から1つ増やせる', async () => {
    await joinMember();
    await seed(`users/${OWNER}/kakeibo_meta/version`, { receipts: 3 });
    await assertSucceeds(updateDoc(kakeibo(MEMBER, 'kakeibo_meta', 'version'), { stores: 1 }));
  });

  it('オーナーは自由に書ける。他人は読めない', async () => {
    await assertSucceeds(setDoc(kakeibo(OWNER, 'kakeibo_meta', 'version'), { receipts: 10, products: 2 }));
    await assertFails(getDoc(kakeibo(STRANGER, 'kakeibo_meta', 'version')));
  });
});
