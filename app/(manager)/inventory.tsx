import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Animated,
  useWindowDimensions,
} from 'react-native';
import type { ReactNode } from 'react';
import { BottomSheetShell } from '@/components/BottomSheetShell';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore, useInventoryStore } from '@/store';
import {
  InventoryItem,
 KNOWN_ITEM_CATEGORIES, KNOWN_SUPPLIER_CATEGORIES } from '@/types';
import { getCategoryLabel, getSupplierCategoryLabel } from '@/constants';
import { Loading, ListRow, ScreenHeader, getTabBarClearance } from '@/components/ui';
import { showNotice } from '@/components/ui/NoticeSheet';
import { useResolvedActiveLocation } from '@/hooks/useResolvedActiveLocation';
import { useSettingsNavigationContext } from '@/hooks/useSettingsBackRoute';
import { getOrGenerateMyChecklist, type ChecklistItem } from '@/services/orderChecklist';
import { locationGroupForLocation, formatQuantity } from '@/features/simpleOrder/checklistSelection';
import { getInventoryWithStock, InventoryWithStock } from '@/lib/api/stock';
import { supabase } from '@/lib/supabase';
import { getCheckStatus } from '@/store/stockStore';
import { useStockNetworkStatus } from '@/hooks';
import { useManagedRefresh } from '@/hooks/useManagedRefresh';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { normalizeInventoryPackSize } from '@/lib/inventoryUnits';
import {
  type ManagerInventoryStatus as InventoryStatus,
  type ManagerInventoryStockItem as InventoryStockItem,
} from '@/features/inventory/ManagerInventoryRow';
import { color, radius, typeScale, weight } from '@/theme/tokens';
import { Sheet } from '@/components/ui/Sheet';


function InventoryFormSheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  const { height } = useWindowDimensions();
  return <BottomSheetShell visible={visible} onClose={onClose} horizontalPadding={0} bottomPadding={0}>
    <View style={{ height: height * 0.88 - 18 }}>{children}</View>
  </BottomSheetShell>;
}

const categories = [...KNOWN_ITEM_CATEGORIES];
const supplierCategories = [...KNOWN_SUPPLIER_CATEGORIES];

const CATEGORY_EMOJI: Record<string, string> = {
  fish: '🐟',
  protein: '🥩',
  produce: '🥬',
  dry: '🍚',
  dairy_cold: '🧊',
  frozen: '❄️',
  sauces: '🍶',
  alcohol: '🍺',
  packaging: '📦',
};

const COUNT_UNITS = ['portion', 'each', 'lb', 'case', 'bag', 'bottle', 'jar', 'pack'] as const;
const ORDER_UNITS = ['lb', 'case', 'each', 'bag', 'bottle', 'jar', 'pack'] as const;

const BULK_BAR_HEIGHT = 88;

const ADD_EMOJIS = ['🐟', '🥩', '🥬', '🧊', '❄️', '🍶', '🍺', '📦', '🥗', '🍜'];

interface AreaItemEdit {
  id: string;
  area_id: string;
  unit_type: string;
  min_quantity: number;
  max_quantity: number;
  par_level: number | null;
  order_unit: string | null;
  conversion_factor: number | null;
  active: boolean;
  area: {
    id: string;
    name: string;
    location_id: string;
  };
}

interface NewItemForm {
  name: string;
  category: string;
  supplier_category: string;
  base_unit: string;
  pack_unit: string;
  pack_size: string;
}

const initialForm: NewItemForm = {
  name: '',
  category: 'produce',
  supplier_category: 'main_distributor',
  base_unit: '',
  pack_unit: '',
  pack_size: '1',
};

const getStatus = (item: InventoryWithStock): InventoryStatus => {
  if (item.current_quantity <= 0) return 'critical';
  if (item.current_quantity < item.min_quantity) return 'critical';
  if (item.current_quantity < item.min_quantity * 1.5) return 'low';
  return 'good';
};

const getInventoryItemKey = (item: InventoryStockItem) => item.id;

