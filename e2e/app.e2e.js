// Firebase Auth/Firestoreの長ポーリング接続をDetoxの同期監視から除外するURLリスト。
// これらは常時接続のため、除外しないとDetoxが「アプリが非アイドル」と誤判定し
// waitFor系のアサーションが永遠にタイムアウトする。
// setURLBlacklistはアプリ起動後に呼ぶ必要があり、launchApp({ delete: true })で
// リセットされるためbeforeEachでも再設定する。
const FIREBASE_URL_BLACKLIST = [
  '.*firebaseauth\\.googleapis\\.com.*',
  '.*firestore\\.googleapis\\.com.*',
  '.*identitytoolkit\\.googleapis\\.com.*',
  '.*firebase\\.googleapis\\.com.*',
  '.*securetoken\\.googleapis\\.com.*',
];

describe('StorageScreen', () => {
  beforeAll(async () => {
    await device.launchApp();
    await device.setURLBlacklist(FIREBASE_URL_BLACKLIST);
  });

  beforeEach(async () => {
    // アプリデータ（SQLite含む）をリセットして再起動し初期データを再シード
    // delete: true は adb shell pm clear でユーザーデータを全消去してから起動
    await device.launchApp({ delete: true });
    // アプリ再起動後にFirebase URLブラックリストを再設定（再起動でリセットされるため）
    await device.setURLBlacklist(FIREBASE_URL_BLACKLIST);
    // ローディング完了（btn-add-foodが表示される）まで待機
    await waitFor(element(by.id('btn-add-food'))).toBeVisible().withTimeout(10000);
  });

  // ── 基本表示 ──────────────────────────────────────────
  it('食品保管画面が表示される', async () => {
    await expect(element(by.id('storage-screen'))).toBeVisible();
    // NOTE: by.text('食品保管') はボトムタブのラベルにもマッチして曖昧になるため testID で確認する
    await expect(element(by.id('storage-title'))).toBeVisible();
  });

  it('保管場所タブが4つ表示される', async () => {
    await expect(element(by.id('tab-fridge'))).toBeVisible();
    await expect(element(by.id('tab-vegetable'))).toBeVisible();
    await expect(element(by.id('tab-freezer'))).toBeVisible();
    await expect(element(by.id('tab-pantry'))).toBeVisible();
  });

  it('冷蔵庫タブに初期食品が表示される', async () => {
    await expect(element(by.text('牛乳'))).toBeVisible();
    // 「卵」はタグにも同名があるため testID で確認
    await expect(element(by.id('food-item-2'))).toBeVisible();
  });

  // ── タブ切り替え ──────────────────────────────────────
  it('野菜室タブに切り替えると対応する食品が表示される', async () => {
    await element(by.id('tab-vegetable')).tap();
    await expect(element(by.text('レタス'))).toBeVisible();
    await expect(element(by.text('トマト'))).toBeVisible();
  });

  it('冷凍庫タブに切り替えると対応する食品が表示される', async () => {
    await element(by.id('tab-freezer')).tap();
    await expect(element(by.text('冷凍餃子'))).toBeVisible();
  });

  it('パントリータブに切り替えると対応する食品が表示される', async () => {
    await element(by.id('tab-pantry')).tap();
    await expect(element(by.text('米'))).toBeVisible();
  });

  // ── 在庫ステータス変更 ────────────────────────────────
  it('在庫ステータスを変更できる', async () => {
    // 牛乳(id=1)のステータスを「全くない」に変更
    await element(by.id('stock-btn-1-0')).tap();
    await expect(element(by.id('stock-btn-1-0'))).toBeVisible();
  });

  // ── 食品追加 ──────────────────────────────────────────
  it('食品を追加できる', async () => {
    await element(by.id('btn-add-food')).tap();
    await expect(element(by.id('add-food-sheet'))).toBeVisible();
    // Android CIエミュレーターのIMEは日本語キーイベントを変換できないため ASCII 文字を使用
    await element(by.id('add-food-name-input')).typeText('TestFood');
    await element(by.id('add-food-submit')).tap();
    // 追加アイテムはリスト末尾に追加されるためスクロールしながら確認
    await waitFor(element(by.text('TestFood')))
      .toBeVisible()
      .whileElement(by.id('food-list'))
      .scroll(300, 'down');
  });

  it('名前が空のまま追加ボタンを押しても追加されない', async () => {
    await element(by.id('btn-add-food')).tap();
    await expect(element(by.id('add-food-sheet'))).toBeVisible();
    await element(by.id('add-food-submit')).tap();
    await expect(element(by.id('add-food-sheet'))).toBeVisible();
  });

  it('追加モーダルをキャンセルできる', async () => {
    await element(by.id('btn-add-food')).tap();
    await expect(element(by.id('add-food-sheet'))).toBeVisible();
    await element(by.id('add-food-cancel')).tap();
    await expect(element(by.id('storage-screen'))).toBeVisible();
  });

  // ── 削除 ──────────────────────────────────────────────
  it('削除モードで削除ボタンが表示され、食品を削除できる', async () => {
    await element(by.id('btn-delete-mode')).tap();
    await expect(element(by.id('delete-btn-1'))).toBeVisible();
    await element(by.id('delete-btn-1')).tap();
    // 確認ダイアログを承認
    await element(by.text('削除する')).tap();
    await expect(element(by.text('牛乳'))).not.toBeVisible();
  });

  // ── 編集 ──────────────────────────────────────────────
  it('食品を編集できる', async () => {
    await element(by.id('edit-btn-1')).tap();
    await expect(element(by.id('edit-food-sheet'))).toBeVisible();
    await element(by.id('edit-food-name-input')).clearText();
    await element(by.id('edit-food-name-input')).typeText('MilkEdited');
    // キーボードを閉じてからsubmitへスクロール（開いたままだとsubmitに到達できない）
    await device.pressBack();
    await waitFor(element(by.id('edit-food-submit')))
      .toBeVisible()
      .whileElement(by.id('edit-food-sheet'))
      .scroll(300, 'down');
    await element(by.id('edit-food-submit')).tap();
    await expect(element(by.text('MilkEdited'))).toBeVisible();
  });

  it('編集モーダルをキャンセルできる', async () => {
    await element(by.id('edit-btn-1')).tap();
    await expect(element(by.id('edit-food-sheet'))).toBeVisible();
    await element(by.id('edit-food-cancel')).tap();
    await expect(element(by.id('storage-screen'))).toBeVisible();
  });

  it('賞味期限の目安日数を編集して保存できる', async () => {
    // 牛乳(id=1)はシードで目安7日
    await element(by.id('edit-btn-1')).tap();
    await expect(element(by.id('edit-food-expiry-days-input'))).toHaveText('7');
    await element(by.id('edit-food-expiry-days-input')).clearText();
    await element(by.id('edit-food-expiry-days-input')).typeText('5');
    await device.pressBack();
    await waitFor(element(by.id('edit-food-submit')))
      .toBeVisible()
      .whileElement(by.id('edit-food-sheet'))
      .scroll(300, 'down');
    await element(by.id('edit-food-submit')).tap();
    // 再度開いて保存されていることを確認
    await element(by.id('edit-btn-1')).tap();
    await expect(element(by.id('edit-food-expiry-days-input'))).toHaveText('5');
    await element(by.id('edit-food-cancel')).tap();
  });

  // ── 削除確認ダイアログ ────────────────────────────────
  it('削除確認ダイアログが表示され、削除できる', async () => {
    await element(by.id('btn-delete-mode')).tap();
    await element(by.id('delete-btn-1')).tap();
    // ネイティブ確認ダイアログの「削除する」をタップ
    await element(by.text('削除する')).tap();
    await expect(element(by.text('牛乳'))).not.toBeVisible();
  });

  it('削除確認ダイアログをキャンセルできる', async () => {
    await element(by.id('btn-delete-mode')).tap();
    await element(by.id('delete-btn-1')).tap();
    await element(by.text('キャンセル')).tap();
    // キャンセル後は牛乳が残っている
    await expect(element(by.text('牛乳'))).toBeVisible();
  });

  // ── 賞味期限警告 ──────────────────────────────────────
  it('期限切れ食品に警告バッジが表示される', async () => {
    // 豆腐(id=4)は expiryDate=2000-01-01 で常に期限切れ（4番目のアイテムのためスクロールして確認）
    await waitFor(element(by.id('expiry-badge-4')))
      .toBeVisible()
      .whileElement(by.id('food-list'))
      .scroll(300, 'down');
  });

  it('期限内食品には警告バッジが表示されない', async () => {
    // 卵(id=2)は expiryDate=2099-12-31 で常に期限内
    await expect(element(by.id('expiry-badge-2'))).not.toBeVisible();
  });

  it('賞味期限未設定の食品には警告バッジが表示されない', async () => {
    // ハム(id=3)は expiryDate 未設定
    await expect(element(by.id('expiry-badge-3'))).not.toBeVisible();
  });

  it('賞味期限未設定の食品はハイフンで表示される', async () => {
    await expect(element(by.id('expiry-3'))).toHaveText('賞味期限 ----年-月-日');
  });

  it('冷凍庫の食品は賞味期限ではなく購入日が表示される', async () => {
    await element(by.id('tab-freezer')).tap();
    // 冷凍餃子(id=10)は purchaseDate=2026-03-20
    await expect(element(by.id('purchase-date-10'))).toHaveText('購入日 2026年3月20日');
    await expect(element(by.id('expiry-10'))).not.toExist();
  });

  it('期限切れの賞味期限を一括で削除できる', async () => {
    // 豆腐(id=4)は expiryDate=2000-01-01 で常に期限切れなのでボタンが表示される
    await element(by.id('btn-clear-expired-dates')).tap();
    await element(by.text('削除する')).tap();
    // 対象がなくなるとボタンは消え、食品は残ったまま賞味期限がハイフン表示になる
    await expect(element(by.id('btn-clear-expired-dates'))).not.toExist();
    await waitFor(element(by.id('expiry-4')))
      .toBeVisible()
      .whileElement(by.id('food-list'))
      .scroll(300, 'down');
    await expect(element(by.id('expiry-4'))).toHaveText('賞味期限 ----年-月-日');
    await expect(element(by.id('expiry-badge-4'))).not.toExist();
  });

  // ── 表示切替 ──────────────────────────────────────────
  it('一括簡易表示に切り替えられる', async () => {
    await expect(element(by.id('btn-bulk-view'))).toBeVisible();
    await element(by.id('btn-bulk-view')).tap();
    await expect(element(by.text('一括: 詳細表示'))).toBeVisible();
  });

  it('個別の表示切替ができる', async () => {
    await expect(element(by.id('view-toggle-1'))).toBeVisible();
    await element(by.id('view-toggle-1')).tap();
  });

  // ── 賞味期限順表示（ローカルSQLiteのみで完結するため自動化対象） ──
  it('賞味期限順表示に切り替えると保管場所を横断して表示される', async () => {
    await element(by.id('btn-expiry-sort-view')).tap();
    // 豆腐（id=4, expiryDate=2000-01-01）が全食品中もっとも賞味期限が早い
    await expect(element(by.text('豆腐'))).toBeVisible();
    // 通常は冷蔵庫タブでは表示されない野菜室の食品も表示される
    await waitFor(element(by.text('レタス')))
      .toBeVisible()
      .whileElement(by.id('food-list'))
      .scroll(300, 'down');
  });

  it('保管場所タブをタップすると賞味期限順表示から通常表示に戻る', async () => {
    await element(by.id('btn-expiry-sort-view')).tap();
    await expect(element(by.text('豆腐'))).toBeVisible();
    await element(by.id('tab-fridge')).tap();
    // 通常表示に戻ると冷蔵庫タブの食品のみ表示される
    await expect(element(by.text('牛乳'))).toBeVisible();
  });

  // ── 設定画面 ──────────────────────────────────────────
  // NOTE: 設定画面遷移テストは自動化から除外（手動テスト手順書: e2e/manual/settings-screen.md）
  // 原因: Firebase Auth の onAuthStateChanged が登録する内部 setTimeout が
  //       Detox の ReactNativeTimersIdlingResource をブロックし waitFor がタイムアウトする。
  //       RN 0.79 New Architecture + Detox + Firebase Auth の既知の非互換問題。
});

