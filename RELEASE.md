# リリース手順（Android / Google Play）

このドキュメントは FridgeManager を Google Play にリリースするための手順書です。
コード側の準備（リリース署名の仕組み・Firestoreデプロイ設定）は済んでいるので、
以下の**手動作業**を上から順に実施してください。

前提:
- このアプリは EAS を使わず、ローカルの `gradlew` で直接ビルドします（bare workflow）。
- 通知機能はフィーチャーフラグ（`src/config/features.ts` の `NOTIFICATIONS_ENABLED=false`）で
  無効化中です。実機2台でテストできる環境が整ったら `true` に戻して再ビルドしてください。
- プロジェクトルートは `C:\dev\github.com\Terrastrix\FridgeManager` です。
- 手作業のコマンドは**コマンドプロンプト（cmd）**で動く形で書いています（1章の keytool だけは Git Bash 用の書式のままです）。
- Android のビルドには **JDK 17** を使います（Android Studio 同梱の Java 25 では Gradle 8.14 が起動しません）。

## 進捗（2026-09-19 時点）

| 手順 | 状態 |
|---|---|
| 1. リリース用キーストア | ✅ 完了 |
| 2. Firestore ルールのデプロイ | ✅ 完了（ルールを変えたら再デプロイ） |
| 3. SHA-1 登録・OAuth クライアント・公開ステータス | ✅ 完了（クローズドテストで配布する前に、Play のアプリ署名鍵の SHA-1 を追加する） |
| 4. プライバシーポリシー | ✅ 公開済み。Play Console への URL 登録は未 |
| 5. AAB ビルドと Play Console 提出 | ⬜ 未着手 |

---

## 1. リリース用キーストアの生成（必須・一度だけ）✅ 完了

> **重要**: このキーストアは今後のアプリ更新すべてに必要です。**紛失すると同じアプリとして更新できなくなります**。
> 必ず安全な場所（パスワード管理ツール等）にバックアップしてください。パスワードも同様。

### 1-1. キーストアを生成する

`keytool` は JDK に含まれます。JDKのbinにパスが通っていない場合は `where keytool`（PowerShell）や
`$JAVA_HOME/bin/keytool` で場所を確認してください。プロジェクトルートで実行:

```bash
keytool -genkeypair -v -storetype JKS \
  -keystore android/app/upload-keystore.jks \
  -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

対話で以下を聞かれます:
- キーストアのパスワード（2回）… 控えておく
- 姓名・組織などの情報（適当でよいが後で変更不可）
- 鍵のパスワード（キーストアと同じでよい場合はEnter）

> `android/app/upload-keystore.jks` と、後述の `android/keystore.properties` は
> `.gitignore` 済みでコミットされません（秘密情報のため）。

### 1-2. keystore.properties を作成する

テンプレートをコピーして値を記入:

```bash
cp android/keystore.properties.example android/keystore.properties
```

`android/keystore.properties` をエディタで開き、1-1で決めた値に書き換える:

```properties
storeFile=app/upload-keystore.jks
storePassword=（キーストアのパスワード）
keyAlias=upload
keyPassword=（鍵のパスワード）
```

このファイルが存在すると、release ビルドが自動的にこのキーストアで署名されます
（存在しなければ debug 署名にフォールバックするので、開発・CIには影響しません）。

---

## 2. Firestore セキュリティルールのデプロイ（必須）✅ 完了

> ルールが未反映だと、DBが「全拒否」または「無防備」の状態になり得ます。
> `firestore.rules` はリポジトリにあり、`firebase.json` / `.firebaserc`（プロジェクト `fridgemanager-64c00`）も
> 用意済みなので、以下を実行するだけです。

```bash
# Firebase CLI 未インストールなら
npm install -g firebase-tools

# ブラウザが開くのでプロジェクトの権限を持つGoogleアカウントでログイン
firebase login

