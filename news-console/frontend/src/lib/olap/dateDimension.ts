export function isAutoDateDimensionName(name: string): boolean {
  const normalized = String(name || '').trim().toLowerCase();
  return normalized === 'date' || normalized.includes('date') || normalized.includes('дата');
}

export function findAutoDateDimensionName(dimensions: Array<{ name: string }>): string | null {
  const found = dimensions.find((dimension) => isAutoDateDimensionName(dimension.name));
  return found?.name ?? null;
}
