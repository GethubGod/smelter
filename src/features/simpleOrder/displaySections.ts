import { KNOWN_ITEM_CATEGORIES } from '@/types';
import { getCategoryLabel } from '@/constants';
import type { SelectionLine, SelectionState } from './checklistSelection';

/**
 * Pure row/section derivation for the restructured checklist list:
 * - "Show categories" ON  → every line grouped under its inventory category.
 * - "Show categories" OFF → one flat list.
 * No React imports; unit-tested in src/__tests__/simpleOrderRestructure.test.ts.
 */

export interface DisplaySection {
  key: string;
  title: string;
  data: SelectionLine[];
  selectedCount: number;
  totalCount: number;
}

const OTHER_CATEGORY_KEY = '__other__';
const KNOWN_CATEGORY_KEYS = new Set<string>(KNOWN_ITEM_CATEGORIES);

function categoryOrderIndex(categoryKey: string): number {
  const index = (KNOWN_ITEM_CATEGORIES as readonly string[]).indexOf(categoryKey);
  return index === -1 ? KNOWN_ITEM_CATEGORIES.length : index;
}

export interface DeriveDisplaySectionsOptions {
  showCategories: boolean;
  /** Inventory category key for a line's item id; null/unknown → "Other". */
  categoryForItemId: (itemId: string | null) => string | null;
}

export function deriveDisplaySections(
  state: SelectionState,
  options: DeriveDisplaySectionsOptions,
): DisplaySection[] {
  if (!options.showCategories) {
    return [{
      key: 'all',
      title: 'All items',
      data: state.lines,
      selectedCount: state.lines.filter((line) => line.checked).length,
      totalCount: state.lines.length,
    }];
  }

  const groups = new Map<string, SelectionLine[]>();
  for (const line of state.lines) {
    const rawCategory = options.categoryForItemId(line.itemId)?.trim() ?? '';
    const key = KNOWN_CATEGORY_KEYS.has(rawCategory)
      ? rawCategory
      : OTHER_CATEGORY_KEY;
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(line);
    } else {
      groups.set(key, [line]);
    }
  }

  const orderedKeys = Array.from(groups.keys()).sort((left, right) => {
    if (left === OTHER_CATEGORY_KEY) return 1;
    if (right === OTHER_CATEGORY_KEY) return -1;
    return categoryOrderIndex(left) - categoryOrderIndex(right);
  });

  return orderedKeys.map((key) => {
    const data = groups.get(key) ?? [];
    return {
      key: `category:${key}`,
      title: key === OTHER_CATEGORY_KEY ? 'Other' : getCategoryLabel(key),
      data,
      selectedCount: data.filter((line) => line.checked).length,
      totalCount: data.length,
    };
  });
}