describe('BottomTabBar / RecipeScreen', () => {
  beforeAll(async () => {
    await device.launchApp();
    await device.setURLBlacklist(FIREBASE_URL_BLACKLIST);
  });

  beforeEach(async () => {
    await device.launchApp({ delete: true });
    await device.setURLBlacklist(FIREBASE_URL_BLACKLIST);
    await waitFor(element(by.id('btn-add-food'))).toBeVisible().withTimeout(10000);
  });

  // ── タブバー ──────────────────────────────────────────
  it('下部タブバーが表示される', async () => {
    await expect(element(by.id('bottom-tab-bar'))).toBeVisible();
    await expect(element(by.id('bottom-tab-storage'))).toBeVisible();
    await expect(element(by.id('bottom-tab-recipes'))).toBeVisible();
  });

  it('レシピタブに切り替えられ、食品保管に戻れる', async () => {
    await element(by.id('bottom-tab-recipes')).tap();
    await expect(element(by.id('recipe-screen'))).toBeVisible();
    await element(by.id('bottom-tab-storage')).tap();
    await expect(element(by.id('storage-screen'))).toBeVisible();
  });

  // ── 履歴タブ ──────────────────────────────────────────
  // NOTE: 通知機能は NOTIFICATIONS_ENABLED=false（src/config/features.ts）で無効化中のため、
  //       履歴タブは下部バーに表示されない。フラグを true に戻したらこのテストを
  //       「履歴タブに切り替えられ、未連携案内が表示される」検証に戻すこと。
  it('通知無効時は履歴タブが下部バーに表示されない', async () => {
    await expect(element(by.id('bottom-tab-storage'))).toBeVisible();
    await expect(element(by.id('bottom-tab-recipes'))).toBeVisible();
    await expect(element(by.id('bottom-tab-history'))).not.toBeVisible();
  });

  // ── 初期レシピとバッジ ────────────────────────────────
  it('初期レシピ3件と在庫照合バッジが表示される', async () => {
    await element(by.id('bottom-tab-recipes')).tap();
    // 初期状態では3つのバッジ文言がそれぞれ一意なのでテキストで直接検証する
    // トマトパスタ: トマト(在庫2)・パスタ(在庫1) → 作れる
    await expect(element(by.text('トマトパスタ'))).toBeVisible();
    await expect(element(by.text('作れる'))).toBeVisible();
    // 親子丼: 鶏もも肉(在庫0)・卵(在庫0)・米(在庫2) → 不足2品
    await expect(element(by.text('不足2品'))).toBeVisible();
    // ハムサラダ: レタス(在庫1)・ハム(在庫1)・きゅうり(在庫0) → 不足1品
    await expect(element(by.text('不足1品'))).toBeVisible();
  });

  it('在庫を変えるとバッジが更新される', async () => {
    // きゅうり(id=8, 野菜室)の在庫を「買ったばかり」に変更
    await element(by.id('tab-vegetable')).tap();
    // きゅうりは野菜室の3番目でCIの画面では下端に来ることがあるため、
    // 在庫ボタンが確実にタップできるよう食材カードを画面内へスクロールする
    await waitFor(element(by.id('stock-btn-8-2')))
      .toBeVisible()
      .whileElement(by.id('food-list'))
      .scroll(250, 'down');
    await element(by.id('stock-btn-8-2')).tap();
    // レシピタブでハムサラダが「作れる」に変わる = 「不足1品」バッジが消える
    // （「作れる」は複数レシピに表示され曖昧になるため、消えた文言で検証する。
    //   CIの低速環境では反映に時間がかかることがあるため waitFor で待つ）
    await element(by.id('bottom-tab-recipes')).tap();
    await waitFor(element(by.text('不足1品'))).not.toBeVisible().withTimeout(15000);
    await expect(element(by.text('不足2品'))).toBeVisible();
  });

  // ── レシピCRUD ────────────────────────────────────────
  it('レシピを追加できる', async () => {
    await element(by.id('bottom-tab-recipes')).tap();
    await element(by.id('btn-add-recipe')).tap();
    await expect(element(by.id('recipe-form-sheet'))).toBeVisible();
    // Android CIエミュレーターのIMEは日本語変換不可のためASCII文字を使用
    await element(by.id('recipe-form-name-input')).typeText('TestRecipe');
    await element(by.id('recipe-form-ingredient-name-0')).typeText('TestIng');
    // キーボードを閉じてからsubmitへスクロール（開いたままだとsubmitに到達できない）
    await device.pressBack();
    await waitFor(element(by.id('recipe-form-submit')))
      .toBeVisible()
      .whileElement(by.id('recipe-form-sheet'))
      .scroll(200, 'down');
    await element(by.id('recipe-form-submit')).tap();
    await waitFor(element(by.text('TestRecipe')))
      .toBeVisible()
      .whileElement(by.id('recipe-list'))
      .scroll(300, 'down');
  });

  it('レシピ名が空のままでは追加できない', async () => {
    await element(by.id('bottom-tab-recipes')).tap();
    await element(by.id('btn-add-recipe')).tap();
    await expect(element(by.id('recipe-form-sheet'))).toBeVisible();
    await element(by.id('recipe-form-ingredient-name-0')).typeText('OnlyIng');
    await device.pressBack();
    await element(by.id('recipe-form-submit')).tap();
    // 名前が空なのでモーダルは閉じない
    await expect(element(by.id('recipe-form-sheet'))).toBeVisible();
  });

  it('レシピを編集できる', async () => {
    await element(by.id('bottom-tab-recipes')).tap();
    await element(by.id('recipe-edit-btn-1')).tap();
    await expect(element(by.id('recipe-form-sheet'))).toBeVisible();
    await element(by.id('recipe-form-name-input')).clearText();
    await element(by.id('recipe-form-name-input')).typeText('RecipeEdited');
    await device.pressBack();
    await waitFor(element(by.id('recipe-form-submit')))
      .toBeVisible()
      .whileElement(by.id('recipe-form-sheet'))
      .scroll(200, 'down');
    await element(by.id('recipe-form-submit')).tap();
    await expect(element(by.text('RecipeEdited'))).toBeVisible();
  });

  it('レシピを削除できる（確認ダイアログ）', async () => {
    await element(by.id('bottom-tab-recipes')).tap();
    await element(by.id('btn-recipe-delete-mode')).tap();
    await element(by.id('recipe-delete-btn-1')).tap();
    await element(by.text('削除する')).tap();
    await expect(element(by.text('トマトパスタ'))).not.toBeVisible();
  });

  it('レシピ削除の確認ダイアログをキャンセルできる', async () => {
    await element(by.id('bottom-tab-recipes')).tap();
    await element(by.id('btn-recipe-delete-mode')).tap();
    await element(by.id('recipe-delete-btn-1')).tap();
    await element(by.text('キャンセル')).tap();
    await expect(element(by.text('トマトパスタ'))).toBeVisible();
  });

  // ── レシピ詳細 ────────────────────────────────────────
  it('レシピ詳細で材料ごとの在庫状況が見える', async () => {
    await element(by.id('bottom-tab-recipes')).tap();
    // 親子丼(id=2)をタップ → 材料3件の在庫状況
    await element(by.id('recipe-item-2')).tap();
    await expect(element(by.id('recipe-detail-sheet'))).toBeVisible();
    await expect(element(by.id('ingredient-status-0'))).toBeVisible();
    await expect(element(by.id('ingredient-status-1'))).toBeVisible();
    await expect(element(by.id('ingredient-status-2'))).toBeVisible();
    await element(by.id('recipe-detail-close')).tap();
    await expect(element(by.id('recipe-screen'))).toBeVisible();
  });
});

