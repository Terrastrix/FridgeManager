import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { FoodItem, StockLevel } from '../../types/food';
import StockLevelSelector from './StockLevelSelector';
import DatePickerField from './DatePickerField';
import { dateKindFor, getFoodDate, withFoodDate, FOOD_DATE_LABELS } from '../../utils/foodDates';

interface Props {
  visible: boolean;
  item: FoodItem | null;
  onSave: (updated: FoodItem) => void;
  onClose: () => void;
}

export default function EditFoodModal({ visible, item, onSave, onClose }: Props) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [tags, setTags] = useState('');
  const [date, setDate] = useState('');
  const [expiryDays, setExpiryDays] = useState('');
  const [stockLevel, setStockLevel] = useState<StockLevel>(2);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setIcon(item.icon ?? '');
      setTags(item.tags.join(', '));
      setDate(getFoodDate(item) ?? '');
      setExpiryDays(item.defaultExpiryDays !== undefined ? String(item.defaultExpiryDays) : '');
      setStockLevel(item.stockLevel);
    }
  }, [item]);

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed || !item) return;
    const parsedDays = parseInt(expiryDays, 10);
    // 冷凍庫・パントリーでは目安日数を入力しないので、保存済みの値をそのまま残す
    const defaultExpiryDays =
      dateKindFor(item.location) === 'purchase'
        ? item.defaultExpiryDays
        : isNaN(parsedDays) ? undefined : parsedDays;
    onSave(
      withFoodDate(
        {
          ...item,
          name: trimmed,
          icon: icon.trim() || undefined,
          tags: tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
          defaultExpiryDays,
          stockLevel,
        },
        date.trim() || undefined,
      ),
    );
    onClose();
  }

  function handleClose() {
    onClose();
  }

  if (!item) return null;

  const dateKind = dateKindFor(item.location);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
      testID="edit-food-modal"
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.sheet}
          testID="edit-food-sheet"
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>食品を編集</Text>

          <Text style={styles.fieldLabel}>食品名</Text>
          <TextInput
            testID="edit-food-name-input"
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="例: 牛乳"
            placeholderTextColor="#aaa"
            returnKeyType="next"
          />

          <Text style={styles.fieldLabel}>アイコン（絵文字）</Text>
          <TextInput
            testID="edit-food-icon-input"
            style={styles.input}
            value={icon}
            onChangeText={setIcon}
            placeholder="例: 🥛"
            placeholderTextColor="#aaa"
            returnKeyType="next"
          />

          <Text style={styles.fieldLabel}>タグ（カンマ区切り）</Text>
          <TextInput
            testID="edit-food-tags-input"
            style={styles.input}
            value={tags}
            onChangeText={setTags}
            placeholder="例: 乳製品, 要冷蔵"
            placeholderTextColor="#aaa"
            returnKeyType="next"
          />

          <Text style={styles.fieldLabel}>{FOOD_DATE_LABELS[dateKind]}</Text>
          <DatePickerField
            testID={dateKind === 'purchase' ? 'edit-food-purchase-date-input' : 'edit-food-expiry-input'}
            label={FOOD_DATE_LABELS[dateKind]}
            value={date || undefined}
            onChange={(v) => setDate(v ?? '')}
          />

          {dateKind === 'expiry' && (
            <>
              <Text style={styles.fieldLabel}>賞味期限の目安（日数）</Text>
              <TextInput
                testID="edit-food-expiry-days-input"
                style={styles.input}
                value={expiryDays}
                onChangeText={(t) => setExpiryDays(t.replace(/[^0-9]/g, ''))}
                placeholder="例: 7（買ってきた時に今日+7日を初期値にする）"
                placeholderTextColor="#aaa"
                keyboardType="number-pad"
              />
            </>
          )}

          <Text style={styles.fieldLabel}>在庫</Text>
          <StockLevelSelector
            itemId="edit"
            level={stockLevel}
            onChange={setStockLevel}
          />

          <View style={styles.actions}>
            <TouchableOpacity
              testID="edit-food-cancel"
              style={styles.btnCancel}
              onPress={handleClose}
            >
              <Text style={styles.btnCancelText}>キャンセル</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="edit-food-submit"
              style={[styles.btnSubmit, !name.trim() && styles.btnSubmitDisabled]}
              onPress={handleSave}
              disabled={!name.trim()}
            >
              <Text style={styles.btnSubmitText}>保存</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingBottom: 48,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a2e2a',
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5c7a72',
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(13, 143, 122, 0.3)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1a2e2a',
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
  btnSubmitDisabled: {
    backgroundColor: '#b0d6cf',
  },
  btnSubmitText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
});
