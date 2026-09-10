import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Keyboard,
  Platform,
  InputAccessoryView,
  LayoutAnimation,
  UIManager,
  ScrollView,
  KeyboardAvoidingView,
  Alert,
  StyleSheet,
} from "react-native";
import { FullScreenSheet } from "@/components/ui/FullScreenSheet";
import { FlashList } from "@shopify/flash-list";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useShallow } from "zustand/react/shallow";
import { useAuthStore, useInventoryStore, useOrderStore } from "@/store";
import type { OrderInputMode } from "@/store";
import {
  InventoryItem,
  KNOWN_ITEM_CATEGORIES,
  KNOWN_SUPPLIER_CATEGORIES,
  UnitType,
  Location,
} from "@/types";
import { colors, getCategoryLabel } from "@/constants";
import { useScaledStyles } from "@/hooks/useScaledStyles";
import { useResolvedActiveLocation } from "@/hooks/useResolvedActiveLocation";
import { triggerConfirmationHaptic } from "@/lib/haptics";
import {
  getInventoryUnitSummary,
  hasInventoryUnit,
  normalizeInventoryPackSize,
  resolvePreferredInventoryUnitType,
} from "@/lib/inventoryUnits";
import { BrandLogo, GlassSurface } from "@/components";
import {
  glassColors,
  glassHairlineWidth,
  glassRadii,
  glassSpacing,
} from "@/theme/design";
import type { OrderingMode } from "./types";
import { color, radius, typeScale, weight } from '@/theme/tokens';

// Enable LayoutAnimation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Category emoji mapping
const CATEGORY_EMOJI: Record<string, string> = {
  fish: "🐟",
  protein: "🥩",
  produce: "🥬",
  dry: "🍚",
  dairy_cold: "🧊",
  frozen: "❄️",
  sauces: "🍶",
  alcohol: "🍺",
  packaging: "📦",
};

const QUICK_CREATE_CATEGORIES: string[] = [...KNOWN_ITEM_CATEGORIES];
const QUICK_CREATE_SUPPLIERS: string[] = [...KNOWN_SUPPLIER_CATEGORIES];

type ScreenState = "searching" | "quantity";

// Get short label for location (Sushi or Poki)
const getLocationLabel = (location: Location | null): string => {
  if (!location) return "";
  const name = location.name.toLowerCase();
  if (name.includes("sushi")) return "Sushi";
  if (name.includes("poki") || name.includes("pho")) return "Poki";
  return location.short_code;
};

function sanitizeNumericInput(value: string): string {
  const filtered = value.replace(/[^0-9.]/g, "");
  if (!filtered) return "";
  if (filtered === ".") return "0.";

  const firstDot = filtered.indexOf(".");
  if (firstDot < 0) return filtered;

  const whole = filtered.slice(0, firstDot);
  const fractional = filtered.slice(firstDot + 1).replace(/\./g, "");
  return `${whole}.${fractional}`;
}

interface QuickSearchScreenViewProps {
  mode: OrderingMode;
}

