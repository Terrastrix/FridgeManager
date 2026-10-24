import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FoodItem, StorageLocation, StockLevel } from '../types/food';
import { useRepository } from '../hooks/useRepository';
import { useAuth } from '../context/AuthContext';
import { useSharing } from '../context/SharingContext';
import { sortItemsByExpiryAscending } from '../utils/expirySort';
import { clearExpiredExpiryDates } from '../utils/expiryUtils';
import { DeepLinkTarget } from '../hooks/useNotificationDeepLink';
import {
  getManualNotifyState,
  sendManualNotifyToGroup,
  ManualNotifyRateLimitedError,
  NoRecipientsError,
  MANUAL_NOTIFY_COOLDOWN_MS,
} from '../services/PushNotificationService';
import { NOTIFICATIONS_ENABLED } from '../config/features';
import LocationTabs from '../components/storage/LocationTabs';
import FoodItemCard from '../components/storage/FoodItemCard';
import AddFoodModal from '../components/storage/AddFoodModal';
import EditFoodModal from '../components/storage/EditFoodModal';

let nextId = 100;

function formatCooldown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

type ViewMode = 'tabs' | 'expirySorted';

interface Props {
  onOpenSettings: () => void;
  deepLinkTarget?: DeepLinkTarget;
  onDeepLinkConsumed?: () => void;
}

