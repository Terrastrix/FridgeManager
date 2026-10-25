# PROGRESS

最終更新: 2026-09-19

## 現在の状態

**リリース準備フェーズ。コード側・Firebase/Google Cloud 側の準備は完了し、残りは Play Console での作業のみ。
CI（Unit / Firestore ルール / E2E）グリーン。**

- **Expo SDK 54 の推奨バージョンに依存を揃えた**（React Native 0.81.5 / React 19.1）。`npx expo install --check` で差分なし
- **アプリIDは `com.terrastrix.fridgemanager`**（2026-09-18 に `com.clayfalcon.fridgemanager` から変更。Play 未公開だったため可能だった）
- **家族共有を実機2台（スマホ＋エミュレータ、release ビルド）で一通り確認済み**:
  Google 連携 → 初回データ移行（一括書き込みで2〜3秒）→ 招待コード発行・参加 → 在庫変更の相互反映 →
  メンバー削除（参加者側は開いたまま自分の冷蔵庫に戻る）→ アプリ入れ直し後の共有再開
- 家族に表示する名前（メンバー一覧・共有状態に表示、設定画面で変更可）を追加
- **通知機能はフィーチャーフラグで無効化中**（`src/config/features.ts` の `NOTIFICATIONS_ENABLED=false`）。
  プッシュ通知はEAS設定+実機2台のテストが必要でリリースのネックになるため。true に戻すだけで全機能復活。
  無効化対象: 他メンバー通知ボタン・トークン登録・賞味期限ローカル通知・通知設定セクション・通知タップ遷移・履歴タブ
- **Auth永続化は AsyncStorage**（`src/config/firebase.ts`）。再起動後もログイン保持
- 実装済み機能: レシピCRUD+在庫照合、買い物リスト、賞味期限目安日数、在庫ステータス2/3段階切替、
  購入日（冷凍庫・パントリーは賞味期限の代わりに購入日を記録）、期限切れの賞味期限の一括削除、
  EAS Update によるアプリ内容の更新配信（手順は `RELEASE.md` の6章）、
  履歴タブ（通知有効時のみ）、Google連携による家族共有（招待コード・メンバー管理・表示名）
- データは2層構成（ローカルSQLite / Googleリンク時Firestore共有）

Jest 279件・Firestore ルールテスト 24件・Detox E2E 47件。

## 次にやること（リリースまで）

**詳細手順は `RELEASE.md`。以下はすべて手動（ユーザー）作業。**

完了済み（2026-09-19 時点）: リリース用キーストアと署名設定 / Firestore ルールのデプロイ /
release の SHA-1 を Firebase・OAuth クライアントに登録 / Google Auth Platform の公開ステータス「本番環境」/
プライバシーポリシー公開（https://terrastrix.github.io/FridgeManager/privacy-policy.html）/ ストア掲載文（`docs/store-listing.md`）

1. **Play Console のデベロッパーアカウント登録**（登録料・本人確認）
2. **クローズドテスト**: 2023-11-13 以降に作成した個人アカウントは、12人以上のテスターが14日間連続で参加し、
   実際に使ったことが製品版の申請条件。リリース日程に最も影響するので早めに始める
3. ストア掲載用画像（アイコン512px・フィーチャーグラフィック1024x500・スクリーンショット）とアプリ内容の申告
   （データセーフティ・コンテンツのレーティング・対象年齢・広告の有無）
4. AAB ビルド（`bundleRelease`）→ クローズドテストのトラックにアップロード
5. テスターに配布する前に、**Play のアプリ署名鍵の SHA-1** を Firebase と OAuth クライアントに追加
   （無いと Play から入れたアプリで Google ログインが失敗する。クローズドテスト版も Play が署名し直すため同じ）

**残Issue**: #13（テーマカラー）、#11・#16（プッシュ通知＝通知フラグを true に戻すのは実機2台が揃ってから）

## 判明した重要事項（2026-09-18〜19）