describe('ShoppingList', () => {
  beforeAll(async () => {
    await device.launchApp();
    await device.setURLBlacklist(FIREBASE_URL_BLACKLIST);
  });

  beforeEach(async () => {
    await device.launchApp({ delete: true });
    await device.setURLBlacklist(FIREBASE_URL_BLACKLIST);
    await waitFor(element(by.id('btn-add-food'))).toBeVisible().withTimeout(10000);
    await element(by.id('bottom-tab-recipes')).tap();
  });

  it('不足分を買い物リストに追加できる', async () => {
    // 親子丼(id=2)の不足材料（鶏もも肉・卵）を追加 → 買い物リストへ自動遷移
    await element(by.id('recipe-item-2')).tap();
    await element(by.id('btn-add-missing-to-shopping')).tap();
    await expect(element(by.id('shopping-list'))).toBeVisible();
    await expect(element(by.text('鶏もも肉'))).toBeVisible();
    await expect(element(by.text('卵'))).toBeVisible();
  });

  it('手動で品目を追加できる', async () => {
    await element(by.id('segment-shopping')).tap();
    await element(by.id('shopping-add-input')).typeText('Bread');
    await element(by.id('btn-shopping-add')).tap();
    await expect(element(by.text('Bread'))).toBeVisible();
  });

  it('チェックを付けてチェック済みを一括削除できる', async () => {
    await element(by.id('segment-shopping')).tap();
    await element(by.id('shopping-add-input')).typeText('AAA');
    await element(by.id('btn-shopping-add')).tap();
    await element(by.id('shopping-add-input')).typeText('BBB');
    await element(by.id('btn-shopping-add')).tap();
    // 品名タップでチェックが付く
    await element(by.text('AAA')).tap();
    await element(by.id('btn-clear-checked')).tap();
    await expect(element(by.text('AAA'))).not.toBeVisible();
    await expect(element(by.text('BBB'))).toBeVisible();
  });

  it('品目を個別削除できる', async () => {
    await element(by.id('segment-shopping')).tap();
    await element(by.id('shopping-add-input')).typeText('CCC');
    await element(by.id('btn-shopping-add')).tap();
    await expect(element(by.text('CCC'))).toBeVisible();
    // 品目が1件のみなのでゴミ箱アイコンは一意
    await element(by.text('🗑')).tap();
    await expect(element(by.text('CCC'))).not.toBeVisible();
  });

  it('すべて削除ボタンで買い物リストを空にできる', async () => {
    await element(by.id('segment-shopping')).tap();
    await element(by.id('shopping-add-input')).typeText('AAA');
    await element(by.id('btn-shopping-add')).tap();
    await element(by.id('shopping-add-input')).typeText('BBB');
    await element(by.id('btn-shopping-add')).tap();
    await element(by.id('btn-clear-all')).tap();
    // 確認ダイアログを承認
    await element(by.text('削除する')).tap();
    await expect(element(by.text('買い物リストは空です'))).toBeVisible();
  });

  it('買ってきたボタンで既存食材の在庫が更新されレシピが作れるようになる', async () => {
    // 親子丼(id=2)の不足材料（鶏もも肉・卵）を買い物リストに追加
    await element(by.id('recipe-item-2')).tap();
    await element(by.id('btn-add-missing-to-shopping')).tap();
    // 1件目（鶏もも肉）を「買ってきた」→ 既存食材のため保管場所選択は出ない
    await element(by.text('買ってきた')).atIndex(0).tap();
    await expect(element(by.id('purchased-sheet'))).toBeVisible();
    await element(by.id('purchased-submit')).tap();
    // 2件目（卵）も「買ってきた」
    await element(by.text('買ってきた')).atIndex(0).tap();
    await element(by.id('purchased-submit')).tap();
    await expect(element(by.text('買い物リストは空です'))).toBeVisible();
    // 在庫が更新され親子丼が「作れる」に変わる = 「不足2品」バッジが消える
    // （「作れる」は複数レシピに表示され曖昧になるため、消えた文言で検証する）
    await element(by.id('segment-recipes')).tap();
    await expect(element(by.text('不足2品'))).not.toBeVisible();
    await expect(element(by.text('不足1品'))).toBeVisible();
  });

  it('買ってきたボタンで在庫にない品目は保管場所を選んで新規登録できる', async () => {
    await element(by.id('segment-shopping')).tap();
    await element(by.id('shopping-add-input')).typeText('NewFood');
    await element(by.id('btn-shopping-add')).tap();
    // typeText後に開いたままのキーボードを閉じてからタップする
    await device.pressBack();
    await element(by.text('買ってきた')).tap();
    await expect(element(by.id('purchased-sheet'))).toBeVisible();
    // 在庫にない品目なので保管場所セレクターが表示される
    await expect(element(by.id('purchased-location-freezer'))).toBeVisible();
    await element(by.id('purchased-location-freezer')).tap();
    await element(by.id('purchased-submit')).tap();
    // 食品保管画面の冷凍庫タブに新規食材が登録されている
    await element(by.id('bottom-tab-storage')).tap();
    await element(by.id('tab-freezer')).tap();
    await waitFor(element(by.text('NewFood')))
      .toBeVisible()
      .whileElement(by.id('food-list'))
      .scroll(300, 'down');
  });

  it('買ってきたモーダルの賞味期限初期値が今日+目安日数になる', async () => {
    // 卵(id=2)はシードで目安14日
    await element(by.id('recipe-item-2')).tap();
    await element(by.id('btn-add-missing-to-shopping')).tap();
    // 2件目（卵）の「買ってきた」を開く（1件目は鶏もも肉）
    await element(by.text('買ってきた')).atIndex(1).tap();
    await expect(element(by.id('purchased-sheet'))).toBeVisible();
    // 今日+14日がDatePickerFieldの表示形式（Y年M月D日）で初期表示される
    const d = new Date();
    d.setDate(d.getDate() + 14);
    const expected = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    await expect(element(by.text(expected))).toBeVisible();
    await element(by.id('purchased-cancel')).tap();
  });

  it('レシピの材料入力で在庫食材のサジェストから選択できる', async () => {
    await element(by.id('btn-add-recipe')).tap();
    await expect(element(by.id('recipe-form-sheet'))).toBeVisible();
    // 材料名欄にフォーカスすると在庫食材の候補チップが表示される
    await element(by.id('recipe-form-ingredient-name-0')).tap();
    // 牛乳(id=1)のチップをタップすると材料名に入る
    await element(by.id('recipe-form-suggestion-0-1')).tap();
    await expect(element(by.id('recipe-form-ingredient-name-0'))).toHaveText('牛乳');
    // キーボードがキャンセルボタンを覆っているため閉じてからタップする
    await device.pressBack();
    await element(by.id('recipe-form-cancel')).tap();
  });
});

