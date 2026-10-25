// Firestore セキュリティルールのテスト用設定（npm run test:rules でエミュレータ上で実行する）
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/firestore-rules-tests/**/*.test.ts'],
  testTimeout: 20000,
  // テストファイルは同じエミュレータのデータを使い、afterEach で clearFirestore する。
  // 並行して動かすと他のファイルのデータを消してしまうため、1ファイルずつ順に実行する
  maxWorkers: 1,
};
