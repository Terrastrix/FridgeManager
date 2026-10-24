import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { FoodItem, StorageLocation, StockLevel, LOCATION_LABELS } from '../../types/food';
import StockLevelSelector from './StockLevelSelector';
import DatePickerField from './DatePickerField';
import { dateKindFor, withFoodDate, FOOD_DATE_LABELS } from '../../utils/foodDates';

interface Props {
  visible: boolean;
  location: StorageLocation;
  onAdd: (item: Omit<FoodItem, 'id'>) => void;
  onClose: () => void;
}

export default function AddFoodModal({ visible, location, onAdd, onClose }: Props) {
  const [name, setName] = useState('');
  const [stockLevel, setStockLevel] = useState<StockLevel>(2);
  const [date, setDate] = useState<string | undefined>(undefined);
  const [expiryDays, setExpiryDays] = useState('');
  const dateKind = dateKindFor(location);

  function reset() {
    setName('');
    setStockLevel(2);
    setDate(undefined);
    setExpiryDays('');
  }

  function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const parsedDays = parseInt(expiryDays, 10);
    onAdd(
      withFoodDate(
        {
          name: trimmed,
          stockLevel,
          tags: [],
          location,
          defaultExpiryDays: dateKind === 'expiry' && !isNaN(parsedDays) ? parsedDays : undefined,
        },
        date,
      ),
    );
    reset();
    onClose();
  }

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
      testID="add-food-modal"
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.sheet} testID="add-food-sheet">
          <Text style={styles.title}>
            {LOCATION_LABELS[location]}に追加
          </Text>

          <Text style={styles.fieldLabel}>食品名</Text>
          <TextInput
            testID="add-food-name-input"
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="例: 牛乳"
            placeholderTextColor="#aaa"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleAdd}
          />

          <Text style={styles.fieldLabel}>{FOOD_DATE_LABELS[dateKind]}</Text>
          <DatePickerField
            testID={dateKind === 'purchase' ? 'add-food-purchase-date-input' : 'add-food-expiry-input'}
            label={FOOD_DATE_LABELS[dateKind]}
            value={date}
            onChange={setDate}
          />

          {dateKind === 'expiry' && (
            <>
              <Text style={styles.fieldLabel}>賞味期限の目安（日数）</Text>
              <TextInput
                testID="add-food-expiry-days-input"
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
            itemId="new"
            level={stockLevel}
            onChange={setStockLevel}
          />

          <View style={styles.actions}>
            <TouchableOpacity
              testID="add-food-cancel"
              style={styles.btnCancel}
              onPress={handleClose}
            >
              <Text style={styles.btnCancelText}>キャンセル</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="add-food-submit"
              style={[styles.btnSubmit, !name.trim() && styles.btnSubmitDisabled]}
              onPress={handleAdd}
              disabled={!name.trim()}
            >
              <Text style={styles.btnSubmitText}>追加</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    paddingBottom: 40,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a2e2a',
    marginBottom: 20,
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
