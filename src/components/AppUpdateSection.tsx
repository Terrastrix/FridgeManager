import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import {
  currentContentLabel,
  fetchLatestUpdate,
  getCurrentUpdateInfo,
  restartToApplyUpdate,
} from '../services/AppUpdateService';

/** 設定画面の「アプリの更新」セクション */
export default function AppUpdateSection() {
  const [info] = useState(getCurrentUpdateInfo);
  const [isChecking, setIsChecking] = useState(false);

  async function handleCheck() {
    setIsChecking(true);
    try {
      const result = await fetchLatestUpdate();
      if (result === 'downloaded') {
        Alert.alert('更新があります', '新しい内容をダウンロードしました。アプリを再起動して反映しますか？', [
          { text: 'あとで', style: 'cancel' },
          { text: '再起動する', onPress: () => restartToApplyUpdate() },
        ]);
      } else {
        Alert.alert('最新の状態です', '新しい更新はありません。');
      }
    } catch (e) {
      Alert.alert('更新を確認できませんでした', e instanceof Error ? e.message : '不明なエラー');
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <View style={styles.section} testID="app-update-section">
      <Text style={styles.sectionTitle}>アプリの更新</Text>
      <Text style={styles.infoText} testID="app-update-current">
        現在の内容: {currentContentLabel(info)}
      </Text>
      {info.runtimeVersion && (
        <Text style={styles.hint} testID="app-update-runtime">
          ランタイムバージョン {info.runtimeVersion}
          {info.channel ? `（${info.channel}）` : ''}
        </Text>
      )}
      {info.isEnabled && (
        <TouchableOpacity
          testID="btn-check-update"
          style={[styles.btn, isChecking && styles.btnDisabled]}
          onPress={handleCheck}
          disabled={isChecking}
        >
          {isChecking ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.btnText}>更新を確認</Text>}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(13, 143, 122, 0.15)',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5c7a72',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoText: {
    fontSize: 14,
    color: '#1a2e2a',
  },
  hint: {
    fontSize: 12,
    color: '#9ab3ac',
  },
  btn: {
    backgroundColor: '#0d8f7a',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