export default function ManagerInventoryScreen() {
  const ds = useScaledStyles();
  const navigationContext = useSettingsNavigationContext('manager');
  const { location: activeLocation } = useResolvedActiveLocation();
  const [usualItems, setUsualItems] = useState<Map<string, ChecklistItem>>(new Map());
  useEffect(() => {
    let current = true;
    void getOrGenerateMyChecklist(locationGroupForLocation(activeLocation?.name, activeLocation?.short_code)).then(checklist => {
      if (current) setUsualItems(new Map(checklist.items.filter(item => item.itemId !== null).map(item => [item.itemId ?? '', item])));
    }).catch(() => { if (current) setUsualItems(new Map()); });
    return () => { current = false; };
  }, [activeLocation?.name, activeLocation?.short_code]);
  const { user, locations } = useAuthStore(
    useShallow((state) => ({ user: state.user, locations: state.locations })),
  );
  const { addItem, fetchItems } = useInventoryStore(
    useShallow((state) => ({ addItem: state.addItem, fetchItems: state.fetchItems })),
  );
  useStockNetworkStatus();


  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkAddModal, setShowBulkAddModal] = useState(false);
  const [form, setForm] = useState<NewItemForm>(initialForm);
  const [addStep, setAddStep] = useState<'select' | 'create' | 'assign'>('select');
  const [addSearchQuery, setAddSearchQuery] = useState('');
  const [addSearchResults, setAddSearchResults] = useState<
    { item: InventoryItem; areaCount: number }[]
  >([]);
  const [isAddSearching, setIsAddSearching] = useState(false);
  const [selectedAddItem, setSelectedAddItem] = useState<InventoryItem | null>(null);
  const [newItemEmoji, setNewItemEmoji] = useState('');
  const [addLocationId, setAddLocationId] = useState<string | null>(null);
  const [addAreaOptions, setAddAreaOptions] = useState<{ id: string; name: string; icon?: string | null }[]>([]);
  const [addAreaSelections, setAddAreaSelections] = useState<
    Record<
      string,
      {
        selected: boolean;
        unit_type: string;
        min: string;
        max: string;
        order_unit: string;
        conversion: string;
      }
    >
  >({});
  const [addExistingAreaIds, setAddExistingAreaIds] = useState<string[]>([]);
  const [showAddUnitPicker, setShowAddUnitPicker] = useState(false);
  const [addUnitPickerTarget, setAddUnitPickerTarget] = useState<{ areaId: string; field: 'unit' | 'order' } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  const [bulkCategory, setBulkCategory] = useState<string>('produce');
  const [bulkSupplier, setBulkSupplier] = useState<string>('main_distributor');
  const [bulkBaseUnit, setBulkBaseUnit] = useState('lb');
  const [bulkPackUnit, setBulkPackUnit] = useState('case');
  const [bulkPackSize, setBulkPackSize] = useState('1');

  const [locationFilter, setLocationFilter] = useState<string>(activeLocation?.id ?? 'all');
  useEffect(() => setLocationFilter(activeLocation?.id ?? 'all'), [activeLocation?.id]);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const [stockItems, setStockItems] = useState<InventoryWithStock[]>([]);
  const [isStockLoading, setIsStockLoading] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryStockItem | null>(null);
  const [editAreas, setEditAreas] = useState<AreaItemEdit[]>([]);
  const [areaOptions, setAreaOptions] = useState<{ id: string; name: string; icon?: string | null }[]>([]);
  const [selectedAreaItemId, setSelectedAreaItemId] = useState<string | null>(null);
  const [showCountUnitPicker, setShowCountUnitPicker] = useState(false);
  const [showOrderUnitPicker, setShowOrderUnitPicker] = useState(false);
  const [editForm, setEditForm] = useState({
    unit_type: 'each',
    min: '',
    par: '',
    max: '',
    order_unit: 'case',
    conversion: '',
  });
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveTargetAreaId, setMoveTargetAreaId] = useState<string | null>(null);
  const [moveForm, setMoveForm] = useState({
    unit_type: 'each',
    min: '',
    max: '',
  });
  const [showMoveUnitPicker, setShowMoveUnitPicker] = useState(false);
  const [moveMode, setMoveMode] = useState<'replace' | 'duplicate'>('replace');
  const [isMoveSaving, setIsMoveSaving] = useState(false);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Record<string, boolean>>({});
  const [showBulkMoveModal, setShowBulkMoveModal] = useState(false);
  const [bulkMoveAreaId, setBulkMoveAreaId] = useState<string | null>(null);
  const [bulkMoveSettings, setBulkMoveSettings] = useState({ unit_type: 'each', min: '', max: '' });
  const [bulkMoveAreas, setBulkMoveAreas] = useState<{ id: string; name: string; icon?: string | null }[]>([]);
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const loadAreas = async () => {
      if (!showAddModal || !addLocationId) return;
      const { data } = await supabase
        .from('storage_areas')
        .select('id,name,icon')
        .eq('location_id', addLocationId)
        .eq('active', true)
        .order('sort_order', { ascending: true });
      setAddAreaOptions((data || []) as { id: string; name: string; icon?: string | null }[]);
    };
    loadAreas();
  }, [addLocationId, showAddModal]);

  useEffect(() => {
    if (!showAddModal) return;
    setAddAreaSelections({});
    setAddExistingAreaIds([]);
  }, [addLocationId, showAddModal]);

  useEffect(() => {
    setBulkMoveAreas([]);
  }, [locationFilter]);

  const fetchInventoryStock = useCallback(async () => {
    setIsStockLoading(true);
    setStockError(null);
    try {
      const data = await getInventoryWithStock(locationFilter === 'all' ? undefined : locationFilter);
      setStockItems(data);
    } catch (err: any) {
      setStockError(err?.message ?? 'Failed to load inventory stock.');
    } finally {
      setIsStockLoading(false);
    }
  }, [locationFilter]);

  useEffect(() => {
    fetchInventoryStock();
  }, [fetchInventoryStock]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const { refreshing, onRefresh } = useManagedRefresh(
    useCallback(async () => {
      await fetchInventoryStock();
      await fetchItems({ force: true });
    }, [fetchInventoryStock, fetchItems]),
  );

  const stockWithStatus: InventoryStockItem[] = useMemo(() => {
    return stockItems.map((item) => {
      const status = getStatus(item);
      const overdue = item.areas.some((area) => getCheckStatus(area) === 'overdue');
      const fillPercent = item.max_quantity > 0
        ? Math.min(item.current_quantity / item.max_quantity, 1) * 100
        : 0;
      const areaLabel = item.area_names.length > 1 ? 'Multiple stations' : (item.area_names[0] ?? 'Unassigned');
      return {
        ...item,
        status,
        overdue,
        fillPercent,
        areaLabel,
      };
    });
  }, [stockItems]);

  const filteredItems = useMemo(() => {
    let items = stockWithStatus;
    if (categoryFilter) {
      items = items.filter((item) => item.inventory_item.category === categoryFilter);
    }

    if (debouncedQuery.length > 0) {
      const query = debouncedQuery.toLowerCase();
      items = items.filter((item) => item.inventory_item.name.toLowerCase().includes(query));
    }

    return items;
  }, [stockWithStatus, categoryFilter, debouncedQuery]);

  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      return a.inventory_item.name.localeCompare(b.inventory_item.name);
    });
  }, [filteredItems]);

  const showToastMessage = useCallback((message: string) => {
    setToastMessage(message);
    setShowToast(true);
    Animated.sequence([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.delay(1200),
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setShowToast(false));
  }, [toastOpacity]);

  const applyAreaItemToForm = useCallback((areaItem: AreaItemEdit) => {
    setSelectedAreaItemId(areaItem.id);
    setEditForm({
      unit_type: areaItem.unit_type || 'each',
      min: String(areaItem.min_quantity ?? ''),
      par: areaItem.par_level != null ? String(areaItem.par_level) : '',
      max: String(areaItem.max_quantity ?? ''),
      order_unit: areaItem.order_unit || areaItem.unit_type || 'case',
      conversion: areaItem.conversion_factor != null ? String(areaItem.conversion_factor) : '',
    });
  }, []);

  const openEditModal = useCallback(async (item: InventoryStockItem) => {
    setEditingItem(item);
    setShowEditModal(true);
    try {
      const { data, error } = await supabase
        .from('area_items')
        .select(
          `
          id,
          area_id,
          unit_type,
          min_quantity,
          max_quantity,
          par_level,
          order_unit,
          conversion_factor,
          active,
          area:storage_areas(
            id,
            name,
            location_id
          )
        `
        )
        .eq('inventory_item_id', item.inventory_item.id)
        .eq('active', true);

      if (error) throw error;

      const areaItems = (data || [])
        .map((row: any) => ({
          ...row,
          area: row.area,
        }))
        .filter((row: any) => row.area?.location_id === item.location.id) as AreaItemEdit[];

      setEditAreas(areaItems);

      const { data: areas } = await supabase
        .from('storage_areas')
        .select('id,name,icon')
        .eq('location_id', item.location.id)
        .eq('active', true)
        .order('sort_order', { ascending: true });

      setAreaOptions((areas || []) as { id: string; name: string; icon?: string | null }[]);

      if (areaItems.length > 0) {
        applyAreaItemToForm(areaItems[0]);
      } else {
        setSelectedAreaItemId(null);
      }
    } catch (err: any) {
      showNotice('Error', err?.message ?? 'Failed to load item settings.');
    }
  }, [applyAreaItemToForm]);

  const selectedAreaItem = useMemo(() => {
    return editAreas.find((area) => area.id === selectedAreaItemId) ?? null;
  }, [editAreas, selectedAreaItemId]);

  const handleChangeUnitType = useCallback(
    (nextUnit: string) => {
      if (nextUnit === editForm.unit_type) {
        setShowCountUnitPicker(false);
        return;
      }

      const hasValues = Number(editForm.min) > 0 || Number(editForm.par) > 0 || Number(editForm.max) > 0;
      if (!hasValues) {
        setEditForm((prev) => ({ ...prev, unit_type: nextUnit }));
        setShowCountUnitPicker(false);
        return;
      }

      showNotice(
        'Update Stock Levels?',
        'Changing the counting unit may require updating min/max values. Update now?',
        [
          {
            text: 'Keep Values',
            style: 'cancel',
            onPress: () => {
              setEditForm((prev) => ({ ...prev, unit_type: nextUnit }));
              setShowCountUnitPicker(false);
            },
          },
          {
            text: 'Reset Values',
            onPress: () => {
              setEditForm((prev) => ({
                ...prev,
                unit_type: nextUnit,
                min: '',
                par: '',
                max: '',
              }));
              setShowCountUnitPicker(false);
            },
          },
        ]
      );
    },
    [editForm]
  );

  const handleSaveEdit = useCallback(async () => {
    if (!selectedAreaItem || !editingItem) return;

    const min = Number(editForm.min);
    const max = Number(editForm.max);
    const par = editForm.par ? Number(editForm.par) : null;

    if (Number.isNaN(min) || Number.isNaN(max) || min < 0 || max < 0) {
      showNotice('Invalid Values', 'Please enter valid minimum and maximum values.');
      return;
    }

    if (min >= max) {
      showNotice('Invalid Range', 'Minimum must be less than maximum.');
      return;
    }

    if (par !== null && (par <= min || par >= max)) {
      showNotice('Invalid Par Level', 'Par level must be between min and max.');
      return;
    }

    const conversion = editForm.conversion ? Number(editForm.conversion) : null;
    if (conversion !== null && (!Number.isFinite(conversion) || conversion <= 0)) {
      showNotice('Invalid Conversion', 'Conversion factor must be a positive number.');
      return;
    }

    setIsEditSaving(true);
    try {
      const { error } = await supabase
        .from('area_items')
        .update({
          unit_type: editForm.unit_type,
          min_quantity: min,
          max_quantity: max,
          par_level: par,
          order_unit: editForm.order_unit,
          conversion_factor: conversion,
        })
        .eq('id', selectedAreaItem.id);

      if (error) throw error;

      showToastMessage('Stock settings updated');
      setShowEditModal(false);
      fetchInventoryStock();
    } catch (err: any) {
      showNotice('Save Failed', err?.message ?? 'Unable to save changes.');
    } finally {
      setIsEditSaving(false);
    }
  }, [selectedAreaItem, editingItem, editForm, fetchInventoryStock, showToastMessage]);

  const areaItemsByArea = useMemo(() => {
    const map = new Map<string, AreaItemEdit>();
    editAreas.forEach((area) => map.set(area.area_id, area));
    return map;
  }, [editAreas]);

  const moveTargetArea = useMemo(() => {
    return areaOptions.find((area) => area.id === moveTargetAreaId) ?? null;
  }, [areaOptions, moveTargetAreaId]);

  const moveTargetExisting = useMemo(() => {
    if (!moveTargetAreaId) return null;
    return areaItemsByArea.get(moveTargetAreaId) ?? null;
  }, [areaItemsByArea, moveTargetAreaId]);

  const openMoveModal = useCallback(() => {
    if (!selectedAreaItem) return;
    setMoveTargetAreaId(null);
    setMoveMode('replace');
    setMoveForm({
      unit_type: selectedAreaItem.unit_type || 'each',
      min: String(selectedAreaItem.min_quantity ?? ''),
      max: String(selectedAreaItem.max_quantity ?? ''),
    });
    setShowMoveModal(true);
  }, [selectedAreaItem]);

  const handleSelectMoveArea = useCallback(
    (areaId: string) => {
      if (!selectedAreaItem) return;
      if (areaId === selectedAreaItem.area_id) return;

      const existing = areaItemsByArea.get(areaId);
      setMoveTargetAreaId(areaId);
      setMoveMode('replace');

      if (existing) {
        setMoveForm({
          unit_type: existing.unit_type || 'each',
          min: String(existing.min_quantity ?? ''),
          max: String(existing.max_quantity ?? ''),
        });
      } else {
        setMoveForm({
          unit_type: selectedAreaItem.unit_type || 'each',
          min: String(selectedAreaItem.min_quantity ?? ''),
          max: String(selectedAreaItem.max_quantity ?? ''),
        });
      }
    },
    [areaItemsByArea, selectedAreaItem]
  );

  const handleMoveItem = useCallback(async () => {
    if (!selectedAreaItem || !editingItem || !moveTargetAreaId) return;

    const min = Number(moveForm.min);
    const max = Number(moveForm.max);
    if (Number.isNaN(min) || Number.isNaN(max) || min < 0 || max < 0) {
      showNotice('Invalid Values', 'Please enter valid min/max values.');
      return;
    }
    if (min >= max) {
      showNotice('Invalid Range', 'Minimum must be less than maximum.');
      return;
    }

    const existing = areaItemsByArea.get(moveTargetAreaId);
    setIsMoveSaving(true);
    try {
      if (existing) {
        if (moveMode === 'duplicate') {
          showNotice('Already Exists', 'This item already exists in the selected area.');
          setIsMoveSaving(false);
          return;
        }

        const { error: updateTargetError } = await supabase
          .from('area_items')
          .update({
            unit_type: moveForm.unit_type,
            min_quantity: min,
            max_quantity: max,
            current_quantity: 0,
            order_unit: selectedAreaItem.order_unit ?? moveForm.unit_type,
            conversion_factor: selectedAreaItem.conversion_factor ?? null,
          })
          .eq('id', existing.id);

        if (updateTargetError) throw updateTargetError;

        const { error: deactivateError } = await supabase
          .from('area_items')
          .update({ active: false })
          .eq('id', selectedAreaItem.id);

        if (deactivateError) throw deactivateError;
      } else if (moveMode === 'duplicate') {
        const { error: insertError } = await supabase
          .from('area_items')
          .insert({
            area_id: moveTargetAreaId,
            inventory_item_id: editingItem.inventory_item.id,
            min_quantity: min,
            max_quantity: max,
            par_level: null,
            current_quantity: 0,
            unit_type: moveForm.unit_type,
            order_unit: selectedAreaItem.order_unit ?? moveForm.unit_type,
            conversion_factor: selectedAreaItem.conversion_factor ?? null,
            active: true,
          });

        if (insertError) throw insertError;
      } else {
        const { error: updateError } = await supabase
          .from('area_items')
          .update({
            area_id: moveTargetAreaId,
            unit_type: moveForm.unit_type,
            min_quantity: min,
            max_quantity: max,
            current_quantity: 0,
            order_unit: selectedAreaItem.order_unit ?? moveForm.unit_type,
            conversion_factor: selectedAreaItem.conversion_factor ?? null,
          })
          .eq('id', selectedAreaItem.id);

        if (updateError) throw updateError;
      }

      showToastMessage('Item moved');
      setShowMoveModal(false);
      setShowEditModal(false);
      fetchInventoryStock();
    } catch (err: any) {
      showNotice('Move Failed', err?.message ?? 'Unable to move item.');
    } finally {
      setIsMoveSaving(false);
    }
  }, [
    selectedAreaItem,
    editingItem,
    moveTargetAreaId,
    moveForm,
    areaItemsByArea,
    moveMode,
    showToastMessage,
    fetchInventoryStock,
  ]);

  const handleDeactivateAreaItem = useCallback(() => {
    if (!selectedAreaItem || !editingItem) return;

    showNotice(
      'Deactivate Item',
      `Remove ${editingItem.inventory_item.name} from ${selectedAreaItem.area.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('area_items')
                .update({ active: false })
                .eq('id', selectedAreaItem.id);

              if (error) throw error;

              showToastMessage('Item deactivated');
              setShowEditModal(false);
              fetchInventoryStock();
            } catch (err: any) {
              showNotice('Deactivate Failed', err?.message ?? 'Unable to deactivate item.');
            }
          },
        },
      ]
    );
  }, [selectedAreaItem, editingItem, fetchInventoryStock, showToastMessage]);

  const openAddFlow = useCallback(() => {
    const defaultLocation =
      locationFilter !== 'all'
        ? locationFilter
        : user?.default_location_id || locations[0]?.id || null;
    setAddLocationId(defaultLocation);
    setAddStep('select');
    setAddSearchQuery('');
    setAddSearchResults([]);
    setSelectedAddItem(null);
    setNewItemEmoji('');
    setAddAreaSelections({});
    setAddExistingAreaIds([]);
    setForm(initialForm);
    setShowAddModal(true);
  }, [locationFilter, user, locations]);

  const searchExistingItems = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      setAddSearchResults([]);
      return;
    }

    setIsAddSearching(true);
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id,name,category,supplier_category,base_unit,pack_unit,pack_size')
        .ilike('name', `%${trimmed}%`)
        .eq('active', true)
        .order('name', { ascending: true })
        .limit(25);

      if (error) throw error;

      const items = (data || []) as InventoryItem[];
      const ids = items.map((item) => item.id);
      let counts: Record<string, number> = {};
      if (ids.length > 0) {
        const { data: areaItems } = await supabase
          .from('area_items')
          .select('inventory_item_id')
          .in('inventory_item_id', ids)
          .eq('active', true);
        counts = (areaItems || []).reduce(
          (acc: Record<string, number>, row: any) => {
            acc[row.inventory_item_id] = (acc[row.inventory_item_id] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        );
      }

      setAddSearchResults(
        items.map((item) => ({
          item,
          areaCount: counts[item.id] || 0,
        }))
      );
    } catch {
      setAddSearchResults([]);
    } finally {
      setIsAddSearching(false);
    }
  }, []);

  useEffect(() => {
    if (!showAddModal || addStep !== 'select') return;
    const timer = setTimeout(() => {
      searchExistingItems(addSearchQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [addSearchQuery, addStep, showAddModal, searchExistingItems]);

  const handleSelectExistingItem = useCallback(
    async (item: InventoryItem) => {
      setSelectedAddItem(item);
      setAddStep('assign');
      setAddExistingAreaIds([]);
      setAddAreaSelections({});

      if (addLocationId) {
        const { data } = await supabase
          .from('area_items')
          .select('area_id, area:storage_areas(location_id)')
          .eq('inventory_item_id', item.id)
          .eq('active', true);

        const ids = (data || [])
          .filter((row: any) => row.area?.location_id === addLocationId)
          .map((row: any) => row.area_id);
        setAddExistingAreaIds(ids);
      }
    },
    [addLocationId]
  );

  const handleStartCreateItem = useCallback(() => {
    setSelectedAddItem(null);
    setAddStep('create');
  }, []);

  const handleContinueToAreas = useCallback(() => {
    if (!form.name.trim()) {
      showNotice('Missing Name', 'Please enter an item name.');
      return;
    }
    setAddStep('assign');
    setAddExistingAreaIds([]);
    setAddAreaSelections({});
  }, [form.name]);

  const toggleAddAreaSelection = useCallback(
    (areaId: string) => {
      if (addExistingAreaIds.includes(areaId)) return;

      setAddAreaSelections((prev) => {
        const current = prev[areaId];
        const nextSelected = !current?.selected;
        if (!nextSelected) {
          return {
            ...prev,
            [areaId]: {
              ...current,
              selected: false,
            },
          };
        }

        const defaultUnit = selectedAddItem?.base_unit || 'each';
        const defaultOrder = selectedAddItem?.pack_unit || 'case';
        const defaultConversion = selectedAddItem?.pack_size ? String(selectedAddItem.pack_size) : '1';
        return {
          ...prev,
          [areaId]: {
            selected: true,
            unit_type: current?.unit_type || defaultUnit,
            min: current?.min || '2',
            max: current?.max || '6',
            order_unit: current?.order_unit || defaultOrder,
            conversion: current?.conversion || defaultConversion,
          },
        };
      });
    },
    [addExistingAreaIds, selectedAddItem]
  );

  const handleAddItemFlow = useCallback(async () => {
    const selectedAreaIds = Object.entries(addAreaSelections)
      .filter(([, settings]) => settings.selected)
      .map(([areaId]) => areaId);

    if (selectedAreaIds.length === 0) {
      showNotice('Select Areas', 'Choose at least one storage area.');
      return;
    }

    const firstSettings = addAreaSelections[selectedAreaIds[0]];
    if (!firstSettings) {
      showNotice('Missing Settings', 'Please provide stock settings for the selected areas.');
      return;
    }

    setIsSubmitting(true);
    try {
      let inventoryItem = selectedAddItem;

      if (!inventoryItem) {
        const name = newItemEmoji
          ? `${newItemEmoji} ${form.name.trim()}`.trim()
          : form.name.trim();
        const baseUnit = firstSettings.unit_type || 'each';
        const packUnit = firstSettings.order_unit || 'case';
        const packSize = Number(firstSettings.conversion) || 1;

        inventoryItem = await addItem({
          name,
          category: form.category,
          supplier_category: form.supplier_category,
          base_unit: baseUnit,
          pack_unit: packUnit,
          pack_size: packSize,
          created_by: user?.id,
        });
      }

      const payload = selectedAreaIds.map((areaId) => {
        const settings = addAreaSelections[areaId];
        const min = Number(settings.min) || 0;
        const max = Number(settings.max) || 0;
        if (min > 0 && max > 0 && min >= max) {
          throw new Error('Min must be less than Max for selected areas.');
        }
        return {
          area_id: areaId,
          inventory_item_id: inventoryItem!.id,
          min_quantity: min,
          max_quantity: max,
          par_level: null,
          current_quantity: 0,
          unit_type: settings.unit_type || 'each',
          order_unit: settings.order_unit || settings.unit_type || 'case',
          conversion_factor: settings.conversion ? Number(settings.conversion) : null,
          active: true,
        };
      });

      const { error } = await supabase
        .from('area_items')
        .upsert(payload, { onConflict: 'area_id,inventory_item_id' });

      if (error) throw error;

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setShowAddModal(false);
      setAddStep('select');
      setSelectedAddItem(null);
      setAddAreaSelections({});
      setAddExistingAreaIds([]);
      setForm(initialForm);
      setNewItemEmoji('');
      fetchInventoryStock();
      fetchItems({ force: true });
      showNotice('Success', 'Item added to selected areas.');
    } catch (error: any) {
      showNotice('Error', error.message || 'Failed to add item');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    addAreaSelections,
    selectedAddItem,
    newItemEmoji,
    form,
    addItem,
    user,
    fetchInventoryStock,
    fetchItems,
  ]);

  const parseBulkInput = useCallback((): string[] => {
    return bulkInput
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }, [bulkInput]);

  const handleBulkAdd = useCallback(async () => {
    const itemNames = parseBulkInput();

    if (itemNames.length === 0) {
      showNotice('Error', 'Please enter at least one item name');
      return;
    }

    if (!bulkBaseUnit.trim() && !bulkPackUnit.trim()) {
      showNotice('Error', 'Please enter at least one unit');
      return;
    }

    const packSizeInput = bulkPackSize.trim();
    if (
      packSizeInput.length > 0 &&
      (!Number.isFinite(Number(packSizeInput)) || Number(packSizeInput) < 1)
    ) {
      showNotice('Error', 'Please enter a valid pack size');
      return;
    }
    const packSize = packSizeInput.length > 0 ? normalizeInventoryPackSize(packSizeInput) : undefined;

    setIsSubmitting(true);
    let successCount = 0;
    const errors: string[] = [];

    try {
      for (const name of itemNames) {
        try {
          await addItem({
            name: name,
            category: bulkCategory,
            supplier_category: bulkSupplier,
            base_unit: bulkBaseUnit.trim(),
            pack_unit: bulkPackUnit.trim(),
            pack_size: packSize,
            created_by: user?.id,
          });
          successCount++;
        } catch (error: any) {
          errors.push(`${name}: ${error.message || 'Failed'}`);
        }
      }

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setShowBulkAddModal(false);
      setBulkInput('');
      fetchInventoryStock();

      if (errors.length > 0) {
        showNotice(
          'Partial Success',
          `Added ${successCount} item${successCount !== 1 ? 's' : ''}.\n\nErrors:\n${errors.join('\n')}`
        );
      } else {
        showNotice('Success', `Added ${successCount} item${successCount !== 1 ? 's' : ''} successfully`);
      }
    } catch (error: any) {
      showNotice('Error', error.message || 'Failed to add items');
    } finally {
      setIsSubmitting(false);
    }
  }, [parseBulkInput, bulkCategory, bulkSupplier, bulkBaseUnit, bulkPackUnit, bulkPackSize, addItem, user, fetchInventoryStock]);

  const bulkSelectedItems = useMemo(() => {
    return sortedItems.filter((item) => bulkSelectedIds[item.id]);
  }, [bulkSelectedIds, sortedItems]);

  const bulkSelectedCount = bulkSelectedItems.length;

  const enterBulkMode = useCallback(
    (item?: InventoryStockItem) => {
      if (locationFilter === 'all') {
        showNotice('Select a Location', 'Choose a specific location to use bulk edit mode.');
        return;
      }
      setIsBulkMode(true);
      if (item) {
        setBulkSelectedIds({ [item.id]: true });
      } else {
        setBulkSelectedIds({});
      }
    },
    [locationFilter]
  );

  const exitBulkMode = useCallback(() => {
    setIsBulkMode(false);
    setBulkSelectedIds({});
  }, []);

  const toggleBulkSelection = useCallback((itemId: string) => {
    setBulkSelectedIds((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  }, []);

  const handleBulkSelectAll = useCallback(() => {
    const visibleIds = sortedItems.map((item) => item.id);
    const allSelected = visibleIds.every((id) => bulkSelectedIds[id]);
    if (allSelected) {
      setBulkSelectedIds({});
      return;
    }
    const next: Record<string, boolean> = {};
    visibleIds.forEach((id) => {
      next[id] = true;
    });
    setBulkSelectedIds(next);
  }, [sortedItems, bulkSelectedIds]);

  const handleBulkRemove = useCallback(async () => {
    if (bulkSelectedCount === 0) return;
    if (locationFilter === 'all') {
      showNotice('Select a Location', 'Choose a specific location to remove items.');
      return;
    }

    showNotice(
      'Remove Items',
      `Remove ${bulkSelectedCount} item${bulkSelectedCount !== 1 ? 's' : ''} from this location?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setIsBulkSaving(true);
            try {
              const itemIds = bulkSelectedItems.map((item) => item.inventory_item.id);
              const { data, error } = await supabase
                .from('area_items')
                .select('id, area:storage_areas(location_id)')
                .in('inventory_item_id', itemIds)
                .eq('active', true);

              if (error) throw error;
              const targetIds = (data || [])
                .filter((row: any) => row.area?.location_id === locationFilter)
                .map((row: any) => row.id);

              if (targetIds.length > 0) {
                const { error: updateError } = await supabase
                  .from('area_items')
                  .update({ active: false })
                  .in('id', targetIds);
                if (updateError) throw updateError;
              }

              showToastMessage(`Removed ${bulkSelectedCount} item${bulkSelectedCount !== 1 ? 's' : ''}`);
              exitBulkMode();
              fetchInventoryStock();
            } catch (err: any) {
              showNotice('Remove Failed', err?.message ?? 'Unable to remove items.');
            } finally {
              setIsBulkSaving(false);
            }
          },
        },
      ]
    );
  }, [
    bulkSelectedCount,
    bulkSelectedItems,
    locationFilter,
    exitBulkMode,
    fetchInventoryStock,
    showToastMessage,
  ]);

  const openBulkMove = useCallback(async () => {
    if (bulkSelectedCount === 0) return;
    if (locationFilter === 'all') {
      showNotice('Select a Location', 'Choose a specific location to move items.');
      return;
    }

    if (bulkMoveAreas.length === 0) {
      const { data } = await supabase
        .from('storage_areas')
        .select('id,name,icon')
        .eq('location_id', locationFilter)
        .eq('active', true)
        .order('sort_order', { ascending: true });
      setBulkMoveAreas((data || []) as { id: string; name: string; icon?: string | null }[]);
    }

    const first = bulkSelectedItems[0];
    setBulkMoveSettings({
      unit_type: first?.unit_type || 'each',
      min: String(first?.min_quantity ?? ''),
      max: String(first?.max_quantity ?? ''),
    });
    setBulkMoveAreaId(null);
    setShowBulkMoveModal(true);
  }, [bulkSelectedCount, bulkSelectedItems, bulkMoveAreas.length, locationFilter]);

  const handleBulkMoveItems = useCallback(async () => {
    if (!bulkMoveAreaId || bulkSelectedCount === 0 || locationFilter === 'all') return;

    const min = Number(bulkMoveSettings.min) || 0;
    const max = Number(bulkMoveSettings.max) || 0;
    if (min > 0 && max > 0 && min >= max) {
      showNotice('Invalid Range', 'Minimum must be less than maximum.');
      return;
    }

    setIsBulkSaving(true);
    try {
      const itemIds = bulkSelectedItems.map((item) => item.inventory_item.id);
      const { data, error } = await supabase
        .from('area_items')
        .select('id, inventory_item_id, area_id, area:storage_areas(location_id)')
        .in('inventory_item_id', itemIds)
        .eq('active', true);

      if (error) throw error;
      const rows = (data || []).filter((row: any) => row.area?.location_id === locationFilter);

      const grouped = new Map<string, any[]>();
      rows.forEach((row: any) => {
        if (!grouped.has(row.inventory_item_id)) {
          grouped.set(row.inventory_item_id, []);
        }
        grouped.get(row.inventory_item_id)!.push(row);
      });

      for (const [, group] of grouped.entries()) {
        const target = group.find((row) => row.area_id === bulkMoveAreaId);
        const others = group.filter((row) => row.id !== target?.id);
        if (target) {
          const { error: updateTargetError } = await supabase
            .from('area_items')
            .update({
              unit_type: bulkMoveSettings.unit_type,
              min_quantity: min,
              max_quantity: max,
              current_quantity: 0,
            })
            .eq('id', target.id);
          if (updateTargetError) throw updateTargetError;
        } else {
          const primary = group[0];
          if (!primary) continue;
          const { error: updatePrimaryError } = await supabase
            .from('area_items')
            .update({
              area_id: bulkMoveAreaId,
              unit_type: bulkMoveSettings.unit_type,
              min_quantity: min,
              max_quantity: max,
              current_quantity: 0,
            })
            .eq('id', primary.id);
          if (updatePrimaryError) throw updatePrimaryError;
        }

        if (others.length > 0) {
          const { error: deactivateError } = await supabase
            .from('area_items')
            .update({ active: false })
            .in('id', others.map((row) => row.id));
          if (deactivateError) throw deactivateError;
        }
      }

      showToastMessage(`Moved ${bulkSelectedCount} item${bulkSelectedCount !== 1 ? 's' : ''}`);
      setShowBulkMoveModal(false);
      exitBulkMode();
      fetchInventoryStock();
    } catch (err: any) {
      showNotice('Move Failed', err?.message ?? 'Unable to move items.');
    } finally {
      setIsBulkSaving(false);
    }
  }, [
    bulkMoveAreaId,
    bulkSelectedCount,
    bulkSelectedItems,
    bulkMoveSettings,
    locationFilter,
    exitBulkMode,
    fetchInventoryStock,
    showToastMessage,
  ]);

  const renderInventoryItem = useCallback(({ item, index }: { item: InventoryStockItem; index: number }) => {
    const usual = usualItems.get(item.inventory_item.id);
    const unit = usual?.unit ?? item.inventory_item.base_unit;
    return <TouchableOpacity activeOpacity={0.8} onPress={() => isBulkMode ? toggleBulkSelection(item.id) : void openEditModal(item)} onLongPress={() => enterBulkMode(item)} style={{ backgroundColor: isBulkMode && bulkSelectedIds[item.id] ? color.tint : color.card, borderTopLeftRadius: index === 0 ? radius.card : 0, borderTopRightRadius: index === 0 ? radius.card : 0, borderBottomLeftRadius: index === sortedItems.length - 1 ? radius.card : 0, borderBottomRightRadius: index === sortedItems.length - 1 ? radius.card : 0, overflow: 'hidden' }}>
      <ListRow title={item.inventory_item.name} subtitle={`${getCategoryLabel(item.inventory_item.category)} · per ${unit}`} last={index === sortedItems.length - 1}
        right={usual?.recommendedQty != null ? <View style={{ paddingHorizontal: ds.spacing(8), paddingVertical: ds.spacing(4), backgroundColor: color.well, borderRadius: radius.pill }}><Text style={{ fontSize: ds.fontSize(typeScale.caption), fontWeight: weight.bold, color: color.ink2 }}>{formatQuantity(usual.recommendedQty)} {unit}</Text></View> : undefined} />
    </TouchableOpacity>;
  }, [bulkSelectedIds, ds, enterBulkMode, isBulkMode, openEditModal, sortedItems.length, toggleBulkSelection, usualItems]);

  const renderEmptyState = useCallback(() => {
    let icon = '';
    let title = 'All items are well stocked!';
    let subtitle = 'No items need reordering at this time.';

    if (debouncedQuery.length > 0) {
      icon = '';
      title = `No items match "${debouncedQuery}"`;
      subtitle = 'Try a different search.';
    } else if (categoryFilter) {
      icon = '';
      title = 'No items in this category';
      subtitle = 'Try a different category.';

    }

    return (
      <View className="items-center justify-center" style={{ paddingVertical: ds.spacing(48) }}>
        <Text style={{ fontSize: ds.fontSize(typeScale.display) }}>{icon}</Text>
        <Text
          className="text-center font-semibold"
          style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.body), marginTop: ds.spacing(16) }}
        >
          {title}
        </Text>
        <Text
          className="text-center"
          style={{ color: color.ink3, fontSize: ds.fontSize(typeScale.body), marginTop: ds.spacing(8) }}
        >
          {subtitle}
        </Text>
      </View>
    );
  }, [categoryFilter, debouncedQuery, ds]);

  const renderListEmpty = useCallback(
    () =>
      isStockLoading ? (
        <View className="items-center justify-center" style={{ paddingVertical: ds.spacing(48) }}>
          <Text style={{ color: color.ink3, fontSize: ds.fontSize(typeScale.body) }}>
            Loading inventory...
          </Text>
        </View>
      ) : (
        renderEmptyState()
      ),
    [ds, isStockLoading, renderEmptyState],
  );

  const inventoryListContentStyle = useMemo(
    () => ({
      paddingHorizontal: ds.spacing(16),
      paddingBottom: isBulkMode
        ? BULK_BAR_HEIGHT + getTabBarClearance(0)
        : getTabBarClearance(0),
    }),
    [ds, isBulkMode],
  );

  const inventoryRefreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={refreshing}
        onRefresh={onRefresh}
        tintColor={color.accent}
      />
    ),
    [onRefresh, refreshing],
  );

  const bulkItemCount = parseBulkInput().length;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: color.page }} edges={['top', 'left', 'right']}>
      <View className="flex-1">
        <ScreenHeader title="Inventory" mode="pushed" includeSafeArea={false}
          onBack={() => isBulkMode ? exitBulkMode() : navigationContext.hasExplicitBackTo ? router.replace(navigationContext.backTo) : router.back()}
          right={<TouchableOpacity onPress={openAddFlow} accessibilityRole="button" accessibilityLabel="Add item" style={{ width: ds.spacing(40), height: ds.spacing(40), borderRadius: radius.pill, backgroundColor: color.card, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="add" size={ds.icon(20)} color={color.ink} /></TouchableOpacity>} />
        <View style={{ paddingHorizontal: ds.spacing(16), paddingTop: ds.spacing(2) }}>
          {stockError ? <Text style={{ color: color.alert, fontSize: ds.fontSize(typeScale.secondary), marginBottom: ds.spacing(10) }}>{stockError}</Text> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: color.card, borderRadius: radius.control, paddingHorizontal: ds.spacing(14), marginBottom: ds.spacing(10) }}>
            <Ionicons name="search-outline" size={ds.icon(18)} color={color.ink3} />
            <TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder={`Search ${stockWithStatus.length} items`} placeholderTextColor={color.ink3} accessibilityLabel="Search inventory" autoCapitalize="none" style={{ flex: 1, minHeight: ds.spacing(46), paddingHorizontal: ds.spacing(8), fontSize: ds.fontSize(typeScale.body), color: color.ink }} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: ds.spacing(8), paddingBottom: ds.spacing(6) }}>
            {[null, ...categories].map(category => <TouchableOpacity key={category ?? 'all'} onPress={() => setCategoryFilter(category)} accessibilityRole="button" accessibilityState={{ selected: categoryFilter === category }} style={{ borderRadius: radius.pill, paddingHorizontal: ds.spacing(12), paddingVertical: ds.spacing(7), backgroundColor: categoryFilter === category ? color.ink : color.card }}><Text style={{ fontSize: ds.fontSize(typeScale.secondary), fontWeight: weight.semibold, color: categoryFilter === category ? color.onAccent : color.ink2 }}>{category ? getCategoryLabel(category) : 'All'}</Text></TouchableOpacity>)}
          </ScrollView>
        </View>
        <FlatList
          data={sortedItems}
          renderItem={renderInventoryItem}
          keyExtractor={getInventoryItemKey}
          contentContainerStyle={inventoryListContentStyle}
          ListEmptyComponent={renderListEmpty}
          refreshControl={inventoryRefreshControl}
        />

        {isBulkMode && (
          <View
            className="absolute left-0 right-0 border-t"
            style={{ bottom: getTabBarClearance(0, 'pinned'), backgroundColor: color.card, borderColor: color.hairlineStrong, paddingHorizontal: ds.spacing(16),
              paddingVertical: ds.spacing(10) }}
          >
            <View className="flex-row items-center justify-between">
              <TouchableOpacity
                className="flex-1 border items-center"
                style={{ borderRadius: radius.control, borderColor: color.hairlineStrong, backgroundColor: bulkSelectedCount === 0 ? color.well : color.card, paddingHorizontal: ds.spacing(12),
                  paddingVertical: ds.spacing(12),
                  marginRight: ds.spacing(8),
                  minHeight: ds.buttonH,
                  justifyContent: 'center' }}
                onPress={openBulkMove}
                disabled={bulkSelectedCount === 0}
              >
                <Text className="font-semibold" style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.secondary) }}>Move</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 border items-center"
                style={{ borderRadius: radius.control, borderColor: color.hairlineStrong, backgroundColor: bulkSelectedCount === 0 ? color.well : color.card, paddingHorizontal: ds.spacing(12),
                  paddingVertical: ds.spacing(12),
                  marginRight: ds.spacing(8),
                  minHeight: ds.buttonH,
                  justifyContent: 'center' }}
                onPress={handleBulkRemove}
                disabled={bulkSelectedCount === 0}
              >
                <Text className="font-semibold" style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.secondary) }}>Remove</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 border items-center"
                style={{ borderRadius: radius.control, borderColor: color.hairlineStrong, backgroundColor: color.card, paddingHorizontal: ds.spacing(12),
                  paddingVertical: ds.spacing(12),
                  minHeight: ds.buttonH,
                  justifyContent: 'center' }}
                onPress={handleBulkSelectAll}
              >
                <Text className="font-semibold" style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.secondary) }}>Select All</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {showToast && (
        <Animated.View
          style={{
            opacity: toastOpacity,
            position: 'absolute',
            top: ds.spacing(80),
            left: ds.spacing(20),
            right: ds.spacing(20),
          }}
        >
          <View
            className="shadow-lg"
            style={{ backgroundColor: color.ink, borderRadius: radius.control, paddingHorizontal: ds.spacing(16),
              paddingVertical: ds.spacing(12) }}
          >
            <Text className="text-center" style={{ color: color.onAccent, fontWeight: weight.semibold, fontSize: ds.fontSize(typeScale.body) }}>{toastMessage}</Text>
          </View>
        </Animated.View>
      )}

      {/* Edit Item Modal */}
      <InventoryFormSheet
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
      >
        <SafeAreaView className="flex-1" style={{ backgroundColor: color.page }}>
          <View className="px-4 py-4 border-b flex-row items-center justify-between" style={{ backgroundColor: color.card, borderColor: color.hairlineStrong }}>
            <Text className="font-bold" style={{ fontSize: ds.fontSize(typeScale.title), color: color.ink }}>Edit Stock Settings</Text>
            <TouchableOpacity onPress={() => setShowEditModal(false)}>
              <Ionicons name="close" size={20} color={color.ink2} />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
            {editingItem && selectedAreaItem ? (
              <>
                <View className="p-4 border" style={{ backgroundColor: color.card, borderRadius: radius.card, borderColor: color.hairline }}>
                  <View className="flex-row items-center">
                    <Text className="mr-3" style={{ fontSize: ds.fontSize(typeScale.display) }}>
                      {CATEGORY_EMOJI[editingItem.inventory_item.category] ?? '📦'}
                    </Text>
                    <View className="flex-1">
                      <Text className="font-semibold" style={{ fontSize: ds.fontSize(typeScale.body), color: color.ink }}>
                        {editingItem.inventory_item.name}
                      </Text>
                      <Text className="mt-1" style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>
                        {selectedAreaItem.area.name} • {editingItem.location.name}
                      </Text>
                    </View>
                  </View>
                </View>

                <View className="mt-5 p-4 border" style={{ backgroundColor: color.card, borderRadius: radius.card, borderColor: color.hairline }}>
                  <Text className="font-semibold mb-3" style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>COUNTING UNIT</Text>
                  <TouchableOpacity
                    className="border px-4 py-3 flex-row items-center justify-between" style={{ borderColor: color.hairlineStrong, borderRadius: radius.control }}
                    onPress={() => setShowCountUnitPicker(true)}
                  >
                    <Text style={{ fontSize: ds.fontSize(typeScale.body), fontWeight: weight.semibold, color: color.ink }}>
                      {editForm.unit_type}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={color.ink3} />
                  </TouchableOpacity>

                  <Text className="font-semibold mt-5 mb-3" style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>
                    STOCK LEVELS (in {editForm.unit_type})
                  </Text>
                  <View>
                    <View className="mb-4">
                      <Text className="mb-2" style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>Minimum • Reorder when below</Text>
                      <TextInput
                        className="border px-4 py-3" style={{ borderColor: color.hairlineStrong, borderRadius: radius.control, color: color.ink }}
                        keyboardType="number-pad"
                        value={editForm.min}
                        onChangeText={(value) => setEditForm((prev) => ({ ...prev, min: value }))}
                      />
                    </View>
                    <View className="mb-4">
                      <Text className="mb-2" style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>Par Level • Ideal amount</Text>
                      <TextInput
                        className="border px-4 py-3" style={{ borderColor: color.hairlineStrong, borderRadius: radius.control, color: color.ink }}
                        keyboardType="number-pad"
                        value={editForm.par}
                        onChangeText={(value) => setEditForm((prev) => ({ ...prev, par: value }))}
                      />
                    </View>
                    <View>
                      <Text className="mb-2" style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>Maximum • Order up to</Text>
                      <TextInput
                        className="border px-4 py-3" style={{ borderColor: color.hairlineStrong, borderRadius: radius.control, color: color.ink }}
                        keyboardType="number-pad"
                        value={editForm.max}
                        onChangeText={(value) => setEditForm((prev) => ({ ...prev, max: value }))}
                      />
                    </View>
                  </View>
                </View>

                <View className="mt-5 p-4 border" style={{ backgroundColor: color.card, borderRadius: radius.card, borderColor: color.hairline }}>
                  <Text className="font-semibold mb-3" style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>REORDER SETTINGS</Text>
                  <Text className="mb-2" style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>Order in</Text>
                  <TouchableOpacity
                    className="border px-4 py-3 flex-row items-center justify-between" style={{ borderColor: color.hairlineStrong, borderRadius: radius.control }}
                    onPress={() => setShowOrderUnitPicker(true)}
                  >
                    <Text style={{ fontSize: ds.fontSize(typeScale.body), fontWeight: weight.semibold, color: color.ink }}>
                      {editForm.order_unit}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={color.ink3} />
                  </TouchableOpacity>

                  <Text className="mt-4 mb-2" style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>Conversion • {editForm.unit_type} per {editForm.order_unit}</Text>
                  <TextInput
                    className="border px-4 py-3" style={{ borderColor: color.hairlineStrong, borderRadius: radius.control, color: color.ink }}
                    keyboardType="number-pad"
                    value={editForm.conversion}
                    onChangeText={(value) => setEditForm((prev) => ({ ...prev, conversion: value }))}
                  />
                  {editForm.conversion ? (
                    <Text className="mt-2" style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink3 }}>
                      {editForm.conversion} {editForm.unit_type} = 1 {editForm.order_unit}
                    </Text>
                  ) : null}
                </View>

                <View className="mt-5 p-4 border" style={{ backgroundColor: color.card, borderRadius: radius.card, borderColor: color.hairline }}>
                  <TouchableOpacity
                    className="py-3"
                    onPress={openMoveModal}
                  >
                    <Text className="font-semibold" style={{ fontSize: ds.fontSize(typeScale.body), color: color.ink }}>Move to Different Area</Text>
                  </TouchableOpacity>
                  <TouchableOpacity className="py-3" onPress={handleDeactivateAreaItem}>
                    <Text className="font-semibold" style={{ fontSize: ds.fontSize(typeScale.body), color: color.alert }}>Deactivate Item</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View className="items-center justify-center py-20">
                <Text style={{ color: color.ink2 }}>No editable settings found.</Text>
              </View>
            )}
          </ScrollView>

          <View className="border-t px-4 py-4" style={{ backgroundColor: color.card, borderColor: color.hairlineStrong }}>
            <TouchableOpacity
              className={`py-4 items-center ${isEditSaving ? 'bg-primary-300' : ''}`} style={{ borderRadius: radius.control, backgroundColor: isEditSaving ? undefined : color.accent }}
              onPress={handleSaveEdit}
              disabled={isEditSaving || !selectedAreaItem}
            >
              <Text className="font-semibold" style={{ color: color.onAccent }}>
                {isEditSaving ? 'Saving...' : 'Save Changes'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </InventoryFormSheet>

      {/* Move Item Modal */}
      <InventoryFormSheet
        visible={showMoveModal}
        onClose={() => setShowMoveModal(false)}
      >
        <SafeAreaView className="flex-1" style={{ backgroundColor: color.page }}>
          <View className="px-4 py-4 border-b flex-row items-center justify-between" style={{ backgroundColor: color.card, borderColor: color.hairlineStrong }}>
            <Text className="font-bold" style={{ fontSize: ds.fontSize(typeScale.title), color: color.ink }}>Move Item</Text>
            <TouchableOpacity onPress={() => setShowMoveModal(false)}>
              <Ionicons name="close" size={20} color={color.ink2} />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
            {editingItem && selectedAreaItem ? (
              <>
                <View className="p-4 border" style={{ backgroundColor: color.card, borderRadius: radius.card, borderColor: color.hairline }}>
                  <View className="flex-row items-center">
                    <Text className="mr-3" style={{ fontSize: ds.fontSize(typeScale.display) }}>
                      {CATEGORY_EMOJI[editingItem.inventory_item.category] ?? '📦'}
                    </Text>
                    <View className="flex-1">
                      <Text className="font-semibold" style={{ fontSize: ds.fontSize(typeScale.body), color: color.ink }}>
                        {editingItem.inventory_item.name}
                      </Text>
                      <Text className="mt-1" style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>
                        Currently in: {selectedAreaItem.area.name}
                      </Text>
                    </View>
                  </View>
                </View>

                <View className="mt-5 p-4 border" style={{ backgroundColor: color.card, borderRadius: radius.card, borderColor: color.hairline }}>
                  <Text className="font-semibold mb-3" style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>MOVE TO</Text>
                  {areaOptions.map((area) => {
                    const isCurrent = area.id === selectedAreaItem.area_id;
                    const isSelected = area.id === moveTargetAreaId;
                    const existing = areaItemsByArea.get(area.id);
                    return (
                      <TouchableOpacity
                        key={area.id}
                        className={`border px-4 py-3 mb-3 ${isCurrent ? 'opacity-50' : ''}`} style={{ borderRadius: radius.control, borderColor: isSelected ? color.accent : color.hairlineStrong, backgroundColor: isSelected ? color.tint : undefined }}
                        onPress={() => handleSelectMoveArea(area.id)}
                        disabled={isCurrent}
                      >
                        <View className="flex-row items-center justify-between">
                          <View className="flex-row items-center">
                            <Ionicons
                              name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                              size={18}
                              color={isCurrent ? color.disabled : color.accent}
                            />
                            <Text className="ml-2" style={{ fontSize: ds.fontSize(typeScale.body), fontWeight: weight.semibold, color: color.ink }}>
                              {area.icon ?? '📦'} {area.name}
                            </Text>
                          </View>
                          {isCurrent ? (
                            <Text style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink3 }}>Current</Text>
                          ) : null}
                        </View>
                        {existing && !isCurrent ? (
                          <View className="flex-row items-center mt-2">
                            <Ionicons name="alert-circle" size={14} color={color.warning} />
                            <Text className="ml-1" style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.warning }}>Item already exists here</Text>
                          </View>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {moveTargetAreaId ? (
                  <View className="mt-5 p-4 border" style={{ backgroundColor: color.card, borderRadius: radius.card, borderColor: color.hairline }}>
                    <Text className="font-semibold mb-3" style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>
                      NEW SETTINGS FOR {moveTargetArea?.name?.toUpperCase() ?? 'AREA'}
                    </Text>

                    <Text className="mb-2" style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>Count Unit</Text>
                    <TouchableOpacity
                      className="border px-4 py-3 flex-row items-center justify-between" style={{ borderColor: color.hairlineStrong, borderRadius: radius.control }}
                      onPress={() => setShowMoveUnitPicker(true)}
                    >
                      <Text style={{ fontSize: ds.fontSize(typeScale.body), fontWeight: weight.semibold, color: color.ink }}>{moveForm.unit_type}</Text>
                      <Ionicons name="chevron-down" size={16} color={color.ink3} />
                    </TouchableOpacity>

                    <View className="mt-4">
                      <Text className="mb-2" style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>Min Quantity</Text>
                      <TextInput
                        className="border px-4 py-3" style={{ borderColor: color.hairlineStrong, borderRadius: radius.control, color: color.ink }}
                        keyboardType="number-pad"
                        value={moveForm.min}
                        onChangeText={(value) => setMoveForm((prev) => ({ ...prev, min: value }))}
                      />
                    </View>
                    <View className="mt-4">
                      <Text className="mb-2" style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>Max Quantity</Text>
                      <TextInput
                        className="border px-4 py-3" style={{ borderColor: color.hairlineStrong, borderRadius: radius.control, color: color.ink }}
                        keyboardType="number-pad"
                        value={moveForm.max}
                        onChangeText={(value) => setMoveForm((prev) => ({ ...prev, max: value }))}
                      />
                    </View>

                    <Text className="mt-3" style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink3 }}>
                      Current quantity will reset to 0 for the new area.
                    </Text>

                    <View className="mt-5">
                      <Text className="font-semibold mb-2" style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>MOVE TYPE</Text>
                      <View className="flex-row">
                        <TouchableOpacity
                          className="flex-1 border py-3 items-center mr-2" style={{ borderRadius: radius.control, borderColor: moveMode === 'replace' ? color.accent : color.hairlineStrong, backgroundColor: moveMode === 'replace' ? color.tint : undefined }}
                          onPress={() => setMoveMode('replace')}
                        >
                          <Text className="font-semibold" style={{ fontSize: ds.fontSize(typeScale.body), color: moveMode === 'replace' ? color.accent : color.ink2 }}>
                            Replace Existing
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          className={`flex-1 border py-3 items-center ${moveTargetExisting ? 'opacity-50' : ''}`} style={{ borderRadius: radius.control, borderColor: moveMode === 'duplicate' ? color.accent : color.hairlineStrong, backgroundColor: moveMode === 'duplicate' ? color.tint : undefined }}
                          onPress={() => setMoveMode('duplicate')}
                          disabled={!!moveTargetExisting}
                        >
                          <Text className="font-semibold" style={{ fontSize: ds.fontSize(typeScale.body), color: moveMode === 'duplicate' ? color.accent : color.ink2 }}>
                            Add Duplicate
                          </Text>
                        </TouchableOpacity>
                      </View>
                      {moveTargetExisting ? (
                        <Text className="mt-2" style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.warning }}>
                          Item already exists here. Replace only.
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ) : null}
              </>
            ) : (
              <View className="items-center justify-center py-20">
                <Text style={{ color: color.ink2 }}>No item selected.</Text>
              </View>
            )}
          </ScrollView>

          <View className="border-t px-4 py-4" style={{ backgroundColor: color.card, borderColor: color.hairlineStrong }}>
            <TouchableOpacity
              className="py-4 items-center" style={{ borderRadius: radius.control, backgroundColor: isMoveSaving || !moveTargetAreaId ? color.tint : color.accent }}
              onPress={handleMoveItem}
              disabled={isMoveSaving || !moveTargetAreaId}
            >
              <Text className="font-semibold" style={{ color: color.onAccent }}>
                {isMoveSaving ? 'Moving...' : 'Move Item'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="mt-3 py-3 items-center border" style={{ borderRadius: radius.control, borderColor: color.hairlineStrong }}
              onPress={() => setShowMoveModal(false)}
            >
              <Text className="font-semibold" style={{ fontSize: ds.fontSize(typeScale.body), color: color.ink2 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </InventoryFormSheet>

      {/* Bulk Move Modal */}
      <InventoryFormSheet
        visible={showBulkMoveModal}
        onClose={() => setShowBulkMoveModal(false)}
      >
        <SafeAreaView className="flex-1" style={{ backgroundColor: color.page }}>
          <View className="px-4 py-4 border-b flex-row items-center justify-between" style={{ backgroundColor: color.card, borderColor: color.hairlineStrong }}>
            <Text className="font-bold" style={{ fontSize: ds.fontSize(typeScale.title), color: color.ink }}>Move Items</Text>
            <TouchableOpacity onPress={() => setShowBulkMoveModal(false)}>
              <Ionicons name="close" size={20} color={color.ink2} />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
            <Text className="font-semibold mb-3" style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>MOVE TO</Text>
            {bulkMoveAreas.length === 0 && (
              <View className="items-center py-6">
                <Text style={{ fontSize: ds.fontSize(typeScale.body), color: color.ink3 }}>No areas available.</Text>
              </View>
            )}
            {bulkMoveAreas.map((area) => (
              <TouchableOpacity
                key={area.id}
                className="border px-4 py-3 mb-3" style={{ borderRadius: radius.control, borderColor: bulkMoveAreaId === area.id ? color.accent : color.hairlineStrong, backgroundColor: bulkMoveAreaId === area.id ? color.tint : undefined }}
                onPress={() => setBulkMoveAreaId(area.id)}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <Ionicons
                      name={bulkMoveAreaId === area.id ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={color.accent}
                    />
                    <Text className="ml-2" style={{ fontSize: ds.fontSize(typeScale.body), fontWeight: weight.semibold, color: color.ink }}>
                      {area.icon ?? '📦'} {area.name}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}

            <View className="mt-4 p-4 border" style={{ backgroundColor: color.card, borderRadius: radius.card, borderColor: color.hairline }}>
              <Text className="font-semibold mb-3" style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>NEW SETTINGS</Text>
              <Text className="mb-2" style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>Count Unit</Text>
              <TouchableOpacity
                className="border px-4 py-3 flex-row items-center justify-between" style={{ borderColor: color.hairlineStrong, borderRadius: radius.control }}
                onPress={() => {
                  setAddUnitPickerTarget({ areaId: 'bulk', field: 'unit' });
                  setShowAddUnitPicker(true);
                }}
              >
                <Text style={{ fontSize: ds.fontSize(typeScale.body), color: color.ink }}>{bulkMoveSettings.unit_type}</Text>
                <Ionicons name="chevron-down" size={16} color={color.ink3} />
              </TouchableOpacity>

              <View className="flex-row gap-3 mt-4">
                <View className="flex-1">
                  <Text className="mb-2" style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>Min</Text>
                  <TextInput
                    className="border px-3 py-2" style={{ borderColor: color.hairlineStrong, borderRadius: radius.control, color: color.ink }}
                    keyboardType="number-pad"
                    value={bulkMoveSettings.min}
                    onChangeText={(value) => setBulkMoveSettings((prev) => ({ ...prev, min: value }))}
                  />
                </View>
                <View className="flex-1">
                  <Text className="mb-2" style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>Max</Text>
                  <TextInput
                    className="border px-3 py-2" style={{ borderColor: color.hairlineStrong, borderRadius: radius.control, color: color.ink }}
                    keyboardType="number-pad"
                    value={bulkMoveSettings.max}
                    onChangeText={(value) => setBulkMoveSettings((prev) => ({ ...prev, max: value }))}
                  />
                </View>
              </View>
            </View>
          </ScrollView>

          <View className="border-t px-4 py-4" style={{ backgroundColor: color.card, borderColor: color.hairlineStrong }}>
            <TouchableOpacity
              className="py-4 items-center" style={{ borderRadius: radius.control, backgroundColor: isBulkSaving || !bulkMoveAreaId ? color.tint : color.accent }}
              onPress={handleBulkMoveItems}
              disabled={isBulkSaving || !bulkMoveAreaId}
            >
              <Text className="font-semibold" style={{ color: color.onAccent }}>
                {isBulkSaving ? 'Moving...' : 'Move Items'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="mt-3 py-3 items-center border" style={{ borderRadius: radius.control, borderColor: color.hairlineStrong }}
              onPress={() => setShowBulkMoveModal(false)}
            >
              <Text className="font-semibold" style={{ fontSize: ds.fontSize(typeScale.body), color: color.ink2 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </InventoryFormSheet>

      {/* Count Unit Picker */}
      <Sheet
        visible={showCountUnitPicker}
        title="Select Counting Unit"
        onClose={() => setShowCountUnitPicker(false)}
      >
        {COUNT_UNITS.map((unit) => (
          <TouchableOpacity
            key={unit}
            className="py-3"
            onPress={() => handleChangeUnitType(unit)}
          >
            <Text style={{ fontSize: ds.fontSize(typeScale.body), color: color.ink2 }}>{unit}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity className="py-3 items-center" onPress={() => setShowCountUnitPicker(false)}>
          <Text className="font-semibold" style={{ fontSize: ds.fontSize(typeScale.body), color: color.accent }}>Cancel</Text>
        </TouchableOpacity>
      </Sheet>

      {/* Order Unit Picker */}
      <Sheet
        visible={showOrderUnitPicker}
        title="Select Order Unit"
        onClose={() => setShowOrderUnitPicker(false)}
      >
        {ORDER_UNITS.map((unit) => (
          <TouchableOpacity
            key={unit}
            className="py-3"
            onPress={() => {
              setEditForm((prev) => ({ ...prev, order_unit: unit }));
              setShowOrderUnitPicker(false);
            }}
          >
            <Text style={{ fontSize: ds.fontSize(typeScale.body), color: color.ink2 }}>{unit}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity className="py-3 items-center" onPress={() => setShowOrderUnitPicker(false)}>
          <Text className="font-semibold" style={{ fontSize: ds.fontSize(typeScale.body), color: color.accent }}>Cancel</Text>
        </TouchableOpacity>
      </Sheet>

      {/* Move Unit Picker */}
      <Sheet
        visible={showMoveUnitPicker}
        title="Select Count Unit"
        onClose={() => setShowMoveUnitPicker(false)}
      >
        {COUNT_UNITS.map((unit) => (
          <TouchableOpacity
            key={unit}
            className="py-3"
            onPress={() => {
              setMoveForm((prev) => ({ ...prev, unit_type: unit }));
              setShowMoveUnitPicker(false);
            }}
          >
            <Text style={{ fontSize: ds.fontSize(typeScale.body), color: color.ink2 }}>{unit}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity className="py-3 items-center" onPress={() => setShowMoveUnitPicker(false)}>
          <Text className="font-semibold" style={{ fontSize: ds.fontSize(typeScale.body), color: color.accent }}>Cancel</Text>
        </TouchableOpacity>
      </Sheet>

      {/* Add Item Modal */}
      <InventoryFormSheet
        visible={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setAddStep('select');
        }}
      >
        <SafeAreaView className="flex-1" style={{ backgroundColor: color.page }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1"
          >
            <View className="px-4 py-4 border-b flex-row items-center justify-between" style={{ backgroundColor: color.card, borderColor: color.hairlineStrong }}>
              <TouchableOpacity
                onPress={() => {
                  if (addStep === 'select') {
                    setShowAddModal(false);
                  } else if (addStep === 'assign' && selectedAddItem) {
                    setAddStep('select');
                  } else if (addStep === 'assign') {
                    setAddStep('create');
                  } else {
                    setAddStep('select');
                  }
                }}
              >
                <Text style={{ color: color.accent, fontWeight: weight.semibold }}>{addStep === 'select' ? 'Cancel' : 'Back'}</Text>
              </TouchableOpacity>
              <Text className="font-bold" style={{ fontSize: ds.fontSize(typeScale.title), color: color.ink }}>
                {addStep === 'select' ? 'Add Item' : addStep === 'create' ? 'New Item' : 'Add to Areas'}
              </Text>
              <View style={{ width: 50 }} />
            </View>

            <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
              {addStep === 'select' && (
                <>
                  <View className="border px-4 py-3 flex-row items-center" style={{ backgroundColor: color.card, borderColor: color.hairlineStrong, borderRadius: radius.control }}>
                    <Ionicons name="search-outline" size={18} color={color.ink3} />
                    <TextInput
                      className="flex-1 ml-2" style={{ color: color.ink }}
                      placeholder="Search existing items..."
                      placeholderTextColor={color.ink3}
                      value={addSearchQuery}
                      onChangeText={setAddSearchQuery}
                    />
                  </View>

                  <Text className="font-semibold mt-5 mb-3" style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>EXISTING ITEMS</Text>
                  {isAddSearching && (
                    <Text className="mb-2" style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink3 }}>Searching...</Text>
                  )}
                  {addSearchResults.map((result) => (
                    <TouchableOpacity
                      key={result.item.id}
                      className="border p-4 mb-3" style={{ backgroundColor: color.card, borderColor: color.hairline, borderRadius: radius.control }}
                      onPress={() => handleSelectExistingItem(result.item)}
                    >
                      <View className="flex-row items-center">
                        <Text className="mr-2" style={{ fontSize: ds.fontSize(typeScale.title) }}>{CATEGORY_EMOJI[result.item.category] ?? '📦'}</Text>
                        <View className="flex-1">
                          <Text className="font-semibold" style={{ fontSize: ds.fontSize(typeScale.body), color: color.ink }}>{result.item.name}</Text>
                          <Text className="mt-1" style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>
                            {getCategoryLabel(result.item.category)} • In {result.areaCount} area
                            {result.areaCount !== 1 ? 's' : ''}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={color.ink3} />
                      </View>
                    </TouchableOpacity>
                  ))}
                  {addSearchQuery.trim().length > 0 && !isAddSearching && addSearchResults.length === 0 && (
                    <View className="items-center py-6">
                      <Text style={{ fontSize: ds.fontSize(typeScale.body), color: color.ink3 }}>No items found.</Text>
                    </View>
                  )}

                  <TouchableOpacity
                    className="border border-dashed p-4 mt-3 items-center" style={{ backgroundColor: color.card, borderColor: color.hairlineStrong, borderRadius: radius.control }}
                    onPress={handleStartCreateItem}
                  >
                    <Text className="font-semibold" style={{ fontSize: ds.fontSize(typeScale.body), color: color.accent }}>+ Create New Item</Text>
                  </TouchableOpacity>
                </>
              )}

              {addStep === 'create' && (
                <>
                  <View className="mb-4">
                    <Text className="mb-2" style={{ fontSize: ds.fontSize(typeScale.body), fontWeight: weight.semibold, color: color.ink2 }}>Item Name *</Text>
                    <TextInput
                      className="border px-4 py-3" style={{ backgroundColor: color.card, borderColor: color.hairlineStrong, borderRadius: radius.control, color: color.ink }}
                      placeholder="e.g., Dragon Fruit"
                      placeholderTextColor={color.ink3}
                      value={form.name}
                      onChangeText={(text) => setForm({ ...form, name: text })}
                    />
                  </View>

                  <View className="mb-4">
                    <Text className="mb-2" style={{ fontSize: ds.fontSize(typeScale.body), fontWeight: weight.semibold, color: color.ink2 }}>Category *</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {categories.map((cat) => {
                        const isSelected = form.category === cat;
                        return (
                          <TouchableOpacity
                            key={cat}
                            className="px-3 py-2"
                            style={{ borderRadius: radius.control, backgroundColor: isSelected ? color.ink : color.well }}
                            onPress={() => setForm({ ...form, category: cat })}
                          >
                            <Text style={{ fontSize: ds.fontSize(typeScale.body), fontWeight: weight.semibold, color: isSelected ? color.onAccent : color.ink2 }}>
                              {getCategoryLabel(cat)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  <View className="mb-4">
                    <Text className="mb-2" style={{ fontSize: ds.fontSize(typeScale.body), fontWeight: weight.semibold, color: color.ink2 }}>Supplier</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {supplierCategories.map((sup) => {
                        const isSelected = form.supplier_category === sup;
                        return (
                          <TouchableOpacity
                            key={sup}
                            className="px-3 py-2" style={{ borderRadius: radius.control, backgroundColor: isSelected ? color.accent : color.well }}
                            onPress={() => setForm({ ...form, supplier_category: sup })}
                          >
                            <Text style={{ fontSize: ds.fontSize(typeScale.body), fontWeight: weight.semibold, color: isSelected ? color.onAccent : color.ink2 }}>
                              {getSupplierCategoryLabel(sup)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  <View className="mb-6">
                    <Text className="mb-2" style={{ fontSize: ds.fontSize(typeScale.body), fontWeight: weight.semibold, color: color.ink2 }}>Emoji</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {ADD_EMOJIS.map((emoji) => (
                        <TouchableOpacity
                          key={emoji}
                          className={`h-10 w-10 items-center justify-center ${newItemEmoji === emoji ? 'border' : ''}`} style={{ borderRadius: radius.control, backgroundColor: newItemEmoji === emoji ? color.tint : color.well, borderColor: newItemEmoji === emoji ? color.accent : undefined }}
                          onPress={() => setNewItemEmoji(emoji)}
                        >
                          <Text style={{ fontSize: ds.fontSize(typeScale.title) }}>{emoji}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </>
              )}

              {addStep === 'assign' && (
                <>
                  <View className="p-4 border mb-4" style={{ backgroundColor: color.card, borderRadius: radius.card, borderColor: color.hairline }}>
                    <View className="flex-row items-center">
                      <Text className="mr-3" style={{ fontSize: ds.fontSize(typeScale.display) }}>
                        {selectedAddItem
                          ? CATEGORY_EMOJI[selectedAddItem.category] ?? '📦'
                          : newItemEmoji || CATEGORY_EMOJI[form.category] || '📦'}
                      </Text>
                      <View className="flex-1">
                        <Text className="font-semibold" style={{ fontSize: ds.fontSize(typeScale.body), color: color.ink }}>
                          {selectedAddItem ? selectedAddItem.name : form.name}
                        </Text>
                        <Text className="mt-1" style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>
                          {selectedAddItem ? getCategoryLabel(selectedAddItem.category) : getCategoryLabel(form.category)}
                        </Text>
                        {addLocationId && (
                          <Text className="mt-1" style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink3 }}>
                            Location: {locations.find((loc) => loc.id === addLocationId)?.name ?? 'Selected location'}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>

                  <Text className="font-semibold mb-3" style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>SELECT STORAGE AREAS</Text>
                  {addAreaOptions.length === 0 && (
                    <View className="items-center py-8">
                      <Text style={{ fontSize: ds.fontSize(typeScale.body), color: color.ink3 }}>No storage areas found for this location.</Text>
                    </View>
                  )}
                  {addAreaOptions.map((area) => {
                    const settings = addAreaSelections[area.id];
                    const selected = settings?.selected;
                    const alreadyExists = addExistingAreaIds.includes(area.id);
                    return (
                      <View key={area.id} className="border p-4 mb-3" style={{ backgroundColor: color.card, borderColor: color.hairline, borderRadius: radius.card }}>
                        <TouchableOpacity
                          className="flex-row items-center justify-between"
                          onPress={() => toggleAddAreaSelection(area.id)}
                          disabled={alreadyExists}
                        >
                          <View className="flex-row items-center">
                            <Ionicons
                              name={selected ? 'checkbox' : 'square-outline'}
                              size={18}
                              color={alreadyExists ? color.disabled : selected ? color.accent : color.ink3}
                            />
                            <Text className="font-semibold ml-2" style={{ fontSize: ds.fontSize(typeScale.body), color: color.ink }}>
                              {area.icon ?? '📦'} {area.name}
                            </Text>
                          </View>
                          {alreadyExists ? (
                            <Text style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.warning }}>Already added</Text>
                          ) : null}
                        </TouchableOpacity>

                        {selected && !alreadyExists && (
                          <View className="mt-4">
                            <Text className="mb-2" style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>Count in</Text>
                            <TouchableOpacity
                              className="border px-3 py-2 flex-row items-center justify-between" style={{ borderColor: color.hairlineStrong, borderRadius: radius.control }}
                              onPress={() => {
                                setAddUnitPickerTarget({ areaId: area.id, field: 'unit' });
                                setShowAddUnitPicker(true);
                              }}
                            >
                              <Text style={{ fontSize: ds.fontSize(typeScale.body), color: color.ink }}>{settings?.unit_type}</Text>
                              <Ionicons name="chevron-down" size={16} color={color.ink3} />
                            </TouchableOpacity>

                            <View className="flex-row gap-3 mt-3">
                              <View className="flex-1">
                                <Text className="mb-2" style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>Min</Text>
                                <TextInput
                                  className="border px-3 py-2" style={{ borderColor: color.hairlineStrong, borderRadius: radius.control, color: color.ink }}
                                  keyboardType="number-pad"
                                  value={settings?.min}
                                  onChangeText={(value) =>
                                    setAddAreaSelections((prev) => ({
                                      ...prev,
                                      [area.id]: { ...prev[area.id], min: value },
                                    }))
                                  }
                                />
                              </View>
                              <View className="flex-1">
                                <Text className="mb-2" style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>Max</Text>
                                <TextInput
                                  className="border px-3 py-2" style={{ borderColor: color.hairlineStrong, borderRadius: radius.control, color: color.ink }}
                                  keyboardType="number-pad"
                                  value={settings?.max}
                                  onChangeText={(value) =>
                                    setAddAreaSelections((prev) => ({
                                      ...prev,
                                      [area.id]: { ...prev[area.id], max: value },
                                    }))
                                  }
                                />
                              </View>
                            </View>

                            <View className="flex-row items-center gap-3 mt-3">
                              <View className="flex-1">
                                <Text className="mb-2" style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>Order in</Text>
                                <TouchableOpacity
                                  className="border px-3 py-2 flex-row items-center justify-between" style={{ borderColor: color.hairlineStrong, borderRadius: radius.control }}
                                  onPress={() => {
                                    setAddUnitPickerTarget({ areaId: area.id, field: 'order' });
                                    setShowAddUnitPicker(true);
                                  }}
                                >
                                  <Text style={{ fontSize: ds.fontSize(typeScale.body), color: color.ink }}>{settings?.order_unit}</Text>
                                  <Ionicons name="chevron-down" size={16} color={color.ink3} />
                                </TouchableOpacity>
                              </View>
                              <View className="flex-1">
                                <Text className="mb-2" style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>Conversion</Text>
                                <TextInput
                                  className="border px-3 py-2" style={{ borderColor: color.hairlineStrong, borderRadius: radius.control, color: color.ink }}
                                  keyboardType="number-pad"
                                  value={settings?.conversion}
                                  onChangeText={(value) =>
                                    setAddAreaSelections((prev) => ({
                                      ...prev,
                                      [area.id]: { ...prev[area.id], conversion: value },
                                    }))
                                  }
                                />
                              </View>
                            </View>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </>
              )}
            </ScrollView>

            <View className="border-t px-4 py-4" style={{ backgroundColor: color.card, borderColor: color.hairlineStrong }}>
              {addStep === 'create' && (
                <TouchableOpacity
                  className="py-4 items-center" style={{ borderRadius: radius.control, backgroundColor: color.accent }}
                  onPress={handleContinueToAreas}
                >
                  <Text className="font-bold" style={{ color: color.onAccent, fontSize: ds.fontSize(typeScale.title) }}>Continue →</Text>
                </TouchableOpacity>
              )}
              {addStep === 'assign' && (
                <TouchableOpacity
                  className={`py-4 items-center ${isSubmitting ? 'bg-primary-300' : ''}`} style={{ borderRadius: radius.control, backgroundColor: isSubmitting ? undefined : color.accent }}
                  onPress={handleAddItemFlow}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loading size="inline" color={color.onAccent} label="Adding item" />
                  ) : (
                    <Text className="font-bold" style={{ color: color.onAccent, fontSize: ds.fontSize(typeScale.title) }}>Add Item</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </InventoryFormSheet>

      {/* Add Item Unit Picker */}
      <Sheet
        visible={showAddUnitPicker}
        title={addUnitPickerTarget?.field === 'order' ? 'Select Order Unit' : 'Select Count Unit'}
        onClose={() => setShowAddUnitPicker(false)}
      >
        {(addUnitPickerTarget?.field === 'order' ? ORDER_UNITS : COUNT_UNITS).map((unit) => (
          <TouchableOpacity
            key={unit}
            className="py-3"
            onPress={() => {
              if (!addUnitPickerTarget) return;
              if (addUnitPickerTarget.areaId === 'bulk') {
                setBulkMoveSettings((prev) => ({
                  ...prev,
                  unit_type: unit,
                }));
              } else {
                setAddAreaSelections((prev) => ({
                  ...prev,
                  [addUnitPickerTarget.areaId]: {
                    ...(prev[addUnitPickerTarget.areaId] || {
                      selected: true,
                      unit_type: 'each',
                      min: '',
                      max: '',
                      order_unit: 'case',
                      conversion: '',
                    }),
                    [addUnitPickerTarget.field === 'order' ? 'order_unit' : 'unit_type']: unit,
                  },
                }));
              }
              setShowAddUnitPicker(false);
            }}
          >
            <Text style={{ fontSize: ds.fontSize(typeScale.body), color: color.ink2 }}>{unit}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity className="py-3 items-center" onPress={() => setShowAddUnitPicker(false)}>
          <Text className="font-semibold" style={{ fontSize: ds.fontSize(typeScale.body), color: color.accent }}>Cancel</Text>
        </TouchableOpacity>
      </Sheet>

      {/* Bulk Add Modal */}
      <InventoryFormSheet
        visible={showBulkAddModal}
        onClose={() => setShowBulkAddModal(false)}
      >
        <SafeAreaView className="flex-1" style={{ backgroundColor: color.page }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1"
          >
            <View className="px-4 py-4 border-b flex-row items-center justify-between" style={{ backgroundColor: color.card, borderColor: color.hairlineStrong }}>
              <TouchableOpacity onPress={() => setShowBulkAddModal(false)}>
                <Text style={{ color: color.accent, fontWeight: weight.semibold }}>Cancel</Text>
              </TouchableOpacity>
              <Text className="font-bold" style={{ fontSize: ds.fontSize(typeScale.title), color: color.ink }}>Bulk Add Items</Text>
              <View style={{ width: 50 }} />
            </View>

            <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
              <View className="p-4 mb-4 border" style={{ backgroundColor: color.tint, borderRadius: radius.control, borderColor: color.tint }}>
                <View className="flex-row items-start">
                  <Ionicons name="information-circle" size={20} color={color.ink2} />
                  <View className="flex-1 ml-2">
                    <Text style={{ color: color.accent, fontWeight: weight.semibold }}>How to use</Text>
                    <Text className="mt-1" style={{ color: color.accent, fontSize: ds.fontSize(typeScale.body) }}>
                      Enter one item name per line. All items will share the same category, supplier, and units.
                    </Text>
                  </View>
                </View>
              </View>

              <View className="mb-4">
                <Text className="mb-2" style={{ fontSize: ds.fontSize(typeScale.body), fontWeight: weight.semibold, color: color.ink2 }}>Item Names (one per line) *</Text>
                <TextInput
                  className="border px-4 py-3"
                  placeholder={"Salmon\nTuna\nYellowtail\nMackerel"}
                  placeholderTextColor={color.ink3}
                  value={bulkInput}
                  onChangeText={setBulkInput}
                  multiline
                  numberOfLines={8}
                  style={{ backgroundColor: color.card, borderColor: color.hairlineStrong, borderRadius: radius.control, color: color.ink, height: 160, textAlignVertical: 'top' }}
                />
                {bulkItemCount > 0 && (
                  <Text className="mt-2" style={{ fontSize: ds.fontSize(typeScale.body), color: color.accent }}>
                    {bulkItemCount} item{bulkItemCount !== 1 ? 's' : ''} to add
                  </Text>
                )}
              </View>

              <Text className="font-bold uppercase tracking-wide mb-3" style={{ fontSize: ds.fontSize(typeScale.body), color: color.ink2 }}>Shared Settings</Text>

              <View className="mb-4">
                <Text className="mb-2" style={{ fontSize: ds.fontSize(typeScale.body), fontWeight: weight.semibold, color: color.ink2 }}>Category</Text>
                <View className="flex-row flex-wrap gap-2">
                  {categories.map((cat) => {
                    const isSelected = bulkCategory === cat;
                    return (
                      <TouchableOpacity
                        key={cat}
                        className="px-3 py-2"
                        style={{ borderRadius: radius.control, backgroundColor: isSelected ? color.ink : color.well }}
                        onPress={() => setBulkCategory(cat)}
                      >
                        <Text style={{ fontSize: ds.fontSize(typeScale.body), fontWeight: weight.semibold, color: isSelected ? color.onAccent : color.ink2 }}>
                          {getCategoryLabel(cat)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View className="mb-4">
                <Text className="mb-2" style={{ fontSize: ds.fontSize(typeScale.body), fontWeight: weight.semibold, color: color.ink2 }}>Supplier</Text>
                <View className="flex-row flex-wrap gap-2">
                  {supplierCategories.map((sup) => {
                    const isSelected = bulkSupplier === sup;
                    return (
                      <TouchableOpacity
                        key={sup}
                        className="px-3 py-2" style={{ borderRadius: radius.control, backgroundColor: isSelected ? color.accent : color.well }}
                        onPress={() => setBulkSupplier(sup)}
                      >
                        <Text style={{ fontSize: ds.fontSize(typeScale.body), fontWeight: weight.semibold, color: isSelected ? color.onAccent : color.ink2 }}>
                          {getSupplierCategoryLabel(sup)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View className="flex-row gap-3 mb-4">
                <View className="flex-1">
                  <Text className="mb-2" style={{ fontSize: ds.fontSize(typeScale.body), fontWeight: weight.semibold, color: color.ink2 }}>Base Unit</Text>
                  <TextInput
                    className="border px-4 py-3" style={{ backgroundColor: color.card, borderColor: color.hairlineStrong, borderRadius: radius.control, color: color.ink }}
                    placeholder="e.g., lb"
                    placeholderTextColor={color.ink3}
                    value={bulkBaseUnit}
                    onChangeText={setBulkBaseUnit}
                  />
                </View>
                <View className="flex-1">
                  <Text className="mb-2" style={{ fontSize: ds.fontSize(typeScale.body), fontWeight: weight.semibold, color: color.ink2 }}>Pack Unit</Text>
                  <TextInput
                    className="border px-4 py-3" style={{ backgroundColor: color.card, borderColor: color.hairlineStrong, borderRadius: radius.control, color: color.ink }}
                    placeholder="e.g., case"
                    placeholderTextColor={color.ink3}
                    value={bulkPackUnit}
                    onChangeText={setBulkPackUnit}
                  />
                </View>
              </View>

              <View className="mb-6">
                <Text className="mb-2" style={{ fontSize: ds.fontSize(typeScale.body), fontWeight: weight.semibold, color: color.ink2 }}>Pack Size</Text>
                <TextInput
                  className="border px-4 py-3" style={{ backgroundColor: color.card, borderColor: color.hairlineStrong, borderRadius: radius.control, color: color.ink }}
                  placeholder="10"
                  placeholderTextColor={color.ink3}
                  value={bulkPackSize}
                  onChangeText={setBulkPackSize}
                  keyboardType="number-pad"
                />
              </View>
            </ScrollView>

            <View className="border-t px-4 py-4" style={{ backgroundColor: color.card, borderColor: color.hairlineStrong }}>
              <TouchableOpacity
                className={`py-4 items-center flex-row justify-center ${isSubmitting ? 'bg-primary-300' : ''}`} style={{ borderRadius: radius.control, backgroundColor: isSubmitting ? undefined : color.accent }}
                onPress={handleBulkAdd}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loading size="inline" color={color.onAccent} label="Adding items" />
                ) : (
                  <>
                    <Ionicons name="add-circle" size={20} color="white" />
                    <Text className="font-bold ml-2" style={{ color: color.onAccent, fontSize: ds.fontSize(typeScale.title) }}>Add Items</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </InventoryFormSheet>
    </SafeAreaView>
  );
}