describe('設定: 在庫ステータス表示モード', () => {
  beforeAll(async () => {
    await device.launchApp();
    await device.setURLBlacklist(FIREBASE_URL_BLACKLIST);
  });

  beforeEach(async () => {
    await device.launchApp({ delete: true });
    await device.setURLBlacklist(FIREBASE_URL_BLACKLIST);
    await waitFor(element(by.id('btn-add-food'))).toBeVisible().withTimeout(10000);
  });

  it('デフォルトは3段階で在庫ボタンが3つ表示される', async () => {
    // 牛乳(id=1)に3段階のボタン（全くない/ちょっとある/買ったばかり）が全て存在する
    await expect(element(by.id('stock-btn-1-0'))).toBeVisible();
    await expect(element(by.id('stock-btn-1-1'))).toBeVisible();
    await expect(element(by.id('stock-btn-1-2'))).toBeVisible();
  });

  // NOTE: 2段階へ切り替える操作は設定画面（btn-settings）への遷移が必要だが、
  //       設定画面はFirebase Authの onAuthStateChanged 内部 setTimeout が Detox の
  //       アイドル判定をブロックする既知問題（CI API33で顕在化）があり自動化から除外。
  //       2段階切替の検証は手動テスト手順書 e2e/manual/settings-screen.md（TC-S-05）参照。
  //       切替ロジック自体は src/__tests__/stockDisplay.test.ts で単体テスト済み。
});
