import type { DimensionFilter, OlapArticle } from '../../../types/news';
import type { ChartPoint, FilterState } from './types';
import { normalizeDate, normalizeTemporalValue, formatDate } from './dates';
import { aggregateRecords } from './aggregate';
import type { AggMethod } from './types';

export function buildChartPoints(
  articles: OlapArticle[],
  factName: string,
  aggMethod: AggMethod,
  colorField: string | null,
): ChartPoint[] {
  return articles
    .map((art) => {
      const factValue = aggregateRecords(art.records, factName, aggMethod);
      if (factValue === null) return null;

      const point: ChartPoint = {
        _date: normalizeDate(art.date ?? ''),
        _displayDate: formatDate(normalizeDate(art.date ?? '')),
        _articleId: art.article_id,
        _title: art.title ?? art.article_id,
        [factName]: factValue,
      };

      if (colorField && art.records.length > 0) {
        point[colorField] = String(art.records[0][colorField] ?? '');
      }

      return point;
    })
    .filter((p): p is ChartPoint => p !== null)
    .sort((a, b) => a._date.localeCompare(b._date));
}

export function buildChartPointsFromRecords(
  articles: OlapArticle[],
  factName: string,
  xField: string,
  colorField: string | null,
  filters: DimensionFilter[],
  filterState: FilterState,
): ChartPoint[] {
  const points: ChartPoint[] = [];

  for (const art of articles) {
    const artIso = normalizeDate(art.date ?? '');
    const fallbackYear = artIso.slice(0, 4) || String(new Date().getFullYear());

    for (const rec of art.records) {
      const passes = filters.every((f) => {
        const selected = filterState[f.dimension_name];
        if (!selected || selected.size === 0) return true;
        const val = rec[f.dimension_name];
        return val !== null && val !== undefined && selected.has(String(val));
      });
      if (!passes) continue;

      const raw = rec[factName];
      const factValue = typeof raw === 'number' ? raw : raw !== null && raw !== undefined ? parseFloat(String(raw)) : NaN;
      if (isNaN(factValue)) continue;

      // Records without a table date column still need a point on the timeline.
      const xRaw = rec[xField];
      const xDate = (xRaw !== null && xRaw !== undefined)
        ? normalizeTemporalValue(String(xRaw), fallbackYear)
        : artIso;
      if (!xDate) continue;

      const point: ChartPoint = {
        _date: xDate,
        _displayDate: formatDate(xDate),
        _articleId: art.article_id,
        _title: art.title ?? art.article_id,
        [factName]: factValue,
      };

      if (colorField) {
        const cv = rec[colorField];
        if (cv !== null && cv !== undefined) point[colorField] = String(cv);
      }

      points.push(point);
    }
  }

  return points.sort((a, b) => a._date.localeCompare(b._date));
}