- **ローカルで Android ビルドするには JDK 17**（`C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot`）。
  Android Studio 同梱の Java 25 では Gradle 8.14 が起動しない（エラーメッセージは「25.0.3」とだけ出る）。
  一方、**Firestore エミュレータ（`npm run test:rules`）は Java 21 以上が必要**なので、こちらは Android Studio 同梱の Java を使う
- **Google サインイン（expo-auth-session）の Android 固有の注意点**
  - サインイン後は `{applicationId}:/oauthredirect` でアプリに戻るため、AndroidManifest の intent-filter にパッケージ名の scheme が必要
    （`src/__tests__/androidManifest.test.ts` で app.json と照合）
  - Android では認可コード（PKCE）が返る。フックの自動交換は結果を `promptAsync` の戻り値に載せないため、
    `shouldAutoExchangeCode: false` にして `exchangeCodeAsync` で自前で交換している
  - Android 用 OAuth クライアントは「カスタム URI スキームを有効にする」が必要。`.env` の `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
    はビルド時に埋め込まれるので、変えたら `android/app/build` を消して再ビルド
  - 既存ユーザーにつながった Google アカウントでリンクすると `auth/credential-already-in-use`。この場合は
    `signInWithCredential` でログインし直し、端末データは移行しない（ID が重なり家族のデータを上書きするため）
- **Android の自動バックアップ（`allowBackup="true"`）**で、同じ端末に入れ直すとログイン状態も復元される。
  入れ直し後の共有再開処理を実機で試すには `adb shell pm clear com.terrastrix.fridgemanager` でデータを消す
- **Firestore のドキュメントは偶数階層**でないと SDK がエラーにする。単体テストのモックが素通しだったため
  `users/{uid}/profile`（奇数階層）の不具合を見逃していた → モックも奇数階層をエラーにするようにした
- **Firestore ルールは `firestore-rules-tests/` でエミュレータ上でテスト**（`npm run test:rules`、CI の `firestore-rules` ジョブ）。
  ルールを変えたらテストを通してからデプロイする。本番への反映は `firebase deploy --only firestore:rules`
- **react-native 標準の `SafeAreaView` は Android では効かない**。edge-to-edge 表示で画面上部のボタンがステータスバーと重なり
  押せなくなるため、画面は `react-native-safe-area-context` の `SafeAreaView` を使う（`src/__tests__/safeArea.test.ts` で検証）
- **Firebase の確認は Firebase MCP サーバー**（`.mcp.json`、Git 対象外）で行える。参照系は常時許可・更新系は都度確認の
  権限設定を `.claude/settings.local.json` に入れてある

## 判明した重要事項

- **Auth永続化（2026-09-12変更）**: `firebase.ts` は `getReactNativePersistence(AsyncStorage)` を使用。
  `getReactNativePersistence` は `firebase/auth` のRNビルド(dist/rn)にのみ存在し、Nodeでは undefined だが
  Metroがreact-native条件で解決するため実行時に利用可能。型は名前空間import経由で取得（非RNビルドの型に無いため）。
  → 旧「inMemoryPersistenceで再起動リセット」の記述は無効。
- **設定画面のDetox自動化はCI（API33）では不安定**（`onAuthStateChanged` の setTimeout がアイドルをブロック）。
  ローカルAPI36では通るがCIでは落ちるので設定画面遷移E2Eはpushしない。手動TC+ロジック単体テストで担保。
- ステータスモード等アプリ全体の表示設定は `AppSettingsContext` + `AppSettingsStore`（SQLite）で配布・永続化。

## 判明した重要事項（2026-07-26 追記）

- **設定画面のDetox自動化はCI（API33エミュレータ）では依然として不安定**。Firebase Auth の
  `onAuthStateChanged` 内部 setTimeout がアイドル判定をブロックする既知問題。`.env`クラッシュ修正後、
  ローカルのAPI36エミュレータでは設定画面遷移テストが通るようになったが、**CIのAPI33では再びタイムアウト**した。
  → 設定画面に遷移するE2Eは引き続き自動化を避け、手動テスト手順書（`e2e/manual/settings-screen.md`）+
    ロジックの単体テストで担保する方針。設定画面に触れない範囲（デフォルト表示の確認等）は自動化可。
- ステータスモードのようなアプリ全体に効く表示設定は `AppSettingsContext`（`src/context/AppSettingsContext.tsx`）
  で配布し、`AppSettingsStore`（SQLite単一行、通知設定と同じパターン）で端末ローカル永続化する。

## CI（E2E）が4月以降ずっと赤だった原因と対策（2026-07-21 解決）

4月13日を最後にE2Eが通らなくなっていたのは、**独立した複数の問題の積み重なり**だった:

1. **CIランナーのライブラリ不足**: `ubuntu-latest` イメージ更新で `libpulse0`/`libxkbfile1` 等が
   同梱されなくなりエミュレータ(qemu)が起動不能 → `e2e.yml` で `apt-get install` する
2. **`.env` がCIに存在しない（真因・4/29から潜在）**: `Google.useIdTokenAuthRequest` は
   `androidClientId` が undefined だとレンダー時に throw し、**アプリが1pxも描画されず**
   Detoxのready待ちがタイムアウト。`.env` はgitignore対象なのでローカルでは気づけなかった。
   → `FirebaseAuthService.ts` でダミーclientIdを渡してフックを成立させ、実操作は既存ガードで弾く
3. **ボトムタブバーがナビバーと重なる**: 3ボタンナビ端末（CIのPixel 5 API 33）で「レシピ」タブの
   タップがリセントボタンに吸われていた → `SafeAreaProvider` + `useSafeAreaInsets` で下部インセット
4. **テストコード自体の不備**: 存在しない `toHaveDescendant`、タブ追加による文言の曖昧マッチ、
   モーダル縦伸びでキーボードがsubmitを覆う、野菜室3番目のきゅうりの在庫ボタンがCI画面下端で
   タップ不発 → whileElementスクロール等で対処
5. **Detox本体のバグ2件**（patch-package）: Fabric UIManager未生成時のnullクラッシュ、
   スタックmount itemでのアイドル判定無限待ち → `FabricUIManagerIdlingResources.kt` にパッチ

**教訓**: ローカルとCIの差分は「.envの有無」と「ナビゲーションモード（3ボタン vs ジェスチャー）」。
ローカル検証時は `mv .env .env.bak` でCI相当ビルドを作り、`adb shell cmd overlay enable
com.android.internal.systemui.navbar.threebutton` で3ボタンナビに切り替えると再現できる。
失敗時は `detox test ... --record-logs failing --take-screenshots failing` でアーティファクト取得。

## 判明した重要事項

- `src/config/firebase.ts` は `initializeAuth(app, { persistence: inMemoryPersistence })` を使用しており、
  **Auth状態はアプリ再起動で失われる**（Detoxの `onAuthStateChanged`/`setTimeout` ハング回避のための意図的な設計）。
  そのため通知設定は `request.auth.uid` に依存するFirestoreではなく、端末ローカルSQLite
  （`src/db/NotificationSettingsStore.ts`）を正として実装した。Firestoreへのミラーは複数端末同期用の保存のみ。
- Firestoreルールをこのプロジェクトで初めて `firestore.rules` として追加した（従来はFirebase Console管理のみ）。
  デプロイには `firebase deploy --only firestore:rules` が必要（ユーザーの手動対応）。
- Expo Push APIはサーバー不要でクライアントから直接呼べる（`https://exp.host/--/api/v2/push/send`）。
  ただしこれは「正規アプリ間の協調的なレート制限」であり、改造クライアントに対する強制力はない
  （Firestoreルールの5分クールダウンチェックが実効的な防御線）。
