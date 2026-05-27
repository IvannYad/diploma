export type AggMethod = 'avg' | 'sum' | 'min' | 'max' | 'last' | 'first' | 'count' | 'median';

export interface ChartPoint {
  _date: string;
  _displayDate: string;
  _articleId: string;
  _title: string;
  [key: string]: string | number | null;
}

export type FilterState = Record<string, Set<string>>;
