import * as fs from 'fs';
import * as path from 'path';

// EAS Update（expo-updates）の設定。android/ はコミット済みで prebuild しないため、
// `eas update` が使う app.json の設定と、ビルドに埋め込まれるネイティブ側の設定が
// 食い違っていないかをここで検証する。
// 食い違うと、配信した更新がアプリに届かない（URL・チャンネル・ランタイムバージョンの不一致）。

const ROOT = path.join(__dirname, '..', '..');
const read = (relativePath: string) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

const appJson = JSON.parse(read('app.json')).expo;
const easJson = JSON.parse(read('eas.json'));
const manifest = read('android/app/src/main/AndroidManifest.xml');
const strings = read('android/app/src/main/res/values/strings.xml');

function metaData(name: string): string | undefined {
  const tag = manifest.match(new RegExp(`<meta-data[^>]*android:name="expo\\.modules\\.updates\\.${name}"[^>]*/>`))?.[0];
  return tag?.match(/android:value=(?:"([^"]*)"|'([^']*)')/)?.slice(1).find((v) => v !== undefined);
}

describe('EAS Update の設定', () => {
  const projectId: string = appJson.extra.eas.projectId;

  it('EAS のプロジェクトIDが設定されている', () => {
    expect(projectId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('app.json の更新URLがプロジェクトIDと一致する', () => {
    expect(appJson.updates.url).toBe(`https://u.expo.dev/${projectId}`);
  });

  it('AndroidManifest で更新が有効になっていて、URLが app.json と一致する', () => {
    expect(metaData('ENABLED')).toBe('true');
    expect(metaData('EXPO_UPDATE_URL')).toBe(appJson.updates.url);
  });

  it('ランタイムバージョンが app.json と strings.xml で一致する', () => {
    expect(typeof appJson.runtimeVersion).toBe('string');
    expect(metaData('EXPO_RUNTIME_VERSION')).toBe('@string/expo_runtime_version');
    const runtimeVersion = strings.match(/<string name="expo_runtime_version">([^<]*)<\/string>/)?.[1];
    expect(runtimeVersion).toBe(appJson.runtimeVersion);
  });

  it('更新を取りに行くチャンネルが app.json・AndroidManifest・eas.json で一致する', () => {
    const channel = appJson.updates.requestHeaders['expo-channel-name'];
    expect(channel).toBe('production');
    expect(JSON.parse(metaData('UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY')!)).toEqual({
      'expo-channel-name': channel,
    });
    expect(easJson.build.production.channel).toBe(channel);
  });

  it('起動時に更新を確認し、起動は待たずに次回起動時に反映する', () => {
    expect(metaData('EXPO_UPDATES_CHECK_ON_LAUNCH')).toBe('ALWAYS');
    expect(metaData('EXPO_UPDATES_LAUNCH_WAIT_MS')).toBe('0');
    expect(appJson.updates.checkAutomatically).toBe('ON_LOAD');
    expect(appJson.updates.fallbackToCacheTimeout).toBe(0);
  });
});
