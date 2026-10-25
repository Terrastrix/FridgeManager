import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useSharing } from '../context/SharingContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { useRepository } from '../hooks/useRepository';
import { AuthService } from '../services/AuthService';
import LinkGoogleButton from '../components/LinkGoogleButton';
import DisplayNameModal from '../components/DisplayNameModal';
import AppUpdateSection from '../components/AppUpdateSection';
import { JOINED_TITLE, joinedMessage, sharingStatusLabel } from '../utils/sharingMessages';
import {
  getMyDisplayName,
  getOwnerDisplayName,
  saveMyDisplayName,
} from '../services/DisplayNameService';
import { linkGoogleAndMigrate } from '../services/FamilySharingService';
import { getSettings, saveSettings } from '../db/NotificationSettingsStore';
import { clampSettingsToTier } from '../utils/notificationTier';
import { rescheduleExpiryNotifications } from '../services/ExpiryNotificationScheduler';
import { NOTIFICATIONS_ENABLED } from '../config/features';
import { NotificationSettings } from '../types/notification';
import TimePickerField from '../components/storage/TimePickerField';
import {
  generateInviteCode,
  joinWithCode,
  getMembers,
  removeMember,
  leaveSharing,
  Member,
  MEMBER_LIMIT,
} from '../services/SharingService';

const MAX_OFFSET_DAYS = 7;
const MAX_TIMES_PER_RULE = 24;

interface Props {
  onBack: () => void;
  authService: AuthService;
}

