import type { AggMethod } from './types';

const CHART_TYPE_LABELS: Record<string, string> = {
  bar: 'стовпчастий',
  line: 'лінійний',
  area: 'площинний',
};

const AGG_METHOD_LABELS: Record<AggMethod, string> = {
  avg: 'середнє',
  sum: 'сума',
  min: 'мінімум',
  max: 'максимум',
  last: 'останнє значення',
  first: 'перше значення',
  count: 'кількість',
  median: 'медіана',
};

export function chartTypeLabel(type: string): string {
  return CHART_TYPE_LABELS[type] ?? type;
}

export function aggMethodLabel(method: AggMethod): string {
  return AGG_METHOD_LABELS[method] ?? method;
}
