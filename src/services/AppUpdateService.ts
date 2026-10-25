import * as Updates from 'expo-updates';

/**
 * アプリ本体（ストア配信）を更新せずに、JavaScript とアセットだけを EAS Update で配信する。
 * 起動時にも自動で確認し、ダウンロードした更新は次回起動時に反映される（AndroidManifest の設定）。
 * ここでは設定画面から手動で確認・反映するための処理をまとめる。
 */

/** 'disabled': 開発ビルドなどで更新が無効 / 'upToDate': 最新 / 'downloaded': 新しい更新をダウンロード済み */
export type UpdateCheckResult = 'disabled' | 'upToDate' | 'downloaded';

export interface CurrentUpdateInfo {
  isEnabled: boolean;
  runtimeVersion: string | null;
  channel: string | null;
  /** アプリに内蔵された JavaScript で動いているか */
  isEmbeddedLaunch: boolean;
  /** 配信された更新で動いているときの、その更新の作成日時 */
  createdAt: Date | null;
}

export function getCurrentUpdateInfo(): CurrentUpdateInfo {
  return {
    isEnabled: Updates.isEnabled,
    runtimeVersion: Updates.runtimeVersion,
    channel: Updates.channel,
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    createdAt: Updates.createdAt,
  };
}

/** 新しい更新があればダウンロードする。反映は restartToApplyUpdate か次回起動時 */
export async function fetchLatestUpdate(): Promise<UpdateCheckResult> {
  if (!Updates.isEnabled) return 'disabled';
  const result = await Updates.checkForUpdateAsync();
  if (!result.isAvailable) return 'upToDate';
  await Updates.fetchUpdateAsync();
  return 'downloaded';
}

/** ダウンロード済みの更新でアプリを再起動する */
export async function restartToApplyUpdate(): Promise<void> {
  await Updates.reloadAsync();
}

/** 設定画面に出す「今動いている内容」の説明 */
export function currentContentLabel(info: CurrentUpdateInfo): string {
  if (!info.isEnabled) return '開発用のビルド（更新は無効）';
  if (info.isEmbeddedLaunch || !info.createdAt) return 'アプリに内蔵された版';
  const d = info.createdAt;
  const time = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${time} に配信された更新`;
}
