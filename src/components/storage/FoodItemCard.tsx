import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { FoodItem, StockLevel, LOCATION_LABELS } from '../../types/food';
import StockLevelSelector from './StockLevelSelector';
import { getExpiryStatus } from '../../utils/expiryUtils';
import { dateKindFor, formatJapaneseDate, getFoodDate, FOOD_DATE_LABELS } from '../../utils/foodDates';

interface Props {
  item: FoodItem;
  isSimple: boolean;
  showDeleteButton: boolean;
  showLocationBadge?: boolean;
  onStockChange: (id: string, level: StockLevel) => void;
  onDelete: (id: string) => void;
  onEdit: (item: FoodItem) => void;
  onToggleView: () => void;
}

function FoodItemCard({
  item,
  isSimple,
  showDeleteButton,
  showLocationBadge,
  onStockChange,
  onDelete,
  onEdit,
  onToggleView,
}: Props) {
  const dateKind = dateKindFor(item.location);
  const expiryStatus = dateKind === 'expiry' ? getExpiryStatus(item.expiryDate) : 'none';

  function handleDeletePress() {
    Alert.alert(
      '削除確認',
      `「${item.name}」を削除しますか？`,
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '削除する', style: 'destructive', onPress: () => onDelete(item.id) },
      ],
    );
  }

  return (
    <View style={styles.card} testID={`food-item-${item.id}`}>
      <View style={styles.main}>
        {/* ヘッダー行: アイコン + 名前 + 編集 + 詳細/簡易切替 */}
        <View style={styles.head}>
          <View style={styles.nameRow}>
            <View style={styles.iconBox}>
              <Text style={styles.icon}>{item.icon ?? '🍽️'}</Text>
            </View>
            <Text style={styles.name}>{item.name}</Text>
            {showLocationBadge && (
              <View style={styles.locationBadge} testID={`location-badge-${item.id}`}>
                <Text style={styles.locationBadgeText}>{LOCATION_LABELS[item.location]}</Text>
              </View>
            )}
          </View>
          <View style={styles.headButtons}>
            <TouchableOpacity
              testID={`edit-btn-${item.id}`}
              style={styles.iconBtn}
              onPress={() => onEdit(item)}
              accessibilityLabel={`${item.name}を編集`}
            >
              <Text style={styles.iconBtnText}>✏️</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID={`view-toggle-${item.id}`}
              style={styles.toggleBtn}
              onPress={onToggleView}
              accessibilityLabel={isSimple ? `${item.name}を詳細表示` : `${item.name}を簡易表示`}
            >
              <Text style={styles.toggleLabel}>{isSimple ? '詳細' : '簡易'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 詳細表示のみ: 賞味期限（冷凍庫・パントリーは購入日）・タグ */}
        {!isSimple && (
          <>
            <View style={styles.expiryRow}>
              <Text
                style={[styles.expiry, expiryStatus === 'expired' && styles.expiryExpired, expiryStatus === 'near' && styles.expiryNear]}
                testID={dateKind === 'purchase' ? `purchase-date-${item.id}` : `expiry-${item.id}`}
              >
                {FOOD_DATE_LABELS[dateKind]}{' '}
                <Text style={styles.expiryValue}>{formatJapaneseDate(getFoodDate(item))}</Text>
              </Text>
              {(expiryStatus === 'expired' || expiryStatus === 'near') && (
                <View
                  style={[styles.expiryBadge, expiryStatus === 'expired' ? styles.badgeExpired : styles.badgeNear]}
                  testID={`expiry-badge-${item.id}`}
                >
                  <Text style={styles.badgeText}>
                    {expiryStatus === 'expired' ? '期限切れ' : 'もうすぐ期限'}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.tags}>
              {item.tags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* 在庫レベルセレクター */}
        <StockLevelSelector
          itemId={item.id}
          level={item.stockLevel}
          onChange={(level) => onStockChange(item.id, level)}
        />
      </View>

      {/* 削除ボタン（削除モード時のみ表示） */}
      {showDeleteButton && (
        <TouchableOpacity
          testID={`delete-btn-${item.id}`}
          style={styles.deleteBtn}
          onPress={handleDeletePress}
          accessibilityLabel={`${item.name}を削除`}
        >
          <Text style={styles.deleteIcon}>🗑</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default React.memo(FoodItemCard);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(13, 143, 122, 0.15)',
    overflow: 'hidden',
    shadowColor: '#0d2f28',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  main: {
    flex: 1,
    padding: 14,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#c5ebe2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 22,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a2e2a',
    flex: 1,
  },
  locationBadge: {
    backgroundColor: '#eef6f3',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  locationBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0d8f7a',
  },
  headButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f0f9f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: {
    fontSize: 14,
  },
  toggleBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(13, 143, 122, 0.35)',
  },
  toggleLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0d8f7a',
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  expiry: {
    fontSize: 13,
    color: '#5c7a72',
  },
  expiryExpired: {
    color: '#c73e3e',
  },
  expiryNear: {
    color: '#b86a00',
  },
  expiryValue: {
    color: '#1a2e2a',
    fontWeight: '600',
  },
  expiryBadge: {
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  badgeExpired: {
    backgroundColor: '#fde8e8',
  },
  badgeNear: {
    backgroundColor: '#fff3e0',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#c73e3e',
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  tag: {
    backgroundColor: '#eef6f3',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5c7a72',
  },
  deleteBtn: {
    width: 52,
    backgroundColor: '#fde8e8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteIcon: {
    fontSize: 20,
  },
});
