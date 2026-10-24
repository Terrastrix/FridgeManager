import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { ShoppingItem } from '../../types/shopping';
import { FoodItem, StorageLocation, STORAGE_LOCATIONS, LOCATION_LABELS } from '../../types/food';
import { dateKindFor, initialDateOnPurchase, FOOD_DATE_LABELS } from '../../utils/foodDates';
import DatePickerField from '../storage/DatePickerField';

interface Props {
  visible: boolean;
  item: ShoppingItem | null;
  /** 正規化名で一致した既存食材。null なら新規登録になる */
  matchedFood: FoodItem | null;
  /** date は保管場所に応じて賞味期限か購入日として扱う */
  onConfirm: (date: string | undefined, location: StorageLocation) => void;
  onClose: () => void;
}

export default function PurchasedModal({ visible, item, matchedFood, onConfirm, onClose }: Props) {
  const [date, setDate] = useState<string | undefined>(undefined);
  const [location, setLocation] = useState<StorageLocation>('fridge');

  useEffect(() => {
    if (visible) {
      // 賞味期限は目安日数があれば「今日+日数」、なければ翌日。購入日は今日を初期値にする
      const initialLocation = matchedFood?.location ?? 'fridge';
      setLocation(initialLocation);
      setDate(initialDateOnPurchase(initialLocation, matchedFood));
    }
  }, [visible, matchedFood]);

  if (!item) return null;

  const dateKind = dateKindFor(location);

  function handleSelectLocation(loc: StorageLocation) {
    // 賞味期限と購入日が切り替わるときは、入力中の日付をその項目の初期値に戻す
    if (dateKindFor(loc) !== dateKind) setDate(initialDateOnPurchase(loc, matchedFood));
    setLocation(loc);
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      testID="purchased-modal"
    >
      <View style={styles.overlay}>
        <View style={styles.sheet} testID="purchased-sheet">
          <Text style={styles.title}>「{item.name}」を買ってきた</Text>
          <Text style={styles.subtitle}>
            {matchedFood
              ? '在庫を「買ったばかり」に更新します'
              : '新しい食材として在庫に登録します'}
          </Text>

          <Text style={styles.fieldLabel}>{FOOD_DATE_LABELS[dateKind]}</Text>
          <DatePickerField
            testID={dateKind === 'purchase' ? 'purchased-purchase-date-input' : 'purchased-expiry-input'}
            label={FOOD_DATE_LABELS[dateKind]}
            value={date}
            onChange={setDate}
          />

          {!matchedFood && (
            <>
              <Text style={styles.fieldLabel}>保管場所</Text>
              <View style={styles.locationRow}>
                {STORAGE_LOCATIONS.map((loc) => {
                  const isSelected = loc === location;
                  return (
                    <TouchableOpacity
                      key={loc}
                      testID={`purchased-location-${loc}`}
                      style={[styles.locationTab, isSelected && styles.locationTabSelected]}
                      onPress={() => handleSelectLocation(loc)}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: isSelected }}
                    >
                      <Text
                        style={[styles.locationLabel, isSelected && styles.locationLabelSelected]}
                      >
                        {LOCATION_LABELS[loc]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          <View style={styles.actions}>
            <TouchableOpacity testID="purchased-cancel" style={styles.btnCancel} onPress={onClose}>
              <Text style={styles.btnCancelText}>キャンセル</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="purchased-submit"
              style={styles.btnSubmit}
              onPress={() => onConfirm(date, location)}
            >
              <Text style={styles.btnSubmitText}>在庫に反映</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a2e2a',
  },
  subtitle: {
    fontSize: 13,
    color: '#5c7a72',
    marginTop: 4,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5c7a72',
    marginBottom: 6,
    marginTop: 16,
  },
  locationRow: {
    flexDirection: 'row',
    gap: 4,
  },
  locationTab: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
    backgroundColor: '#eef6f3',
    alignItems: 'center',
  },
  locationTabSelected: {
    backgroundColor: '#0d8f7a',
  },
  locationLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5c7a72',
  },
  locationLabelSelected: {
    color: '#ffffff',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 28,
  },
  btnCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(13, 143, 122, 0.3)',
    alignItems: 'center',
  },
  btnCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#5c7a72',
  },
  btnSubmit: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#0d8f7a',
    alignItems: 'center',
  },
  btnSubmitText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
});