- `expo-notifications` のプッシュトークン取得には EAS プロジェクトID（`app.json` の `extra.eas.projectId`）が必須。
  未設定の間は `PushTokenService.registerPushToken` がフェイルソフトでno-opになる設計にしてある。
- iOSはローカル通知の同時予約上限が64件。`src/utils/expiryScheduling.ts` の `computeNotificationPlan` で
  同日・同時刻の複数食材を1通知にバッチ化し、上限で発火が早い順にトリムする設計にした。
- Jest単体テストで `expo-sqlite` をモックする際、`const mockDb = {...}` を jest.mock ファクトリの**外側**で定義すると
  Babelのimport hoistingにより `TypeError: Cannot read properties of undefined` になる（TDZではなく`var`化により
  無言でundefinedになる）。モック対象オブジェクトは必ずファクトリ**内部**で生成し、`__mockXxx` のような形で
  再エクスポートしてテスト側から参照すること（`src/__tests__/NotificationSettingsStore.test.ts` 参照）。
- このリポジトリの `npm run test:coverage` のカバレッジ80%閾値は、CI（`unit-test.yml`）では
  `npm run test:unit`（`--coverage`なし）しか実行されないため**実質的にCIをゲートしていない**。
  画面コンポーネント（StorageScreen/SettingsScreen等）は元々0%カバレッジで、新規実装も同様の方針
  （ロジックは純粋関数に分離してテストし、JSX配線自体は未テスト）で問題ない。