export default function StorageScreen({ onOpenSettings, deepLinkTarget, onDeepLinkConsumed }: Props) {
  const repo = useRepository();
  const { user } = useAuth();
  const { ownerUid: sharingOwnerUid } = useSharing();

  const [items, setItems] = useState<FoodItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<StorageLocation>('fridge');
  const [viewMode, setViewMode] = useState<ViewMode>('tabs');
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [isSimpleGlobal, setIsSimpleGlobal] = useState(false);
  const [simpleOverrides, setSimpleOverrides] = useState<Record<string, boolean>>({});
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<FoodItem | null>(null);
  const [nextAllowedNotifyAt, setNextAllowedNotifyAt] = useState<Date | null>(null);
  const [cooldownRemainingMs, setCooldownRemainingMs] = useState(0);
  const [isSendingNotify, setIsSendingNotify] = useState(false);

  const isLinked = user !== null && !user.isAnonymous;
  const effectiveOwnerUid = sharingOwnerUid ?? user?.uid ?? null;

  useEffect(() => {
    if (deepLinkTarget?.type === 'expirySorted') {
      setViewMode('expirySorted');
      onDeepLinkConsumed?.();
    } else if (deepLinkTarget?.type === 'manualNotify') {
      setViewMode('tabs');
      onDeepLinkConsumed?.();
    }
  }, [deepLinkTarget, onDeepLinkConsumed]);

  useEffect(() => {
    if (!NOTIFICATIONS_ENABLED) return;
    if (isLinked && effectiveOwnerUid) {
      getManualNotifyState(effectiveOwnerUid)
        .then((state) => setNextAllowedNotifyAt(state.nextAllowedAt))
        .catch(() => {});
    }
  }, [isLinked, effectiveOwnerUid]);

  useEffect(() => {
    if (!nextAllowedNotifyAt) {
      setCooldownRemainingMs(0);
      return;
    }
    const update = () => setCooldownRemainingMs(Math.max(0, nextAllowedNotifyAt.getTime() - Date.now()));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [nextAllowedNotifyAt]);

  async function handleNotifyMembers() {
    if (!user || !effectiveOwnerUid) return;
    setIsSendingNotify(true);
    try {
      await sendManualNotifyToGroup({
        ownerUid: effectiveOwnerUid,
        senderUid: user.uid,
        senderDisplayName: user.displayName ?? null,
      });
      setNextAllowedNotifyAt(new Date(Date.now() + MANUAL_NOTIFY_COOLDOWN_MS));
      Alert.alert('完了', '共有メンバーに通知しました');
    } catch (e) {
      if (e instanceof NoRecipientsError) {
        Alert.alert('通知できません', '共有メンバーがいません');
      } else if (e instanceof ManualNotifyRateLimitedError) {
        setNextAllowedNotifyAt(e.nextAllowedAt);
      } else {
        Alert.alert('エラー', e instanceof Error ? e.message : '不明なエラー');
      }
    } finally {
      setIsSendingNotify(false);
    }
  }

  useEffect(() => {
    setIsLoading(true);
    if (repo.subscribe) {
      const unsubscribe = repo.subscribe((loaded) => {
        setItems(loaded);
        setIsLoading(false);
      });
      return unsubscribe;
    }
    repo.getAll().then((loaded) => {
      setItems(loaded);
      setIsLoading(false);
    });
  }, [repo]);

  const visibleItems =
    viewMode === 'expirySorted'
      ? sortItemsByExpiryAscending(items)
      : items.filter((item) => item.location === selectedLocation);

  // 表示中の食材のうち、賞味期限が切れているもの（賞味期限を外した状態）
  const expiryClearedItems = clearExpiredExpiryDates(visibleItems);

  const isSimpleForItem = useCallback(
    (id: string) => {
      if (id in simpleOverrides) return simpleOverrides[id];
      return isSimpleGlobal;
    },
    [isSimpleGlobal, simpleOverrides],
  );

  const handleStockChange = useCallback((id: string, level: StockLevel) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, stockLevel: level } : item)),
    );
    repo.updateStock(id, level);
  }, [repo]);

  const handleDelete = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    repo.delete(id);
  }, [repo]);

  const handleEdit = useCallback((updated: FoodItem) => {
    setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    repo.update(updated);
    setEditingItem(null);
  }, [repo]);

  function handleClearExpiredDates() {
    const cleared = expiryClearedItems;
    Alert.alert(
      '賞味期限の削除',
      `賞味期限が切れている${cleared.length}件の賞味期限を削除しますか？
食材は削除されません。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除する',
          style: 'destructive',
          onPress: () => {
            const byId = new Map(cleared.map((item) => [item.id, item]));
            setItems((prev) => prev.map((item) => byId.get(item.id) ?? item));
            for (const item of cleared) repo.update(item);
          },
        },
      ],
    );
  }

  const handleToggleView = useCallback((id: string) => {
    setSimpleOverrides((prev) => {
      const current = id in prev ? prev[id] : isSimpleGlobal;
      return { ...prev, [id]: !current };
    });
  }, [isSimpleGlobal]);

  function handleBulkToggle() {
    setIsSimpleGlobal((prev) => !prev);
    setSimpleOverrides({});
  }

  function handleAdd(itemData: Omit<FoodItem, 'id'>) {
    const newItem: FoodItem = { ...itemData, id: String(nextId++) };
    setItems((prev) => [...prev, newItem]);
    repo.add(newItem);
  }

  function handleTabChange(location: StorageLocation) {
    setSelectedLocation(location);
    setIsDeleteMode(false);
    setViewMode('tabs');
  }

  const renderItem = useCallback(
    ({ item }: { item: FoodItem }) => (
      <FoodItemCard
        item={item}
        isSimple={isSimpleForItem(item.id)}
        showDeleteButton={isDeleteMode}
        showLocationBadge={viewMode === 'expirySorted'}
        onStockChange={handleStockChange}
        onDelete={handleDelete}
        onEdit={setEditingItem}
        onToggleView={() => handleToggleView(item.id)}
      />
    ),
    [isSimpleForItem, isDeleteMode, viewMode, handleStockChange, handleDelete, handleToggleView],
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']} testID="storage-screen">
        <ActivityIndicator style={styles.loader} size="large" color="#0d8f7a" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']} testID="storage-screen">
      {/* ヘッダー */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} testID="storage-title">食品保管</Text>
          <Text style={styles.headerSub}>保管場所をタブで切り替え</Text>
        </View>
        <TouchableOpacity testID="btn-settings" onPress={onOpenSettings} style={styles.settingsBtn}>
          <Text style={styles.settingsBtnText}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* 保管場所タブ */}
      <LocationTabs selected={selectedLocation} onSelect={handleTabChange} />

      {/* ツールバー */}
      <View style={styles.toolbar}>
        <TouchableOpacity
          testID="btn-add-food"
          style={styles.btnAdd}
          onPress={() => setIsAddModalVisible(true)}
        >
          <Text style={styles.btnAddText}>＋ 食品追加</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="btn-delete-mode"
          style={[styles.btnDelete, isDeleteMode && styles.btnDeleteActive]}
          onPress={() => setIsDeleteMode((prev) => !prev)}
          accessibilityState={{ selected: isDeleteMode }}
        >
          <Text style={[styles.btnDeleteText, isDeleteMode && styles.btnDeleteTextActive]}>
            削除
          </Text>
        </TouchableOpacity>
      </View>

      {/* 一括表示切替・賞味期限順表示 */}
      <View style={[styles.toolbarSecondary, styles.toolbarSecondaryRow]}>
        <TouchableOpacity
          testID="btn-bulk-view"
          style={[styles.btnBulk, styles.toolbarSecondaryItem]}
          onPress={handleBulkToggle}
        >
          <Text style={styles.btnBulkText}>
            一括: {isSimpleGlobal ? '詳細表示' : '簡易表示'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="btn-expiry-sort-view"
          style={[
            styles.btnBulk,
            styles.toolbarSecondaryItem,
            viewMode === 'expirySorted' && styles.btnExpirySortActive,
          ]}
          onPress={() => setViewMode((prev) => (prev === 'expirySorted' ? 'tabs' : 'expirySorted'))}
          accessibilityState={{ selected: viewMode === 'expirySorted' }}
        >
          <Text
            style={[styles.btnBulkText, viewMode === 'expirySorted' && styles.btnExpirySortActiveText]}
          >
            賞味期限順{viewMode === 'expirySorted' ? '（表示中）' : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 期限切れの賞味期限の一括削除（対象があるときだけ表示） */}
      {expiryClearedItems.length > 0 && (
        <View style={styles.toolbarSecondary}>
          <TouchableOpacity
            testID="btn-clear-expired-dates"
            style={[styles.btnBulk, styles.btnClearExpired]}
            onPress={handleClearExpiredDates}
          >
            <Text style={[styles.btnBulkText, styles.btnClearExpiredText]}>
              期限切れの賞味期限を削除（{expiryClearedItems.length}件）
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 共有メンバーへの通知 */}
      {NOTIFICATIONS_ENABLED && isLinked && effectiveOwnerUid && (
        <View style={styles.toolbarSecondary}>
          <TouchableOpacity
            testID="btn-notify-members"
            style={[
              styles.btnBulk,
              (isSendingNotify || cooldownRemainingMs > 0) && styles.btnBulkDisabled,
            ]}
            onPress={handleNotifyMembers}
            disabled={isSendingNotify || cooldownRemainingMs > 0}
          >
            <Text style={styles.btnBulkText}>
              {cooldownRemainingMs > 0
                ? `共有メンバーに通知する（あと${formatCooldown(cooldownRemainingMs)}）`
                : '共有メンバーに通知する'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 食品リスト */}
      <FlatList
        testID="food-list"
        data={visibleItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>この保管場所に食品はありません</Text>
        }
        renderItem={renderItem}
      />

      {/* 食品追加モーダル */}
      <AddFoodModal
        visible={isAddModalVisible}
        location={selectedLocation}
        onAdd={handleAdd}
        onClose={() => setIsAddModalVisible(false)}
      />

      {/* 食品編集モーダル */}
      <EditFoodModal
        visible={editingItem !== null}
        item={editingItem}
        onSave={handleEdit}
        onClose={() => setEditingItem(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f0f9f5',
  },
  loader: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(13, 143, 122, 0.12)',
    backgroundColor: '#ffffff',
  },
  headerText: {
    flex: 1,
  },
  settingsBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsBtnText: {
    fontSize: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a2e2a',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12,
    color: '#5c7a72',
    marginTop: 2,
  },
  toolbar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 4,
    backgroundColor: '#ffffff',
  },
  btnAdd: {
    flex: 1,
    backgroundColor: '#0d8f7a',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnAddText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  btnDelete: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fde8e8',
    alignItems: 'center',
  },
  btnDeleteActive: {
    backgroundColor: '#fde8e8',
    borderColor: '#c73e3e',
  },
  btnDeleteText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#c73e3e',
  },
  btnDeleteTextActive: {
    fontWeight: '700',
  },
  toolbarSecondary: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#ffffff',
  },
  toolbarSecondaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  toolbarSecondaryItem: {
    flex: 1,
  },
  btnExpirySortActive: {
    backgroundColor: '#0d8f7a',
    borderColor: '#0d8f7a',
  },
  btnExpirySortActiveText: {
    color: '#ffffff',
  },
  btnBulk: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(13, 143, 122, 0.45)',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#f6fbf9',
  },
  btnBulkText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a2e2a',
  },
  btnClearExpired: {
    borderColor: 'rgba(199, 62, 62, 0.45)',
    backgroundColor: '#fdf3f3',
  },
  btnClearExpiredText: {
    color: '#c73e3e',
  },
  btnBulkDisabled: {
    opacity: 0.5,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 48,
    color: '#5c7a72',
    fontSize: 14,
  },
});