# ルールをデプロイ
firebase deploy --only firestore:rules
```

デプロイ後、Firebase Console → Firestore Database → ルール で反映を確認してください。

> **`firestore.rules` を変更したとき**は、デプロイ前に `npm run test:rules` でルールのテスト
> （Firestore エミュレータ上で実行。Java 21 以上が必要）が通ることを確認し、変更をマージしてから再デプロイしてください。
> CI（Unit Tests ワークフローの `firestore-rules` ジョブ）でも同じテストが走ります。

---

## 3. リリース署名証明書を Google 認証に登録（共有機能を使うなら必須）✅ 完了

release キーストアで署名したアプリでは、debug 証明書向けの現在の Google Client ID では
**Googleサインインが失敗します**。release 証明書の SHA-1 を登録し直す必要があります。

### 3-1. release キーストアの SHA-1 / SHA-256 を取得

```bash
keytool -list -v -keystore android/app/upload-keystore.jks -alias upload
```

出力の `SHA1:` と `SHA256:` の値をコピーします。

### 3-2. Firebase に登録

1. [Firebase Console](https://console.firebase.google.com/) → プロジェクト `fridgemanager-64c00`
2. ⚙️ プロジェクトの設定 → 「マイアプリ」の Android アプリ（`com.terrastrix.fridgemanager`）
   （2026-09 にアプリIDを変更。未登録なら「アプリを追加」→ Android で新規登録する）
3. 「フィンガープリントを追加」→ 3-1 の **SHA-1** を貼り付け（SHA-256も推奨）→ 保存
4. `google-services.json` を使っていれば再ダウンロード（このアプリは firebase.ts に直書きのため不要）

### 3-3. Android用 OAuth クライアントIDの確認

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → プロジェクト `fridgemanager-64c00`
2. 「OAuth 2.0 クライアント ID」に、パッケージ名 `com.terrastrix.fridgemanager` +
   release の SHA-1 に対応する **Android タイプ** のクライアントがあることを確認
   （Firebaseでフィンガープリント登録すると自動生成される場合があります。無ければ手動作成）
3. `.env` の `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` が上記Androidクライアントを指しているか確認
   （Web Client ID `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` は変更不要）

4. Android クライアントの「詳細設定」で **「カスタム URI スキームを有効にする」** にチェック
   （無いと「Custom URI scheme is not enabled」で失敗する）
5. `.env` を変えたら `android/app/build` を削除してから再ビルド（値はビルド時にアプリへ埋め込まれる）

> **確認方法**: release ビルドを実機に入れ、「家族と共有する」でGoogleサインインが通ることを必ず確認。
> 失敗する場合はほぼ SHA-1 の不一致です。

### 3-4. Google ログインの公開ステータス

[Google Auth Platform → 対象](https://console.cloud.google.com/auth/audience?project=fridgemanager-64c00) の
「公開ステータス」を **本番環境** にする（「テスト中」だとテストユーザー以外はログインできない）。
2026-09-19 時点で本番環境（「テストに戻る」ボタンが表示されている状態）。

### 3-5. クローズドテストで配布する前にやること

Google Play では、アップロードした AAB を Google がアプリ署名鍵で署名し直して配布します。
製品版だけでなく、クローズドテストなどのテスト版も同じです。
**Play から入れたアプリの SHA-1 は upload 鍵と異なる**ため、登録しないとテスターが
「家族と共有する」を押したときに Google サインインが失敗します。

最初の AAB をアップロードしたら（5-2 の手順4）、テスターに配布する前に次の手順で登録してください。

1. Play Console の「テストとリリース → 設定 → アプリの完全性 → アプリ署名」にある
   「アプリ署名鍵の証明書」の SHA-1 をコピーする
2. 3-2 と同じ手順で Firebase に追加する
3. 同じ SHA-1 の Android 用 OAuth クライアントを用意する（「カスタム URI スキームを有効にする」も忘れずに）

---

## 4. プライバシーポリシー（必須）✅ 公開済み

Google/匿名認証でユーザーデータ（食材・共有グループ情報・Googleアカウントのメール）を扱うため、
Google Play はプライバシーポリシーURLを要求します。

1. プライバシーポリシーを作成（最低限: 収集するデータ=食材データ・アカウント情報・共有相手のデータ、
   保存先=Google Firebase、第三者提供なし、問い合わせ先）
2. 公開URL: https://terrastrix.github.io/FridgeManager/privacy-policy.html
   （`docs/privacy-policy.html` を GitHub Pages で公開済み）
3. Play Console の「ストアの設定」とデータセーフティで URL を登録（未）

---

## 5. AAB（App Bundle）のビルドと Play Console 提出（必須）

### 5-1. リリースビルド

コマンドプロンプト（cmd）で:

```bat
cd /d C:\dev\github.com\Terrastrix\FridgeManager\android
set "JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot"
set "PATH=C:\Program Files\nodejs;%PATH%"
gradlew.bat bundleRelease
```

成果物: `android/app/build/outputs/bundle/release/app-release.aab`

> 署名が正しいか確認するには `gradlew.bat :app:signingReport` を実行し、
> `Variant: release` の `Store` が `upload-keystore.jks` になっていることを確認。

### 5-2. Play Console

1. [Google Play Console](https://play.google.com/console/) でアプリを新規作成
2. アプリ内容の申告（対象年齢・データセーフティ・コンテンツのレーティング・広告の有無）
3. ストア掲載情報（アプリ名・説明・スクリーンショット各サイズ・アイコン512px・フィーチャーグラフィック1024x500）
4. 「テスト」→「クローズドテスト」トラックに AAB をアップロード
5. 3-5 の手順で、Play のアプリ署名鍵の SHA-1 を Firebase と OAuth クライアントに登録
6. テスターを招待
7. **2023-11-13 以降に作成した個人デベロッパーアカウントは、12人以上のテスターが14日間連続で参加し、
   実際にアプリを使ったこと**が製品版公開の申請条件
   （[公式ヘルプ](https://support.google.com/googleplay/android-developer/answer/14151465)）。
   条件を満たしたらダッシュボードから製品版へのアクセスを申請する
8. 審査提出 → 承認後に公開

> **バージョン更新時**: `android/app/build.gradle` の `versionCode`（現在1）を必ず+1、
> `versionName`（現在1.0.0）も適宜更新してから再ビルド。

---

## 補足・任意対応

- **未使用の通知権限**: `app.json` に `expo-notifications` プラグインが残っており、
  Androidに `POST_NOTIFICATIONS` 権限が注入されます（通知はフラグで無効化中のため実際には使いません）。
  権限をクリーンにしたい場合はプラグイン行を一時的に外して `npx expo prebuild --platform android` で
  android/ を再生成できますが、通知を再有効化する予定なら残しておくのが簡単です。
- **通知機能の再有効化**: `src/config/features.ts` の `NOTIFICATIONS_ENABLED` を `true` にし、
  `eas init` で `app.json` の `extra.eas.projectId` を設定 → 再ビルド。詳細は `e2e/manual/notifications.md`。