- ~~`npx tsc --noEmit` は tsconfig.json の設定不備で失敗する~~ → 2026-09-18 に解消（`moduleResolution` の上書きを削除）。
  現在はリポジトリ全体で `npx tsc --noEmit` が通る。
- `npx eslint` も `.eslintrc.json` が参照する `eslint-config-prettier` が未解決でリポジトリ全体として動かない
  （pre-existing、本セッションでは対応せず）。

## 作業ログ

### 2026-09-18〜19（リリース前の総点検）
- PR #17: Expo SDK 54 の推奨バージョンに依存を揃えた（RN 0.81.5、MainApplication を SDK 54 テンプレートに）、
  アプリIDを `com.terrastrix.fridgemanager` に変更、ClayFalcon 表記を Terrastrix に統一
- PR #18: 実機で「家族と共有する」が最後まで動かなかった問題を修正（intent-filter、認可コード交換、初回移行の uid、
  一括書き込みで待ち時間短縮と待機メッセージ、入れ直し後の共有再開）
- PR #19: 招待コードで参加できない不具合（profile の奇数階層）、招待なしで参加できるルールの穴、
  メンバー削除の即時反映、画面上部のボタンがステータスバーに潜る不具合を修正。Firestore ルールのテストを新設
- PR #20: 家族に表示する名前を追加、参加完了・共有状態の文言を「○○ さんの冷蔵庫」に変更
- Firebase 側: Android アプリ（新ID）と SHA-1 の登録、OAuth クライアントの設定、Firestore ルールの本番反映、
  匿名認証の有効化を実施。Firebase CLI と Firebase MCP サーバーを導入


### 2026-07-20（賞味期限の目安日数）
- FoodItem に `defaultExpiryDays`（賞味期限の目安日数）を追加
  - SQLite: `food_items` に `default_expiry_days` カラム追加。既存インストール向けに
    try/catch付き `ALTER TABLE` マイグレーション（重複カラムエラーは無視）
  - 食材の追加/編集モーダルに「賞味期限の目安（日数）」入力欄を追加（数字のみ）
  - シード食材16件に目安日数を設定（卵14日・鶏もも肉2日・米365日など）
- 「買ってきた」モーダルの賞味期限初期値を「今日+目安日数」に変更
  （`defaultExpiryDateFor`/`initialPurchaseExpiryDate` を `expiryUtils.ts` に追加。
  目安未設定の食材・在庫にない新規品目は**翌日**を初期値にする。
  以前の「古い賞味期限を引き継ぐ」挙動は廃止）
- Jest 16件追加（全124件）、Detox E2E 2件追加（目安日数の編集保存・買ってきた初期値）

