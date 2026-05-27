export function formatLabel(value: string): string {
  return value.replace(/_/g, ' ');
}

export function titleCase(value: string): string {
  const clean = formatLabel(value).trim();
  if (!clean) return value;
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}
