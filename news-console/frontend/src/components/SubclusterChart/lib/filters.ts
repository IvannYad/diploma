import type { DimensionFilter, OlapArticle } from '../../../types/news';
import type { FilterState } from './types';

export function articlePassesFilters(
  art: OlapArticle,
  filters: DimensionFilter[],
  filterState: FilterState,
): boolean {
  for (const f of filters) {
    const selected = filterState[f.dimension_name];
    if (!selected || selected.size === 0) continue;
    const hasMatch = art.records.some((rec) => {
      const val = rec[f.dimension_name];
      return val !== null && val !== undefined && selected.has(String(val));
    });
    if (!hasMatch) return false;
  }
  return true;
}
