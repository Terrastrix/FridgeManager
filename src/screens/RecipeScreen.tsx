import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Recipe } from '../types/recipe';
import { FoodItem } from '../types/food';
import { ShoppingItem } from '../types/shopping';
import { useRecipeRepository } from '../hooks/useRecipeRepository';
import { useShoppingRepository } from '../hooks/useShoppingRepository';
import { useRepository } from '../hooks/useRepository';
import {
  matchRecipeAgainstStock,
  getMissingIngredients,
  normalizeIngredientName,
  findFoodByName,
} from '../utils/recipeMatching';
import RecipeCard from '../components/recipe/RecipeCard';
import RecipeFormModal from '../components/recipe/RecipeFormModal';
import RecipeDetailModal from '../components/recipe/RecipeDetailModal';
import ShoppingListView from '../components/recipe/ShoppingListView';
import PurchasedModal from '../components/recipe/PurchasedModal';
import { StorageLocation } from '../types/food';
import { withFoodDate } from '../utils/foodDates';

// 再起動時のID衝突を避けるため時刻起点の連番を採用（シードIDの1〜3とは衝突しない）
let nextRecipeId = Date.now();
let nextShoppingId = Date.now();
let nextFoodId = Date.now();

type Segment = 'recipes' | 'shopping';

export default function RecipeScreen() {
  const recipeRepo = useRecipeRepository();
  const shoppingRepo = useShoppingRepository();
  const foodRepo = useRepository();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [segment, setSegment] = useState<Segment>('recipes');
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [detailRecipe, setDetailRecipe] = useState<Recipe | null>(null);
  const [purchasedItem, setPurchasedItem] = useState<ShoppingItem | null>(null);

  useEffect(() => {
    setIsLoading(true);
    if (recipeRepo.subscribe) {
      const unsubscribe = recipeRepo.subscribe((loaded) => {
        setRecipes(loaded);
        setIsLoading(false);
      });
      return unsubscribe;
    }
    recipeRepo.getAll().then((loaded) => {
      setRecipes(loaded);
      setIsLoading(false);
    });
  }, [recipeRepo]);

  useEffect(() => {
    if (foodRepo.subscribe) {
      return foodRepo.subscribe(setFoodItems);
    }
    foodRepo.getAll().then(setFoodItems);
  }, [foodRepo]);

  useEffect(() => {
    if (shoppingRepo.subscribe) {
      return shoppingRepo.subscribe(setShoppingItems);
    }
    shoppingRepo.getAll().then(setShoppingItems);
  }, [shoppingRepo]);

  const handleSave = useCallback(
    (data: Omit<Recipe, 'id'>, id: string | null) => {
      if (id) {
        const updated: Recipe = { ...data, id };
        setRecipes((prev) => prev.map((r) => (r.id === id ? updated : r)));
        recipeRepo.update(updated);
      } else {
        const newRecipe: Recipe = { ...data, id: String(nextRecipeId++) };
        setRecipes((prev) => [...prev, newRecipe]);
        recipeRepo.add(newRecipe);
      }
      setEditingRecipe(null);
    },
    [recipeRepo],
  );

  const handleDelete = useCallback(
    (id: string) => {
      setRecipes((prev) => prev.filter((r) => r.id !== id));
      recipeRepo.delete(id);
    },
    [recipeRepo],
  );

  const handleEdit = useCallback((recipe: Recipe) => {
    setEditingRecipe(recipe);
    setIsFormVisible(true);
  }, []);

  const handleAddMissingToShopping = useCallback(
    (recipe: Recipe) => {
      const missing = getMissingIngredients(recipe, foodItems);
      // 既に未チェックで存在する品目は追加しない（正規化名で重複排除）
      const existingNames = new Set(
        shoppingItems.filter((i) => !i.checked).map((i) => normalizeIngredientName(i.name)),
      );
      const toAdd = missing.filter(
        (ingredient) => !existingNames.has(normalizeIngredientName(ingredient.name)),
      );
      const newItems: ShoppingItem[] = toAdd.map((ingredient) => ({
        id: String(nextShoppingId++),
        name: ingredient.name,
        checked: false,
      }));
      setShoppingItems((prev) => [...prev, ...newItems]);
      newItems.forEach((item) => shoppingRepo.add(item));
      setDetailRecipe(null);
      setSegment('shopping');
    },
    [foodItems, shoppingItems, shoppingRepo],
  );

  const handleShoppingAdd = useCallback(
    (name: string) => {
      const newItem: ShoppingItem = { id: String(nextShoppingId++), name, checked: false };
      setShoppingItems((prev) => [...prev, newItem]);
      shoppingRepo.add(newItem);
    },
    [shoppingRepo],
  );

  const handleToggleChecked = useCallback(
    (id: string, checked: boolean) => {
      setShoppingItems((prev) => prev.map((item) => (item.id === id ? { ...item, checked } : item)));
      shoppingRepo.setChecked(id, checked);
    },
    [shoppingRepo],
  );

  const handleShoppingDelete = useCallback(
    (id: string) => {
      setShoppingItems((prev) => prev.filter((item) => item.id !== id));
      shoppingRepo.delete(id);
    },
    [shoppingRepo],
  );

  const handleClearChecked = useCallback(() => {
    setShoppingItems((prev) => prev.filter((item) => !item.checked));
    shoppingRepo.clearChecked();
  }, [shoppingRepo]);

  const handleClearAll = useCallback(() => {
    setShoppingItems([]);
    shoppingRepo.clearAll();
  }, [shoppingRepo]);

  const purchasedMatchedFood = purchasedItem ? findFoodByName(foodItems, purchasedItem.name) : undefined;

  const handlePurchasedConfirm = useCallback(
    (date: string | undefined, location: StorageLocation) => {
      if (!purchasedItem) return;
      const matched = findFoodByName(foodItems, purchasedItem.name);
      if (matched) {
        const updated: FoodItem = withFoodDate({ ...matched, stockLevel: 2 }, date);
        setFoodItems((prev) => prev.map((f) => (f.id === matched.id ? updated : f)));
        foodRepo.update(updated);
      } else {
        const newFood: FoodItem = withFoodDate(
          {
            id: String(nextFoodId++),
            name: purchasedItem.name,
            stockLevel: 2,
            tags: [],
            location,
          },
          date,
        );
        setFoodItems((prev) => [...prev, newFood]);
        foodRepo.add(newFood);
      }
      setShoppingItems((prev) => prev.filter((item) => item.id !== purchasedItem.id));
      shoppingRepo.delete(purchasedItem.id);
      setPurchasedItem(null);
    },
    [purchasedItem, foodItems, foodRepo, shoppingRepo],
  );

  const renderItem = useCallback(
    ({ item }: { item: Recipe }) => (
      <RecipeCard
        recipe={item}
        match={matchRecipeAgainstStock(item, foodItems)}
        showDeleteButton={isDeleteMode}
        onPress={setDetailRecipe}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    ),
    [foodItems, isDeleteMode, handleEdit, handleDelete],
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']} testID="recipe-screen">
        <ActivityIndicator style={styles.loader} size="large" color="#0d8f7a" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']} testID="recipe-screen">
      {/* ヘッダー */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} testID="recipe-title">レシピ</Text>
          <Text style={styles.headerSub}>在庫と照合して作れるレシピを表示</Text>
        </View>
      </View>

      {/* セグメント切替 */}
      <View style={styles.segmentRow}>
        <TouchableOpacity
          testID="segment-recipes"
          style={[styles.segment, segment === 'recipes' && styles.segmentSelected]}
          onPress={() => setSegment('recipes')}
          accessibilityRole="tab"
          accessibilityState={{ selected: segment === 'recipes' }}
        >
          <Text style={[styles.segmentLabel, segment === 'recipes' && styles.segmentLabelSelected]}>
            レシピ
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="segment-shopping"
          style={[styles.segment, segment === 'shopping' && styles.segmentSelected]}
          onPress={() => setSegment('shopping')}
          accessibilityRole="tab"
          accessibilityState={{ selected: segment === 'shopping' }}
        >
          <Text style={[styles.segmentLabel, segment === 'shopping' && styles.segmentLabelSelected]}>
            買い物リスト
          </Text>
        </TouchableOpacity>
      </View>

      {segment === 'recipes' ? (
        <>
          {/* ツールバー */}
          <View style={styles.toolbar}>
            <TouchableOpacity
              testID="btn-add-recipe"
              style={styles.btnAdd}
              onPress={() => {
                setEditingRecipe(null);
                setIsFormVisible(true);
              }}
            >
              <Text style={styles.btnAddText}>＋ レシピ追加</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="btn-recipe-delete-mode"
              style={[styles.btnDelete, isDeleteMode && styles.btnDeleteActive]}
              onPress={() => setIsDeleteMode((prev) => !prev)}
              accessibilityState={{ selected: isDeleteMode }}
            >
              <Text style={[styles.btnDeleteText, isDeleteMode && styles.btnDeleteTextActive]}>
                削除
              </Text>
            </TouchableOpacity>
          </View>

          {/* レシピリスト */}
          <FlatList
            testID="recipe-list"
            data={recipes}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={<Text style={styles.emptyText}>レシピがありません</Text>}
            renderItem={renderItem}
          />
        </>
      ) : (
        <ShoppingListView
          items={shoppingItems}
          onAdd={handleShoppingAdd}
          onToggleChecked={handleToggleChecked}
          onDelete={handleShoppingDelete}
          onClearChecked={handleClearChecked}
          onClearAll={handleClearAll}
          onBought={setPurchasedItem}
        />
      )}

      {/* レシピ追加・編集モーダル */}
      <RecipeFormModal
        visible={isFormVisible}
        recipe={editingRecipe}
        foodItems={foodItems}
        onSave={handleSave}
        onClose={() => {
          setIsFormVisible(false);
          setEditingRecipe(null);
        }}
      />

      {/* レシピ詳細モーダル */}
      <RecipeDetailModal
        visible={detailRecipe !== null}
        recipe={detailRecipe}
        match={detailRecipe ? matchRecipeAgainstStock(detailRecipe, foodItems) : null}
        onAddMissingToShopping={handleAddMissingToShopping}
        onClose={() => setDetailRecipe(null)}
      />

      {/* 買ってきたモーダル */}
      <PurchasedModal
        visible={purchasedItem !== null}
        item={purchasedItem}
        matchedFood={purchasedMatchedFood ?? null}
        onConfirm={handlePurchasedConfirm}
        onClose={() => setPurchasedItem(null)}
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
  segmentRow: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
  },
  segment: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
    backgroundColor: '#eef6f3',
    alignItems: 'center',
  },
  segmentSelected: {
    backgroundColor: '#0d8f7a',
  },
  segmentLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5c7a72',
  },
  segmentLabelSelected: {
    color: '#ffffff',
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