export default function SettingsScreen({ onBack, authService }: Props) {
  const { user, signInAnon } = useAuth();
  const { ownerUid, isOwner, refresh } = useSharing();
  const { statusMode, setStatusMode } = useAppSettings();
  const repo = useRepository();

  const [isLinking, setIsLinking] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [inviteInput, setInviteInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);
  const [myName, setMyName] = useState<string | null>(null);
  const [ownerName, setOwnerName] = useState<string | null>(null);
  // null: 非表示 / 'afterLink': 共有を始めた直後 / 'edit': 設定画面から変更
  const [nameModal, setNameModal] = useState<null | 'afterLink' | 'edit'>(null);

  const isLinked = user !== null && !user.isAnonymous;
  const effectiveOwnerUid = ownerUid ?? user?.uid ?? 'local';

  useEffect(() => {
    if (isLinked && isOwner && user) {
      setIsLoadingMembers(true);
      getMembers(user.uid)
        .then(setMembers)
        .catch(() => {})
        .finally(() => setIsLoadingMembers(false));
    }
  }, [isLinked, isOwner, user?.uid]);

  useEffect(() => {
    setNotificationSettings(getSettings());
  }, []);

  useEffect(() => {
    if (!isLinked || !user) {
      setMyName(null);
      return;
    }
    getMyDisplayName(user.uid)
      .then(setMyName)
      .catch(() => setMyName(null));
  }, [isLinked, user?.uid]);

  useEffect(() => {
    if (!isLinked || isOwner || !ownerUid) {
      setOwnerName(null);
      return;
    }
    getOwnerDisplayName(ownerUid).then(setOwnerName);
  }, [isLinked, isOwner, ownerUid]);

  async function handleSaveName(name: string) {
    const uid = auth.currentUser?.uid ?? user?.uid;
    if (!uid) throw new Error('ログイン中のユーザーが見つかりません');
    const saved = await saveMyDisplayName(uid, name, ownerUid);
    setMyName(saved);
    setNameModal(null);
  }

  function persistNotificationSettings(next: NotificationSettings) {
    const clamped = clampSettingsToTier(next);
    setNotificationSettings(clamped);
    saveSettings(clamped);
    repo
      .getAll()
      .then((items) => rescheduleExpiryNotifications(items, clamped, effectiveOwnerUid))
      .catch(() => {});
    if (isLinked && user) {
      setDoc(doc(db, 'users', user.uid, 'notificationSettings', 'expiry'), {
        enabled: clamped.enabled,
        isPremium: clamped.isPremium,
        rules: clamped.rules,
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }
  }

  function handleToggleNotificationsEnabled(next: boolean) {
    if (!notificationSettings) return;
    persistNotificationSettings({ ...notificationSettings, enabled: next });
  }

  function handleTogglePremiumDev() {
    if (!notificationSettings) return;
    persistNotificationSettings({ ...notificationSettings, isPremium: !notificationSettings.isPremium });
  }

  function handleFreeTimeChange(time: string) {
    if (!notificationSettings) return;
    persistNotificationSettings({
      ...notificationSettings,
      rules: [{ offsetDays: 0, times: [time] }],
    });
  }

  function handleAddRule() {
    if (!notificationSettings) return;
    const lastOffset = notificationSettings.rules[notificationSettings.rules.length - 1]?.offsetDays ?? -1;
    const nextOffset = Math.min(MAX_OFFSET_DAYS, lastOffset + 1);
    persistNotificationSettings({
      ...notificationSettings,
      rules: [...notificationSettings.rules, { offsetDays: nextOffset, times: ['09:00'] }],
    });
  }

  function handleRemoveRule(ruleIndex: number) {
    if (!notificationSettings) return;
    persistNotificationSettings({
      ...notificationSettings,
      rules: notificationSettings.rules.filter((_, i) => i !== ruleIndex),
    });
  }

  function handleOffsetChange(ruleIndex: number, delta: number) {
    if (!notificationSettings) return;
    persistNotificationSettings({
      ...notificationSettings,
      rules: notificationSettings.rules.map((rule, i) =>
        i === ruleIndex
          ? { ...rule, offsetDays: Math.max(0, Math.min(MAX_OFFSET_DAYS, rule.offsetDays + delta)) }
          : rule,
      ),
    });
  }

  function handleAddTime(ruleIndex: number) {
    if (!notificationSettings) return;
    persistNotificationSettings({
      ...notificationSettings,
      rules: notificationSettings.rules.map((rule, i) =>
        i === ruleIndex && rule.times.length < MAX_TIMES_PER_RULE
          ? { ...rule, times: [...rule.times, '09:00'] }
          : rule,
      ),
    });
  }

  function handleRemoveTime(ruleIndex: number, timeIndex: number) {
    if (!notificationSettings) return;
    persistNotificationSettings({
      ...notificationSettings,
      rules: notificationSettings.rules.map((rule, i) =>
        i === ruleIndex ? { ...rule, times: rule.times.filter((_, ti) => ti !== timeIndex) } : rule,
      ),
    });
  }

  function handleTimeChange(ruleIndex: number, timeIndex: number, value: string) {
    if (!notificationSettings) return;
    persistNotificationSettings({
      ...notificationSettings,
      rules: notificationSettings.rules.map((rule, i) =>
        i === ruleIndex
          ? { ...rule, times: rule.times.map((t, ti) => (ti === timeIndex ? value : t)) }
          : rule,
      ),
    });
  }

  async function handleLinkGoogle() {
    setIsLinking(true);
    try {
      const result = await linkGoogleAndMigrate({
        signInAnon,
        linkWithGoogle: () => authService.linkWithGoogle(),
      });
      await refresh();
      if (result === 'signedIn') {
        Alert.alert('完了', '以前の共有データを読み込みました。この端末で追加したデータは引き継がれません。');
      }
      // 共有を始めたら、家族に表示する名前を決めてもらう（入れ直し後で名前が決まっていれば聞かない）
      const uid = auth.currentUser?.uid;
      const existingName = uid ? await getMyDisplayName(uid).catch(() => null) : null;
      if (existingName) {
        setMyName(existingName);
        if (result === 'linked') Alert.alert('完了', '家族との共有を開始しました');
      } else {
        setNameModal('afterLink');
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : '不明なエラー';
      if (message !== 'Google sign-in cancelled or failed') {
        Alert.alert('エラー', message);
      }
    } finally {
      setIsLinking(false);
    }
  }

  async function handleGenerateCode() {
    if (!user) return;
    setIsGenerating(true);
    try {
      const code = await generateInviteCode(user.uid);
      setGeneratedCode(code);
    } catch (e) {
      Alert.alert('エラー', e instanceof Error ? e.message : '不明なエラー');
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleJoinWithCode() {
    if (!user || !inviteInput.trim()) return;
    setIsJoining(true);
    try {
      const joinedOwnerUid = await joinWithCode(inviteInput.trim(), user.uid, myName);
      const joinedOwnerName = await getOwnerDisplayName(joinedOwnerUid);
      await refresh();
      setInviteInput('');
      Alert.alert(JOINED_TITLE, joinedMessage(joinedOwnerName));
    } catch (e) {
      Alert.alert('エラー', e instanceof Error ? e.message : '不明なエラー');
    } finally {
      setIsJoining(false);
    }
  }

  function handleLeaveSharing() {
    if (!user || !ownerUid) return;
    Alert.alert(
      '共有を解除',
      '解除するとこのデバイスのローカルデータに戻ります。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '解除する',
          style: 'destructive',
          onPress: async () => {
            setIsLeaving(true);
            try {
              await leaveSharing(user.uid, ownerUid);
              await refresh();
            } catch (e) {
              Alert.alert('エラー', e instanceof Error ? e.message : '不明なエラー');
            } finally {
              setIsLeaving(false);
            }
          },
        },
      ],
    );
  }

  function handleRemoveMember(memberUid: string) {
    if (!user) return;
    Alert.alert('メンバーを削除', 'このメンバーを削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除する',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeMember(user.uid, memberUid);
            setMembers((prev) => prev.filter((m) => m.uid !== memberUid));
          } catch (e) {
            Alert.alert('エラー', e instanceof Error ? e.message : '不明なエラー');
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right', 'bottom']} testID="settings-screen">
      <View style={styles.header}>
        <TouchableOpacity testID="btn-back" onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← 戻る</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>設定</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 在庫ステータス表示 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>在庫ステータス表示</Text>
          <View style={styles.segmentRow}>
            <TouchableOpacity
              testID="status-mode-3step"
              style={[styles.segment, statusMode === '3step' && styles.segmentSelected]}
              onPress={() => setStatusMode('3step')}
              accessibilityRole="tab"
              accessibilityState={{ selected: statusMode === '3step' }}
            >
              <Text style={[styles.segmentLabel, statusMode === '3step' && styles.segmentLabelSelected]}>
                3段階
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="status-mode-2step"
              style={[styles.segment, statusMode === '2step' && styles.segmentSelected]}
              onPress={() => setStatusMode('2step')}
              accessibilityRole="tab"
              accessibilityState={{ selected: statusMode === '2step' }}
            >
              <Text style={[styles.segmentLabel, statusMode === '2step' && styles.segmentLabelSelected]}>
                2段階
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sectionHint}>
            在庫データは変わりません。表示の細かさ（3段階「買ったばかり/ちょっとある/全くない」 ↔ 2段階「ある/ない」）だけが切り替わります。
          </Text>
        </View>

        {/* Googleアカウントリンク */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>データ共有</Text>

          {isLinked ? (
            <>
              <View testID="linked-status" style={styles.linkedCard}>
                <Text style={styles.linkedText}>Googleアカウントで共有中</Text>
                <Text style={styles.linkedSub}>{user?.email}</Text>
              </View>
              <View style={styles.nameRow}>
                <View style={styles.nameInfo}>
                  <Text style={styles.nameLabel}>家族に表示する名前</Text>
                  <Text style={styles.nameValue} testID="my-display-name">
                    {myName ?? '未設定'}
                  </Text>
                </View>
                <TouchableOpacity testID="btn-edit-display-name" onPress={() => setNameModal('edit')}>
                  <Text style={styles.nameEditText}>{myName ? '変更' : '設定'}</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <LinkGoogleButton isLinking={isLinking} onPress={handleLinkGoogle} />
          )}
        </View>

        {/* 通知設定 */}
        {NOTIFICATIONS_ENABLED && notificationSettings && (
          <View style={styles.section}>
            <View style={styles.notificationHeaderRow}>
              <Text style={styles.sectionTitle}>通知設定</Text>
              <Switch
                testID="switch-notifications-enabled"
                value={notificationSettings.enabled}
                onValueChange={handleToggleNotificationsEnabled}
              />
            </View>

            {notificationSettings.enabled && (
              <>
                {!notificationSettings.isPremium ? (
                  <View style={styles.ruleRow} testID="rule-row-free">
                    <Text style={styles.ruleLabel}>当日</Text>
                    <TimePickerField
                      testID="time-picker-free"
                      value={notificationSettings.rules[0]?.times[0] ?? '09:00'}
                      onChange={handleFreeTimeChange}
                    />
                  </View>
                ) : (
                  <>
                    {notificationSettings.rules.map((rule, ruleIndex) => (
                      <View style={styles.premiumRuleCard} key={ruleIndex} testID={`rule-row-${ruleIndex}`}>
                        <View style={styles.offsetStepper}>
                          <TouchableOpacity
                            testID={`offset-minus-${ruleIndex}`}
                            style={styles.stepperBtn}
                            onPress={() => handleOffsetChange(ruleIndex, -1)}
                          >
                            <Text style={styles.stepperBtnText}>−</Text>
                          </TouchableOpacity>
                          <Text style={styles.ruleLabel}>
                            {rule.offsetDays === 0 ? '当日' : `${rule.offsetDays}日前`}
                          </Text>
                          <TouchableOpacity
                            testID={`offset-plus-${ruleIndex}`}
                            style={styles.stepperBtn}
                            onPress={() => handleOffsetChange(ruleIndex, 1)}
                          >
                            <Text style={styles.stepperBtnText}>＋</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            testID={`btn-remove-rule-${ruleIndex}`}
                            style={styles.removeRuleBtn}
                            onPress={() => handleRemoveRule(ruleIndex)}
                          >
                            <Text style={styles.removeMemberText}>ルール削除</Text>
                          </TouchableOpacity>
                        </View>

                        {rule.times.map((time, timeIndex) => (
                          <View style={styles.timeRow} key={timeIndex}>
                            <TimePickerField
                              testID={`time-picker-${ruleIndex}-${timeIndex}`}
                              value={time}
                              onChange={(v) => handleTimeChange(ruleIndex, timeIndex, v)}
                            />
                            {rule.times.length > 1 && (
                              <TouchableOpacity
                                testID={`btn-remove-time-${ruleIndex}-${timeIndex}`}
                                onPress={() => handleRemoveTime(ruleIndex, timeIndex)}
                              >
                                <Text style={styles.removeMemberText}>削除</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        ))}

                        {rule.times.length < MAX_TIMES_PER_RULE && (
                          <TouchableOpacity
                            testID={`btn-add-time-${ruleIndex}`}
                            onPress={() => handleAddTime(ruleIndex)}
                          >
                            <Text style={styles.addLinkText}>＋ 時刻を追加</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}

                    <TouchableOpacity testID="btn-add-rule" onPress={handleAddRule}>
                      <Text style={styles.addLinkText}>＋ 通知ルールを追加</Text>
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}

            {__DEV__ && (
              <View style={styles.devToggleRow}>
                <Text style={styles.devToggleLabel}>（開発用）プレミアムを有効にする</Text>
                <Switch
                  testID="dev-toggle-premium"
                  value={notificationSettings.isPremium}
                  onValueChange={handleTogglePremiumDev}
                />
              </View>
            )}
          </View>
        )}

        {/* オーナー向け: 招待コード生成 */}
        {isLinked && isOwner && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>仲間を招待する</Text>
            <TouchableOpacity
              testID="btn-generate-code"
              style={[styles.linkBtn, isGenerating && styles.linkBtnDisabled]}
              onPress={handleGenerateCode}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.linkBtnText}>招待コードを生成</Text>
              )}
            </TouchableOpacity>
            {generatedCode !== null && (
              <View style={styles.codeCard} testID="invite-code-display">
                <Text style={styles.codeText} testID="invite-code-value">
                  {generatedCode}
                </Text>
                <Text style={styles.codeHint}>このコードを仲間に伝えてください（24時間有効）</Text>
              </View>
            )}
          </View>
        )}

        {/* オーナー向け: メンバー一覧 */}
        {isLinked && isOwner && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              メンバー ({members.length}/{MEMBER_LIMIT - 1}人)
            </Text>
            {isLoadingMembers ? (
              <ActivityIndicator color="#0d8f7a" />
            ) : members.length === 0 ? (
              <Text style={styles.emptyText}>まだメンバーがいません</Text>
            ) : (
              members.map((member) => (
                <View
                  key={member.uid}
                  style={styles.memberRow}
                  testID={`member-row-${member.uid.substring(0, 8)}`}
                >
                  <Text style={styles.memberUid}>{member.displayName ?? '名前未設定'}</Text>
                  <TouchableOpacity
                    testID={`btn-remove-member-${member.uid.substring(0, 8)}`}
                    onPress={() => handleRemoveMember(member.uid)}
                  >
                    <Text style={styles.removeMemberText}>削除</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

        {/* オーナー向け: 招待コードで参加 */}
        {isLinked && isOwner && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>招待コードで参加する</Text>
            <TextInput
              testID="invite-code-input"
              style={styles.codeInput}
              value={inviteInput}
              onChangeText={(t) => setInviteInput(t.toUpperCase())}
              placeholder="6桁のコードを入力"
              placeholderTextColor="#9ab3ac"
              autoCapitalize="characters"
              maxLength={6}
            />
            <TouchableOpacity
              testID="btn-join-with-code"
              style={[
                styles.linkBtn,
                styles.joinBtn,
                (!inviteInput.trim() || isJoining) && styles.linkBtnDisabled,
              ]}
              onPress={handleJoinWithCode}
              disabled={!inviteInput.trim() || isJoining}
            >
              {isJoining ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.linkBtnText}>参加する</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* メンバー向け: 共有状態・解除 */}
        {isLinked && !isOwner && ownerUid && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>共有状態</Text>
            <View style={styles.linkedCard}>
              <Text style={styles.linkedText} testID="sharing-status-label">
                {sharingStatusLabel(ownerName)}
              </Text>
            </View>
            <TouchableOpacity
              testID="btn-leave-sharing"
              style={[styles.leaveBtn, isLeaving && styles.linkBtnDisabled]}
              onPress={handleLeaveSharing}
              disabled={isLeaving}
            >
              {isLeaving ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.linkBtnText}>共有を解除</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <AppUpdateSection />
      </ScrollView>
      <DisplayNameModal
        visible={nameModal !== null}
        lead={nameModal === 'afterLink' ? '家族との共有を開始しました' : undefined}
        initialName={nameModal === 'edit' ? myName : null}
        cancelLabel={nameModal === 'afterLink' ? 'あとで' : 'キャンセル'}
        onSave={handleSaveName}
        onCancel={() => setNameModal(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f0f9f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(13, 143, 122, 0.12)',
    backgroundColor: '#ffffff',
    gap: 12,
  },
  backBtn: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  backText: {
    fontSize: 15,
    color: '#0d8f7a',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a2e2a',
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
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
  sectionHint: {
    fontSize: 12,
    color: '#9ab3ac',
    lineHeight: 17,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segment: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#eef6f3',
  },
  segmentSelected: {
    backgroundColor: '#0d8f7a',
  },
  segmentLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#5c7a72',
  },
  segmentLabelSelected: {
    color: '#ffffff',
  },
  linkBtn: {
    backgroundColor: '#0d8f7a',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  joinBtn: {
    backgroundColor: '#5c7a72',
  },
  leaveBtn: {
    backgroundColor: '#c73e3e',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  linkBtnDisabled: {
    opacity: 0.6,
  },
  linkBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  nameInfo: {
    flex: 1,
  },
  nameLabel: {
    fontSize: 12,
    color: '#5c7a72',
  },
  nameValue: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2d2a',
  },
  nameEditText: {
    color: '#0d8f7a',
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  linkedCard: {
    backgroundColor: '#f0f9f5',
    borderRadius: 10,
    padding: 12,
  },
  linkedText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0d8f7a',
  },
  linkedSub: {
    fontSize: 12,
    color: '#5c7a72',
    marginTop: 2,
  },
  codeCard: {
    backgroundColor: '#f0f9f5',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  codeText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a2e2a',
    letterSpacing: 6,
  },
  codeHint: {
    fontSize: 12,
    color: '#5c7a72',
    textAlign: 'center',
  },
  codeInput: {
    borderWidth: 1,
    borderColor: 'rgba(13, 143, 122, 0.3)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '700',
    color: '#1a2e2a',
    letterSpacing: 4,
    textAlign: 'center',
    backgroundColor: '#f6fbf9',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(13, 143, 122, 0.1)',
  },
  memberUid: {
    fontSize: 13,
    color: '#1a2e2a',
    fontFamily: 'monospace',
  },
  removeMemberText: {
    fontSize: 13,
    color: '#c73e3e',
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 13,
    color: '#9ab3ac',
    textAlign: 'center',
    paddingVertical: 8,
  },
  notificationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ruleLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a2e2a',
  },
  premiumRuleCard: {
    backgroundColor: '#f6fbf9',
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  offsetStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#e6f2ee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0d8f7a',
  },
  removeRuleBtn: {
    marginLeft: 'auto',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  addLinkText: {
    fontSize: 13,
    color: '#0d8f7a',
    fontWeight: '600',
  },
  devToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  devToggleLabel: {
    fontSize: 12,
    color: '#9ab3ac',
    flex: 1,
  },
});