### 2026-07-19（レシピタブ改善）
- ユーザーフィードバック対応:
  - 材料名の表記ゆれ対策: `normalizeIngredientName` にひらがな→カタカナ変換を追加
    （「とりももにく」=「トリモモニク」。漢字↔かなは別物のまま）。
    加えて `RecipeFormModal` に在庫食材のサジェストチップを追加（フォーカスで候補表示、
    タップで確定入力。自由入力も引き続き可能）
  - 買い物リストに「すべて削除」（確認ダイアログ付き一括削除）と品目ごとの「買ってきた」ボタンを追加
    （`PurchasedModal`: 既存食材なら在庫を「買ったばかり」+賞味期限更新、在庫にない品目は
    保管場所を選んで新規食材として登録。処理後リストから削除）
  - `ShoppingRepository.clearAll()` を Local/Cloud に追加、`findFoodByName` を照合ユーティリティに追加
- Jest 6件追加（全108件）、Detox E2E 4件追加

### 2026-07-19（レシピタブ）
- レシピタブ・買い物リスト・ボトムタブバーを実装（5コミットに分割）
  - 型 + `recipeMatching.ts`（NFKC正規化・在庫照合の純粋関数）
  - リポジトリ層（Local/Cloud × Recipe/Shopping、`initialRecipes.json` シード3件、
    `MigrationService` ジェネリック化、`firestore.rules` に recipes/shopping_items 追加）
  - `BottomTabBar` + `App.js` タブ統合（設定は⚙️遷移のまま。通知ディープリンクは食品保管タブへ）
  - `RecipeScreen`（セグメント切替: レシピ/買い物リスト）+ `RecipeCard`/`RecipeFormModal`/
    `RecipeDetailModal`/`ShoppingListView`
  - ID採番は再起動時の主キー衝突を避けるため `Date.now()` 起点の連番（食品の `nextId=100` 方式は不採用）
  - Jest 44件追加（全102件）、Detox E2E 14件追加
- 設計判断: 買い物リストはレシピタブ内セグメント（第3タブにしない）。レシピデータモデルは
  Reizoukoより大幅簡素化（材料は `{name, quantity?}` のみ、難易度・必須/任意区分なし）

### 2026-07-19
- Issue #14を実装済みとしてクローズ、未コミット差分（.gitignore整備・CLAUDE.md・docsモックアップ）をコミットしてpush
- Issue #11（プッシュ通知）の要件をヒアリングし、Plan Modeでアーキテクチャを設計
  - Cloud Functions/Blazeプランを避け、Expo Push直接呼び出し + ローカル通知 + Firestoreルールでのレート制限方式に決定
- 実装:
  - 依存関係追加（expo-notifications, expo-device, expo-constants）、`app.json`設定、`firestore.rules`新規作成
  - 純粋関数群: `notificationMessages.ts`, `expiryScheduling.ts`, `notificationTier.ts`, `expirySort.ts`（+テスト22件）
  - `NotificationSettingsStore.ts`（SQLite）、`ExpiryNotificationScheduler.ts`、`useExpiryNotificationScheduler.ts`
  - `SettingsScreen.tsx`に通知設定UI（無料/有料プラン、`TimePickerField.tsx`新規）を追加
  - `StorageScreen.tsx`に賞味期限順表示モード・「共有メンバーに通知する」ボタンを追加、`FoodItemCard.tsx`に保管場所バッジ追加
  - `useNotificationDeepLink.ts`（通知タップ遷移）、`App.js`に各フックを配線
  - `PushTokenService.ts`・`PushNotificationService.ts`（Expo Push直接送信・レート制限）+テスト
  - Detox E2E: 賞味期限順表示のローカル完結テストを`e2e/app.e2e.js`に追加
  - `e2e/manual/notifications.md`（手動テスト手順書）を新規作成
- 履歴タブ用の別Issue #15 を作成（#11から派生、Firestore権限・遷移導線は転用できるよう設計済み）
- 全69件のJest単体テストが成功（新規39件）