export function QuickSearchScreenView({ mode }: QuickSearchScreenViewProps) {
  const ds = useScaledStyles();
  const scope = mode.scope;
  const showSearchActionButton = mode.searchAction === "quick_create";
  const {
    location: selectedLocation,
    locations,
    setLocation,
  } = useResolvedActiveLocation();
  const {
    fetchLocations,
    user,
  } = useAuthStore(
    useShallow((state) => ({
      fetchLocations: state.fetchLocations,
      user: state.user,
    })),
  );
  const { items, fetchItems, addItem } = useInventoryStore(
    useShallow((state) => ({
      items: state.items,
      fetchItems: state.fetchItems,
      addItem: state.addItem,
    })),
  );
  const { addToCart, getLocationCartTotal, totalCartCount } = useOrderStore(
    useShallow((state) => ({
      addToCart: state.addToCart,
      getLocationCartTotal: state.getLocationCartTotal,
      totalCartCount: state.getTotalCartCount(scope),
    })),
  );

  const [showLocationDropdown, setShowLocationDropdown] = useState(false);

  // Screen state
  const [screenState, setScreenState] = useState<ScreenState>("searching");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [remainingAmount, setRemainingAmount] = useState("0");
  const [inputMode, setInputMode] = useState<OrderInputMode>("quantity");
  const [selectedUnit, setSelectedUnit] = useState<UnitType>("pack");

  // Quick create state
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] =
    useState<string>("produce");
  const [newItemSupplier, setNewItemSupplier] =
    useState<string>("main_distributor");
  const [newItemBaseUnit, setNewItemBaseUnit] = useState("lb");
  const [newItemPackUnit, setNewItemPackUnit] = useState("case");
  const [newItemPackSize, setNewItemPackSize] = useState("");
  const [isCreatingItem, setIsCreatingItem] = useState(false);

  // Keyboard state
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Refs
  const searchInputRef = useRef<TextInput>(null);
  const quantityInputRef = useRef<TextInput>(null);

  // Debounced search
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 100);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch items on mount
  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    void fetchLocations();
  }, [fetchLocations]);

  // Focus search input immediately on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Keyboard listeners
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        setIsKeyboardVisible(true);
      },
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setKeyboardHeight(0);
        setIsKeyboardVisible(false);
      },
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Total cart count
  const locationLabel = getLocationLabel(selectedLocation);
  const addButtonLocationLabel = locationLabel || "Location";
  const hasAvailableLocations = locations.length > 0;
  const headerIconButtonSize = Math.max(44, ds.icon(40));
  const parsedQuantity = parseFloat(quantity);
  const parsedRemaining = parseFloat(remainingAmount);
  const canAddToCart =
    Boolean(selectedLocation?.id) &&
    (inputMode === "quantity"
      ? Number.isFinite(parsedQuantity) && parsedQuantity > 0
      : Number.isFinite(parsedRemaining) && parsedRemaining >= 0);
  const addButtonText =
    inputMode === "quantity"
      ? `Add Order Qty (${addButtonLocationLabel})`
      : `Add Remaining (${addButtonLocationLabel})`;
  const iosKeyboardOverlayInset =
    Platform.OS === "ios" && isKeyboardVisible ? keyboardHeight : 0;
  const searchHelperBottomInset = Math.max(
    ds.spacing(24),
    iosKeyboardOverlayInset +
      (totalCartCount > 0 ? Math.max(ds.rowH - ds.spacing(12), 44) : 0) +
      ds.spacing(16),
  );

  // Filter items based on search query
  const filteredItems = useMemo(() => {
    if (!debouncedQuery.trim()) return [];
    const query = debouncedQuery.toLowerCase();
    return items
      .filter((item) => !item.location_id || item.location_id === selectedLocation?.id)
      .filter((item) => item.name.toLowerCase().includes(query))
      .slice(0, 6);
  }, [debouncedQuery, items, selectedLocation?.id]);

  // Get autocomplete suggestion (first match)
  const autocompleteSuggestion = useMemo(() => {
    if (!searchQuery.trim() || filteredItems.length === 0) return null;
    const firstMatch = filteredItems[0];
    const query = searchQuery.toLowerCase();
    const itemName = firstMatch.name.toLowerCase();

    if (itemName.startsWith(query)) {
      return firstMatch;
    }
    return filteredItems[0];
  }, [searchQuery, filteredItems]);

  // Get ghost text for autocomplete
  const ghostText = useMemo(() => {
    if (!autocompleteSuggestion || !searchQuery.trim()) return "";
    const itemName = autocompleteSuggestion.name;
    const query = searchQuery;

    if (itemName.toLowerCase().startsWith(query.toLowerCase())) {
      return itemName.slice(query.length);
    }
    return "";
  }, [autocompleteSuggestion, searchQuery]);

  const handleQuantityInputChange = useCallback((value: string) => {
    setQuantity(sanitizeNumericInput(value));
  }, []);

  const handleRemainingInputChange = useCallback((value: string) => {
    setRemainingAmount(sanitizeNumericInput(value));
  }, []);

  const resetQuickCreateForm = useCallback(() => {
    const defaultName = searchQuery.trim();
    setNewItemName(defaultName);
    setNewItemCategory("produce");
    setNewItemSupplier("main_distributor");
    setNewItemBaseUnit("lb");
    setNewItemPackUnit("case");
    setNewItemPackSize("");
  }, [searchQuery]);

  const handleOpenQuickCreate = useCallback(() => {
    resetQuickCreateForm();
    setShowQuickCreate(true);
  }, [resetQuickCreateForm]);

  const handleCreateItem = useCallback(async () => {
    if (!newItemName.trim()) {
      Alert.alert("Error", "Please enter an item name");
      return;
    }
    if (!newItemBaseUnit.trim() && !newItemPackUnit.trim()) {
      Alert.alert("Error", "Please enter at least one unit");
      return;
    }
    const packSizeInput = newItemPackSize.trim();
    if (packSizeInput.length > 0 && (!Number.isFinite(Number(packSizeInput)) || Number(packSizeInput) <= 0)) {
      Alert.alert("Error", "Please enter a valid pack size");
      return;
    }

    setIsCreatingItem(true);
    try {
      await addItem({
        name: newItemName.trim(),
        category: newItemCategory,
        supplier_category: newItemSupplier,
        base_unit: newItemBaseUnit.trim(),
        pack_unit: newItemPackUnit.trim(),
        pack_size: packSizeInput.length > 0 ? normalizeInventoryPackSize(packSizeInput) : undefined,
        created_by: user?.id,
      });

      setShowQuickCreate(false);
      setSearchQuery(newItemName.trim());
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to add item");
    } finally {
      setIsCreatingItem(false);
    }
  }, [
    newItemName,
    newItemCategory,
    newItemSupplier,
    newItemBaseUnit,
    newItemPackUnit,
    newItemPackSize,
    addItem,
    user,
    setSearchQuery,
  ]);

  // Toggle location dropdown
  const toggleLocationDropdown = useCallback(() => {
    if (!hasAvailableLocations) {
      return;
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowLocationDropdown((prev) => !prev);
  }, [hasAvailableLocations]);

  // Handle location select
  const handleSelectLocation = useCallback((loc: Location) => {
    if (selectedLocation?.id !== loc.id) {
      setLocation(loc);
      void triggerConfirmationHaptic();
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowLocationDropdown(false);
  }, [selectedLocation?.id, setLocation]);

  // Handle item selection
  const handleSelectItem = useCallback((item: InventoryItem) => {
    setSelectedItem(item);
    setQuantity("1");
    setRemainingAmount("0");
    setInputMode("quantity");
    setSelectedUnit(resolvePreferredInventoryUnitType(item, "pack"));
    setScreenState("quantity");

    setTimeout(() => {
      quantityInputRef.current?.focus();
    }, 100);
  }, []);

  // Handle Enter key in search
  const handleSearchSubmit = useCallback(() => {
    if (autocompleteSuggestion) {
      handleSelectItem(autocompleteSuggestion);
    }
  }, [autocompleteSuggestion, handleSelectItem]);

  // Handle Add to Cart
  const handleAddToCart = useCallback(() => {
    if (!selectedItem || !selectedLocation) return;
    const resolvedUnit = resolvePreferredInventoryUnitType(selectedItem, selectedUnit);

    if (inputMode === "quantity") {
      const qty = parseFloat(quantity);
      if (!Number.isFinite(qty) || qty <= 0) return;

      addToCart(selectedLocation.id, selectedItem.id, qty, resolvedUnit, {
        inputMode: "quantity",
        quantityRequested: qty,
        context: scope,
      });
      void triggerConfirmationHaptic();
    } else {
      const remaining = parseFloat(remainingAmount);
      if (!Number.isFinite(remaining) || remaining < 0) return;

      addToCart(selectedLocation.id, selectedItem.id, remaining, resolvedUnit, {
        inputMode: "remaining",
        remainingReported: remaining,
        context: scope,
      });
      void triggerConfirmationHaptic();
    }

    // Reset to search state
    setSearchQuery("");
    setSelectedItem(null);
    setInputMode("quantity");
    setRemainingAmount("0");
    setScreenState("searching");

    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  }, [
    selectedItem,
    selectedLocation,
    inputMode,
    quantity,
    remainingAmount,
    selectedUnit,
    addToCart,
    scope,
  ]);

  // Handle back from quantity state
  const handleBackToSearch = useCallback(() => {
    setSelectedItem(null);
    setScreenState("searching");
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  }, []);

  // Render suggestion item
  const renderSuggestionItem = useCallback(
    ({ item, index }: { item: InventoryItem; index: number }) => {
      const isFirst = index === 0;
      const emoji = CATEGORY_EMOJI[item.category] || "📦";
      const categoryLabel = getCategoryLabel(item.category);

      return (
        <TouchableOpacity
          onPress={() => handleSelectItem(item)}
          className="flex-row items-center"
          style={{ backgroundColor: isFirst ? color.tint : undefined, paddingHorizontal: ds.spacing(16),
            paddingVertical: ds.spacing(12),
            minHeight: ds.rowH }}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: ds.icon(32), marginRight: ds.spacing(12) }}>
            {emoji}
          </Text>
          <View className="flex-1">
            <Text
              style={{ color: color.ink, fontSize: ds.fontSize(typeScale.body) }}
              className="font-semibold"
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {item.name}
            </Text>
            <Text
              style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.secondary) }}

            >
              {categoryLabel} • {getInventoryUnitSummary(item)}
            </Text>
          </View>
          {isFirst && (
            <View className="flex-row items-center">
              <Text
                style={{ color: color.ink3, fontSize: ds.fontSize(typeScale.secondary),
                  marginRight: ds.spacing(4) }}

              >
                Enter
              </Text>
              <Ionicons
                name="return-down-back"
                size={14}
                color={colors.gray[400]}
              />
            </View>
          )}
        </TouchableOpacity>
      );
    },
    [handleSelectItem, ds],
  );

  // Input accessory view for iOS - shows above keyboard
  const renderInputAccessory = () => {
    if (Platform.OS !== "ios") return null;

    return (
      <InputAccessoryView nativeID={mode.inputAccessoryId}>
        <View
          style={{
            backgroundColor: glassColors.background,
            borderTopWidth: glassHairlineWidth,
            borderTopColor: glassColors.divider,
          }}
        >
          {/* Add to Cart button when in quantity mode */}
          {screenState === "quantity" && selectedItem && (
            <TouchableOpacity
              onPress={handleAddToCart}
              className={`items-center flex-row justify-center ${canAddToCart ? '' : 'bg-primary-300'}`}
              style={{ borderRadius: radius.control, backgroundColor: canAddToCart ? color.accent : undefined, minHeight: ds.buttonH,
                paddingHorizontal: ds.spacing(16),
                marginHorizontal: ds.spacing(12),
                marginVertical: ds.spacing(8) }}
              activeOpacity={0.8}
              disabled={!canAddToCart}
            >
              <Ionicons
                name="cart"
                size={ds.icon(20)}
                color={glassColors.textOnPrimary}
              />
              <Text
                style={{
                  fontSize: ds.buttonFont,
                  marginLeft: ds.spacing(8),
                  color: glassColors.textOnPrimary,
                  fontWeight: weight.bold,
                }}
              >
                {addButtonText}
              </Text>
            </TouchableOpacity>
          )}

          {/* Cart indicator bar */}
          {totalCartCount > 0 && (
            <GlassSurface
              intensity="subtle"
              style={{ borderRadius: glassRadii.surface }}
            >
            <TouchableOpacity
              onPress={() => {
                Keyboard.dismiss();
                router.push(mode.cartRoute as any);
              }}
              className="flex-row items-center justify-between"
              style={{
                minHeight: Math.max(ds.rowH - ds.spacing(12), 44),
                paddingHorizontal: ds.spacing(16),
              }}
            >
              <View className="flex-row items-center">
                <Ionicons
                  name="cart"
                  size={ds.icon(18)}
                  color={glassColors.textMuted}
                />
                <Text
                  style={{
                    fontSize: ds.fontSize(typeScale.secondary),
                    marginLeft: ds.spacing(8),
                    color: glassColors.textPrimary,
                    fontWeight: weight.semibold,
                  }}
                >
                  {totalCartCount} in cart
                </Text>
              </View>
              <View className="flex-row items-center">
                <Text
                  style={{
                    fontSize: ds.fontSize(typeScale.body),
                    marginRight: ds.spacing(4),
                    color: glassColors.accent,
                    fontWeight: weight.semibold,
                  }}
                >
                  View
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={ds.icon(16)}
                  color={glassColors.accent}
                />
              </View>
            </TouchableOpacity>
            </GlassSurface>
          )}
        </View>
      </InputAccessoryView>
    );
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: glassColors.background }}
      edges={["top", "left", "right"]}
    >
      {/* Compact Header with Location Selector */}
      <View
        style={{
          backgroundColor: glassColors.background,
          paddingHorizontal: glassSpacing.screen,
          paddingTop: ds.spacing(8),
          paddingBottom: ds.spacing(10),
        }}
      >
        <View
          className="flex-row items-center justify-between"
          style={{
            columnGap: glassSpacing.gap,
          }}
        >
          {/* Left — Back button */}
          <GlassSurface
            intensity="medium"
            style={{
              width: headerIconButtonSize,
              height: headerIconButtonSize,
              borderRadius: glassRadii.round,
            }}
          >
            <TouchableOpacity
              onPress={() => {
                if (mode.backBehavior === "back") {
                  router.back();
                  return;
                }
                router.replace(mode.backBehavior.replace as any);
              }}
              className="flex-1 items-center justify-center"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name="arrow-back"
                size={ds.icon(22)}
                color={glassColors.textPrimary}
              />
            </TouchableOpacity>
          </GlassSurface>

          {/* Right — Location Dropdown & Cart */}
          <View
            className="flex-row items-center flex-1 justify-end"
            style={{ marginLeft: glassSpacing.gap }}
          >
            <GlassSurface
              intensity="medium"
              style={{
                flexShrink: 1,
                marginRight: glassSpacing.gap,
                borderRadius: glassRadii.pill,
              }}
            >
              <TouchableOpacity
                onPress={toggleLocationDropdown}
                className="flex-row items-center"
                style={{
                  minHeight: headerIconButtonSize,
                  paddingHorizontal: ds.spacing(14),
                }}
                activeOpacity={0.7}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: glassRadii.round,
                    backgroundColor: glassColors.accent,
                    marginRight: ds.spacing(8),
                  }}
                />
                <Text
                  style={{
                    fontSize: ds.fontSize(typeScale.body),
                    fontWeight: weight.semibold,
                    color: glassColors.textPrimary,
                    marginRight: ds.spacing(6),
                    maxWidth: ds.spacing(170),
                  }}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {selectedLocation?.name || "Select Location"}
                </Text>
                <Ionicons
                  name={showLocationDropdown ? "chevron-up" : "chevron-down"}
                  size={ds.icon(13)}
                  color={glassColors.textSecondary}
                />
              </TouchableOpacity>
            </GlassSurface>

            <View style={{ width: headerIconButtonSize, height: headerIconButtonSize }}>
              <GlassSurface
                intensity="medium"
                style={{
                  ...StyleSheet.absoluteFillObject,
                  borderRadius: glassRadii.round,
                }}
              >
                <View />
              </GlassSurface>
              <TouchableOpacity
                onPress={() => router.push(mode.cartRoute as any)}
                className="absolute inset-0 items-center justify-center"
                activeOpacity={0.8}
              >
                <Ionicons
                  name="bag-handle-outline"
                  size={ds.icon(20)}
                  color={glassColors.textPrimary}
                />
              </TouchableOpacity>
              {totalCartCount > 0 && (
                <View
                  style={{
                    position: "absolute",
                    top: -6,
                    right: -6,
                    minWidth: ds.spacing(20),
                    height: ds.spacing(20),
                    paddingHorizontal: 4,
                    borderRadius: glassRadii.round,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: glassColors.accent,
                    borderWidth: 2,
                    borderColor: color.card,
                    zIndex: 10,
                  }}
                >
                  <Text
                    style={{
                      color: glassColors.textOnPrimary,
                      fontSize: ds.fontSize(typeScale.caption),
                      fontWeight: weight.bold,
                    }}
                  >
                    {totalCartCount > 99 ? "99+" : totalCartCount}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Location Dropdown Menu */}
        {showLocationDropdown && hasAvailableLocations && (
          <GlassSurface
            intensity="strong"
            style={{ marginTop: ds.spacing(10), borderRadius: glassRadii.surface }}
          >
            {locations.map((loc) => {
              const isSelected = selectedLocation?.id === loc.id;
              const cartCount = getLocationCartTotal(loc.id, scope);

              return (
                <TouchableOpacity
                  key={loc.id}
                  onPress={() => handleSelectLocation(loc)}
                  className={`flex-row items-center justify-between ${
                    ""
                  }`}
                  style={{
                    paddingHorizontal: ds.spacing(16),
                    paddingVertical: ds.spacing(12),
                    minHeight: ds.rowH,
                    borderTopWidth: loc.id !== locations[0]?.id ? glassHairlineWidth : 0,
                    borderTopColor: glassColors.divider,
                  }}
                >
                  <View className="flex-row items-center">
                    <View
                      style={{
                        width: ds.icon(32),
                        height: ds.icon(32),
                        marginRight: ds.spacing(12),
                        borderRadius: glassRadii.round,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: isSelected
                          ? glassColors.accentSoft
                          : glassColors.mediumFill,
                      }}
                    >
                      <BrandLogo
                        variant="inline"
                        size={16}
                      />
                    </View>
                    <Text
                      style={{
                        fontSize: ds.fontSize(typeScale.secondary),
                        color: isSelected ? glassColors.accent : glassColors.textPrimary,
                        fontWeight: isSelected ? "500" : "400",
                      }}
                    >
                      {loc.name}
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    {cartCount > 0 && (
                      <Text
                        style={{
                          fontSize: ds.fontSize(typeScale.caption),
                          marginRight: ds.spacing(8),
                          color: glassColors.textSecondary,
                        }}
                      >
                        {cartCount} items
                      </Text>
                    )}
                    {isSelected && (
                      <Ionicons
                        name="checkmark"
                        size={ds.icon(18)}
                        color={glassColors.accent}
                      />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </GlassSurface>
        )}
      </View>

      {/* Main Content */}
      <View
        className="flex-1"
        style={{
          paddingHorizontal: glassSpacing.screen,
          paddingTop: ds.spacing(12),
        }}
      >
        {screenState === "searching" ? (
          <>
            {/* Search Input with Ghost Text */}
            <View className="relative">
              <GlassSurface
                intensity="medium"
                style={{ borderRadius: glassRadii.surface }}
              >
                <View
                  className="flex-row items-center"
                  style={{
                    height: ds.buttonH,
                    paddingHorizontal: ds.spacing(14),
                  }}
                >
                  <Ionicons
                    name="search"
                    size={ds.icon(20)}
                    color={glassColors.textSecondary}
                  />
                  <View
                    className="flex-1 relative justify-center"
                    style={{ height: ds.buttonH, marginLeft: ds.spacing(10) }}
                  >
                    {ghostText && (
                      <View
                        pointerEvents="none"
                        className="absolute inset-0 flex-row items-center"
                      >
                        <Text
                          style={{ fontSize: ds.fontSize(typeScale.body) }}
                          className="text-transparent"
                        >
                          {searchQuery}
                        </Text>
                        <Text
                          style={{ color: color.ink3, fontSize: ds.fontSize(typeScale.body) }}

                        >
                          {ghostText}
                        </Text>
                      </View>
                    )}
                    <TextInput
                      ref={searchInputRef}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      onSubmitEditing={handleSearchSubmit}
                      placeholder="Type item name..."
                      placeholderTextColor={glassColors.textSecondary}
                      style={{
                        height: ds.buttonH,
                        fontSize: ds.fontSize(typeScale.body),
                        color: glassColors.textPrimary,
                      }}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoFocus
                      returnKeyType="go"
                      inputAccessoryViewID={
                        Platform.OS === "ios"
                          ? mode.inputAccessoryId
                          : undefined
                      }
                    />
                  </View>
                  {searchQuery.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setSearchQuery("")}
                      style={{
                        paddingHorizontal: ds.spacing(4),
                        minHeight: 44,
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons
                        name="close-circle"
                        size={ds.icon(20)}
                        color={glassColors.textSecondary}
                      />
                    </TouchableOpacity>
                  )}
                  {showSearchActionButton && (
                    <TouchableOpacity
                      onPress={handleOpenQuickCreate}
                      activeOpacity={0.8}
                      accessibilityLabel="Add item to inventory"
                      accessibilityRole="button"
                      style={{
                        width: Math.max(44, ds.icon(32)),
                        height: Math.max(44, ds.icon(32)),
                        borderRadius: ds.icon(16),
                        backgroundColor: glassColors.accent,
                        alignItems: "center",
                        justifyContent: "center",
                        marginLeft: ds.spacing(8),
                      }}
                    >
                      <Ionicons
                        name="add-outline"
                        size={ds.icon(18)}
                        color={glassColors.textOnPrimary}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              </GlassSurface>

              {/* Suggestions Dropdown */}
              {filteredItems.length > 0 && searchQuery.trim() && (
                <GlassSurface
                  intensity="strong"
                  style={{
                    top: ds.buttonH + ds.spacing(4),
                    position: "absolute",
                    left: 0,
                    right: 0,
                    borderRadius: radius.control,
                  }}
                >
                  <FlashList
                    data={filteredItems}
                    keyExtractor={(item) => item.id}
                    renderItem={renderSuggestionItem}
                    keyboardShouldPersistTaps="always"
                    ItemSeparatorComponent={() => (
                      <View className="h-px" style={{ backgroundColor: color.well }} />
                    )}
                  />
                </GlassSurface>
              )}
            </View>

            {/* Empty State */}
            {!searchQuery.trim() && (
              <View
                className="flex-1 items-center justify-center"
                style={{ paddingBottom: searchHelperBottomInset }}
              >
                <Ionicons
                  name="search-outline"
                  size={ds.icon(56)}
                  color={glassColors.textSecondary}
                />
                <Text
                  style={{
                    fontSize: ds.fontSize(typeScale.body),
                    marginTop: ds.spacing(12),
                    color: glassColors.textPrimary,
                    fontWeight: weight.semibold,
                  }}
                >
                  Start typing to search
                </Text>
                <Text
                  style={{
                    fontSize: ds.fontSize(typeScale.body),
                    marginTop: ds.spacing(4),
                    color: glassColors.textSecondary,
                  }}
                >
                  salmon, avocado, nori...
                </Text>
              </View>
            )}

            {/* No results state */}
            {searchQuery.trim() &&
              filteredItems.length === 0 &&
              debouncedQuery === searchQuery && (
                <View
                  className="flex-1 items-center justify-center"
                  style={{ paddingBottom: searchHelperBottomInset }}
                >
                  <Ionicons
                    name="alert-circle-outline"
                    size={ds.icon(56)}
                    color={colors.gray[300]}
                  />
                  <Text
                    style={{ fontWeight: weight.semibold, color: color.ink2, fontSize: ds.fontSize(typeScale.body),
                      marginTop: ds.spacing(12) }}

                  >
                    No items found
                  </Text>
                  <Text
                    style={{ color: color.ink3, fontSize: ds.fontSize(typeScale.body),
                      marginTop: ds.spacing(4) }}

                  >
                    Try a different search term
                  </Text>
                  <TouchableOpacity
                    onPress={handleOpenQuickCreate}

                    style={{ backgroundColor: color.accent, borderRadius: radius.pill, minHeight: ds.buttonH,
                      paddingHorizontal: ds.buttonPadH,
                      justifyContent: "center",
                      marginTop: ds.spacing(16) }}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={{ color: color.onAccent, fontSize: ds.buttonFont }}
                      className="font-semibold"
                    >
                      Add {searchQuery.trim()} to Inventory?
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
          </>
        ) : (
          /* Quantity Entry State - Compact */
          <View className="flex-1">
            {/* Back button */}
            <TouchableOpacity
              onPress={handleBackToSearch}
              className="flex-row items-center"
              style={{ marginBottom: ds.spacing(12), minHeight: 44 }}
            >
              <Ionicons
                name="arrow-back"
                size={ds.icon(18)}
                color={colors.gray[600]}
              />
              <Text
                style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.body), marginLeft: ds.spacing(4) }}

              >
                Back
              </Text>
            </TouchableOpacity>

            {/* Compact Item Card */}
            {selectedItem && (
              <View
                className="shadow-sm border"
                style={{ backgroundColor: color.card, borderColor: color.hairline, borderRadius: radius.control, padding: ds.cardPad }}
              >
                {/* Item Info - Compact */}
                <View
                  className="flex-row items-center"
                  style={{ marginBottom: ds.spacing(16) }}
                >
                  <Text
                    style={{
                      fontSize: ds.icon(30),
                      marginRight: ds.spacing(12),
                    }}
                  >
                    {CATEGORY_EMOJI[selectedItem.category] || "📦"}
                  </Text>
                  <View className="flex-1">
                    <Text
                      style={{ color: color.ink, fontSize: ds.fontSize(typeScale.title) }}
                      className="font-semibold"
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {selectedItem.name}
                    </Text>
                  <Text
                    style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.secondary) }}

                  >
                      {getInventoryUnitSummary(selectedItem)}
                  </Text>
                </View>
                </View>

                <View
                  className="flex-row"
                  style={{ marginBottom: ds.spacing(12) }}
                >
                  <TouchableOpacity
                    onPress={() => setInputMode("quantity")}
                    className="flex-1 items-center justify-center"
                    style={{ borderTopLeftRadius: radius.control, borderBottomLeftRadius: radius.control, backgroundColor: inputMode === "quantity" ? color.accent : color.well, minHeight: Math.max(44, ds.buttonH - ds.spacing(6)) }}
                  >
                    <Text
                      style={{ color: inputMode === "quantity" ? color.onAccent : color.ink2, fontSize: ds.fontSize(typeScale.secondary) }}
                      className="font-semibold"
                    >
                      Order Qty
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setInputMode("remaining")}
                    className="flex-1 items-center justify-center"
                    style={{ borderTopRightRadius: radius.control, borderBottomRightRadius: radius.control, backgroundColor: inputMode === "remaining" ? color.accent : color.well, minHeight: Math.max(44, ds.buttonH - ds.spacing(6)) }}
                  >
                    <Text
                      style={{ color: inputMode === "remaining" ? color.onAccent : color.ink2, fontSize: ds.fontSize(typeScale.secondary) }}
                      className="font-semibold"
                    >
                      Remaining
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Quantity/Remaining + Unit Row */}
                <View className="flex-row items-center">
                  {/* Value Controls */}
                  <View className="flex-row items-center flex-1">
                    <TouchableOpacity
                      onPress={() => {
                        if (inputMode === "quantity") {
                          const q = Math.max(
                            1,
                            (parseFloat(quantity) || 1) - 1,
                          );
                          setQuantity(q.toString());
                        } else {
                          const r = Math.max(
                            0,
                            (parseFloat(remainingAmount) || 0) - 1,
                          );
                          setRemainingAmount(r.toString());
                        }
                        quantityInputRef.current?.focus();
                      }}
                      className="items-center justify-center"
                      style={{ backgroundColor: color.well, borderRadius: radius.control, width: Math.max(44, ds.icon(44)),
                        height: Math.max(44, ds.icon(44)) }}
                    >
                      <Ionicons
                        name="remove"
                        size={ds.icon(20)}
                        color={colors.gray[700]}
                      />
                    </TouchableOpacity>

                    <TextInput
                      ref={quantityInputRef}
                      value={
                        inputMode === "quantity" ? quantity : remainingAmount
                      }
                      onChangeText={
                        inputMode === "quantity"
                          ? handleQuantityInputChange
                          : handleRemainingInputChange
                      }
                      keyboardType="number-pad"
                      className="text-center font-bold"
                      style={{ color: color.ink, width: ds.spacing(72),
                        height: Math.max(44, ds.buttonH),
                        fontSize: ds.fontSize(typeScale.display),
                        marginHorizontal: ds.spacing(8) }}
                      selectTextOnFocus
                      inputAccessoryViewID={
                        Platform.OS === "ios"
                          ? mode.inputAccessoryId
                          : undefined
                      }
                    />

                    <TouchableOpacity
                      onPress={() => {
                        if (inputMode === "quantity") {
                          const q = (parseFloat(quantity) || 0) + 1;
                          setQuantity(q.toString());
                        } else {
                          const r = (parseFloat(remainingAmount) || 0) + 1;
                          setRemainingAmount(r.toString());
                        }
                        quantityInputRef.current?.focus();
                      }}
                      className="items-center justify-center"
                      style={{ backgroundColor: color.well, borderRadius: radius.control, width: Math.max(44, ds.icon(44)),
                        height: Math.max(44, ds.icon(44)) }}
                    >
                      <Ionicons
                        name="add"
                        size={ds.icon(20)}
                        color={colors.gray[700]}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Unit Toggle */}
                  <View
                    className="flex-row"
                    style={{ marginLeft: ds.spacing(12) }}
                  >
                    <TouchableOpacity
                      onPress={() => {
                        if (!hasInventoryUnit(selectedItem, "pack")) return;
                        setSelectedUnit("pack");
                        quantityInputRef.current?.focus();
                      }}
                      className="justify-center"
                      style={{ borderTopLeftRadius: radius.control, borderBottomLeftRadius: radius.control, backgroundColor: selectedUnit === "pack" ? color.accent : color.well, minHeight: 44,
                        paddingHorizontal: ds.spacing(12),
                        opacity: hasInventoryUnit(selectedItem, "pack") ? 1 : 0.55 }}
                      disabled={!hasInventoryUnit(selectedItem, "pack")}
                    >
                      <Text
                        style={{ fontWeight: weight.semibold, color: selectedUnit === "pack" ? color.onAccent : hasInventoryUnit(selectedItem, "pack") ? color.ink2 : color.ink3, fontSize: ds.fontSize(typeScale.body) }}

                      >
                        {selectedItem.pack_unit || "Pack"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        if (!hasInventoryUnit(selectedItem, "base")) return;
                        setSelectedUnit("base");
                        quantityInputRef.current?.focus();
                      }}
                      className="justify-center"
                      style={{ borderTopRightRadius: radius.control, borderBottomRightRadius: radius.control, backgroundColor: selectedUnit === "base" ? color.accent : color.well, minHeight: 44,
                        paddingHorizontal: ds.spacing(12),
                        opacity: hasInventoryUnit(selectedItem, "base") ? 1 : 0.55 }}
                      disabled={!hasInventoryUnit(selectedItem, "base")}
                    >
                      <Text
                        style={{ fontWeight: weight.semibold, color: selectedUnit === "base" ? color.onAccent : hasInventoryUnit(selectedItem, "base") ? color.ink2 : color.ink3, fontSize: ds.fontSize(typeScale.body) }}

                      >
                        {selectedItem.base_unit || "Base"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {inputMode === "remaining" && (
                  <Text
                    style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.secondary),
                      marginTop: ds.spacing(12) }}

                  >
                    Enter how many are left. A manager will decide how many to
                    order.
                  </Text>
                )}
              </View>
            )}
          </View>
        )}
      </View>

      {/* Quick Create Modal */}
      <FullScreenSheet
        visible={showQuickCreate}
        onClose={() => setShowQuickCreate(false)}
      >
        <SafeAreaView className="flex-1" style={{ backgroundColor: color.page }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            className="flex-1"
          >
            <View
              className="border-b flex-row items-center justify-between"
              style={{ backgroundColor: color.card, borderColor: color.hairlineStrong, paddingHorizontal: ds.spacing(16),
                paddingVertical: ds.spacing(14) }}
            >
              <TouchableOpacity onPress={() => setShowQuickCreate(false)}>
                <Text
                  style={{ color: color.accent, fontWeight: weight.semibold, fontSize: ds.fontSize(typeScale.body) }}

                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <Text
                style={{ color: color.ink, fontSize: ds.fontSize(typeScale.title) }}
                className="font-bold"
              >
                Add Item
              </Text>
              <View style={{ width: ds.spacing(64) }} />
            </View>

            <ScrollView
              className="flex-1"
              contentContainerStyle={{ padding: ds.spacing(16) }}
            >
              <View style={{ marginBottom: ds.spacing(16) }}>
                <Text
                  style={{ fontWeight: weight.semibold, color: color.ink2, fontSize: ds.fontSize(typeScale.body),
                    marginBottom: ds.spacing(8) }}

                >
                  Item Name *
                </Text>
                <TextInput
                  className="border"
                  style={{ backgroundColor: color.card, borderColor: color.hairlineStrong, color: color.ink, borderRadius: radius.control,
                    paddingHorizontal: ds.spacing(16),
                    minHeight: ds.buttonH,
                    fontSize: ds.fontSize(typeScale.body) }}
                  value={newItemName}
                  onChangeText={setNewItemName}
                  placeholder="e.g., Salmon (Sushi Grade)"
                  placeholderTextColor={colors.gray[400]}
                  autoCapitalize="words"
                />
              </View>

              <View style={{ marginBottom: ds.spacing(16) }}>
                <Text
                  style={{ fontWeight: weight.semibold, color: color.ink2, fontSize: ds.fontSize(typeScale.body),
                    marginBottom: ds.spacing(8) }}

                >
                  Category *
                </Text>
                <View
                  className="flex-row flex-wrap"
                  style={{ columnGap: ds.spacing(8), rowGap: ds.spacing(8) }}
                >
                  {QUICK_CREATE_CATEGORIES.map((cat) => {
                    const isSelected = newItemCategory === cat;
                    return (
                      <TouchableOpacity
                        key={cat}

                        style={{ borderRadius: radius.control, backgroundColor: isSelected ? color.accent : color.well, minHeight: Math.max(40, ds.buttonH - ds.spacing(10)),
                          paddingHorizontal: ds.spacing(12),
                          justifyContent: "center" }}
                        onPress={() => setNewItemCategory(cat)}
                      >
                        <Text
                          style={{ fontWeight: weight.semibold, color: isSelected ? color.onAccent : color.ink2, fontSize: ds.fontSize(typeScale.body) }}

                        >
                          {getCategoryLabel(cat)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={{ marginBottom: ds.spacing(16) }}>
                <Text
                  style={{ fontWeight: weight.semibold, color: color.ink2, fontSize: ds.fontSize(typeScale.body),
                    marginBottom: ds.spacing(8) }}

                >
                  Supplier *
                </Text>
                <View
                  className="flex-row flex-wrap"
                  style={{ columnGap: ds.spacing(8), rowGap: ds.spacing(8) }}
                >
                  {QUICK_CREATE_SUPPLIERS.map((sup) => {
                    const isSelected = newItemSupplier === sup;
                    return (
                      <TouchableOpacity
                        key={sup}

                        style={{ borderRadius: radius.control, backgroundColor: isSelected ? color.accent : color.well, minHeight: Math.max(40, ds.buttonH - ds.spacing(10)),
                          paddingHorizontal: ds.spacing(12),
                          justifyContent: "center" }}
                        onPress={() => setNewItemSupplier(sup)}
                      >
                        <Text
                          style={{ fontWeight: weight.semibold, color: isSelected ? color.onAccent : color.ink2, fontSize: ds.fontSize(typeScale.body) }}

                        >
                          {sup === "fish_supplier"
                            ? "Fish Supplier"
                            : sup === "asian_market"
                              ? "Asian Market"
                              : "Main Distributor"}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View
                className="flex-row"
                style={{
                  marginBottom: ds.spacing(16),
                  columnGap: ds.spacing(12),
                }}
              >
                <View className="flex-1">
                  <Text
                    style={{ fontWeight: weight.semibold, color: color.ink2, fontSize: ds.fontSize(typeScale.body),
                      marginBottom: ds.spacing(8) }}

                  >
                    Base Unit
                  </Text>
                  <TextInput
                    className="border"
                    style={{ backgroundColor: color.card, borderColor: color.hairlineStrong, color: color.ink, borderRadius: radius.control,
                      paddingHorizontal: ds.spacing(16),
                      minHeight: ds.buttonH,
                      fontSize: ds.fontSize(typeScale.body) }}
                    value={newItemBaseUnit}
                    onChangeText={setNewItemBaseUnit}
                    placeholder="e.g., lb"
                    placeholderTextColor={colors.gray[400]}
                    autoCapitalize="none"
                  />
                </View>
                <View className="flex-1">
                  <Text
                    style={{ fontWeight: weight.semibold, color: color.ink2, fontSize: ds.fontSize(typeScale.body),
                      marginBottom: ds.spacing(8) }}

                  >
                    Pack Unit
                  </Text>
                  <TextInput
                    className="border"
                    style={{ backgroundColor: color.card, borderColor: color.hairlineStrong, color: color.ink, borderRadius: radius.control,
                      paddingHorizontal: ds.spacing(16),
                      minHeight: ds.buttonH,
                      fontSize: ds.fontSize(typeScale.body) }}
                    value={newItemPackUnit}
                    onChangeText={setNewItemPackUnit}
                    placeholder="e.g., case"
                    placeholderTextColor={colors.gray[400]}
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <View style={{ marginBottom: ds.spacing(24) }}>
                  <Text
                    style={{ fontWeight: weight.semibold, color: color.ink2, fontSize: ds.fontSize(typeScale.body),
                      marginBottom: ds.spacing(8) }}

                  >
                  Pack Size
                  </Text>
                <View className="flex-row items-center">
                  <TextInput
                    className="border"
                    style={{ backgroundColor: color.card, borderColor: color.hairlineStrong, color: color.ink, width: ds.spacing(96),
                      borderRadius: radius.control,
                      paddingHorizontal: ds.spacing(16),
                      minHeight: ds.buttonH,
                      fontSize: ds.fontSize(typeScale.body) }}
                    value={newItemPackSize}
                    onChangeText={setNewItemPackSize}
                    placeholder="1"
                    placeholderTextColor={colors.gray[400]}
                    keyboardType="decimal-pad"
                  />
                  <Text
                    style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.body),
                      marginLeft: ds.spacing(12) }}

                  >
                    Defaults to 1 when blank
                  </Text>
                </View>
                <Text
                  style={{ color: color.ink3, fontSize: ds.fontSize(typeScale.secondary),
                    marginTop: ds.spacing(8) }}

                >
                  Enter one unit or both. Missing pack-size values sync as 1.
                </Text>
              </View>
            </ScrollView>

            <View
              className="border-t"
              style={{ backgroundColor: color.card, borderColor: color.hairlineStrong, paddingHorizontal: ds.spacing(16),
                paddingVertical: ds.spacing(14) }}
            >
              <TouchableOpacity
                className={`items-center flex-row justify-center ${isCreatingItem ? 'bg-primary-300' : ''}`}
                style={{ borderRadius: radius.control, backgroundColor: isCreatingItem ? undefined : color.accent, minHeight: ds.buttonH }}
                onPress={handleCreateItem}
                disabled={isCreatingItem}
              >
                <Ionicons name="add-circle" size={ds.icon(20)} color="white" />
                <Text
                  style={{ color: color.onAccent, fontSize: ds.buttonFont, marginLeft: ds.spacing(8) }}
                  className="font-bold"
                >
                  {isCreatingItem ? "Adding..." : "Add Item"}
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </FullScreenSheet>

      {/* Android: Add to Cart button above keyboard */}
      {Platform.OS === "android" &&
        isKeyboardVisible &&
        screenState === "quantity" &&
        selectedItem && (
          <View
            style={{
              position: "absolute",
              bottom: keyboardHeight,
              left: 0,
              right: 0,
            }}
          >
            <View
              style={{
                backgroundColor: glassColors.background,
                borderTopWidth: glassHairlineWidth,
                borderTopColor: glassColors.divider,
                paddingHorizontal: ds.spacing(12),
                paddingVertical: ds.spacing(8),
              }}
            >
              <TouchableOpacity
                onPress={handleAddToCart}
                className={`items-center flex-row justify-center ${canAddToCart ? '' : 'bg-primary-300'}`}
                style={{ borderRadius: radius.control, backgroundColor: canAddToCart ? color.accent : undefined, minHeight: ds.buttonH }}
                activeOpacity={0.8}
                disabled={!canAddToCart}
              >
                <Ionicons name="cart" size={ds.icon(20)} color={glassColors.textOnPrimary} />
                <Text
                  style={{
                    fontSize: ds.buttonFont,
                    marginLeft: ds.spacing(8),
                    color: glassColors.textOnPrimary,
                    fontWeight: weight.bold,
                  }}
                >
                  {addButtonText}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

      {/* iOS Input Accessory View */}
      {renderInputAccessory()}
    </SafeAreaView>
  );
}
