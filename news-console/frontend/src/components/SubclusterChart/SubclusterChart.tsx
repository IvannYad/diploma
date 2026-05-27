import './SubclusterChart.scss';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  LineChart,
  BarChart,
  AreaChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { fetchChartConfig, fetchChartData, fetchFindSubcluster } from '../../api/charts';
import type { ChartConfig, DimensionFilter, OlapArticle, OlapRecord } from '../../types/news';
import { SERIES_COLORS } from './lib/constants';
import { aggregateRecords } from './lib/aggregate';
import { normalizeDate } from './lib/dates';
import { buildChartPoints, buildChartPointsFromRecords } from './lib/buildPoints';
import { articlePassesFilters } from './lib/filters';
import type { AggMethod, ChartPoint, FilterState } from './lib/types';
import ChartTooltip from './components/ChartTooltip';
import { exportChartFromPlotArea } from './lib/chartExport';
import { aggMethodLabel, chartTypeLabel } from './lib/labels';
interface Props {
  cluster: string;
  scId: string;
  currentArticleId: string;
  currentArticleDate?: string;
  onArticleClick: (articleId: string) => void;
  initialFact?: string;
  initialFilters?: Record<string, string[]>;
  onStateChange?: (fact: string, filters: Record<string, Set<string>>) => void;
}

export default function SubclusterChart({ cluster, scId, currentArticleId, currentArticleDate, onArticleClick, initialFact, initialFilters, onStateChange }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<ChartConfig | null>(null);
  const [rawData, setRawData] = useState<OlapArticle[]>([]);
  const [selectedFact, setSelectedFact] = useState<string>('');
  const [filterState, setFilterState] = useState<FilterState>({});
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'png' | 'pdf' | null>(null);

  useEffect(() => {
    if (!cluster) return;
    setLoading(true);
    setError(null);

    const resolveScId = scId
      ? Promise.resolve(scId)
      : fetchFindSubcluster(cluster, currentArticleId);

    resolveScId
      .then((resolvedScId) => {
        if (!resolvedScId) {
          setError('no_subcluster');
          setLoading(false);
          return;
        }
        return Promise.all([
          fetchChartConfig(cluster, resolvedScId),
          fetchChartData(cluster, resolvedScId),
        ]).then(([configFile, dataFile]) => {
          const cfg = configFile.chart;
          setConfig(cfg);

          // Trim record payloads to fields the chart config actually reads.
          const relevantFields = new Set<string>([
            cfg.axes?.x?.field ?? 'date',
            ...(cfg.color_encoding?.enabled && cfg.color_encoding?.field ? [cfg.color_encoding.field] : []),
            ...(cfg.fact_selector?.available_facts?.map((f) => f.name) ?? []),
            ...(cfg.dimension_filters?.map((f) => f.dimension_name) ?? []),
          ]);
          const trimmedArticles = (dataFile.articles ?? []).map((art) => ({
            ...art,
            records: art.records.map((rec) => {
              const slim: OlapRecord = {};
              for (const field of relevantFields) {
                if (Object.prototype.hasOwnProperty.call(rec, field)) slim[field] = rec[field];
              }
              return slim;
            }),
          }));
          setRawData(trimmedArticles);
          const availableFactNames = new Set(cfg.fact_selector?.available_facts?.map((f) => f.name) ?? []);
          const fallbackSeriesFact = String((cfg as unknown as { series?: Array<{ key?: string }> })?.series?.[0]?.key ?? '');
          const defaultFact = cfg.fact_selector?.default_fact ?? cfg.fact_selector?.available_facts?.[0]?.name ?? fallbackSeriesFact;
          setSelectedFact(initialFact && availableFactNames.has(initialFact) ? initialFact : defaultFact);
          const initial: FilterState = {};
          for (const f of cfg.dimension_filters ?? []) {
            const urlVals = initialFilters?.[f.dimension_name];
            initial[f.dimension_name] = urlVals ? new Set(urlVals) : new Set();
          }
          setFilterState(initial);
        });
      })
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [cluster, scId, currentArticleId]);

  const aggMethod: AggMethod = (config?.data_model?.fact_aggregation?.method as AggMethod) ?? 'avg';
  const legacyColorField = (config as unknown as { color_by?: string | null })?.color_by ?? null;
  const colorField = config?.color_encoding?.enabled ? (config.color_encoding.field ?? null) : legacyColorField;
  const xStrategy = config?.data_model?.x_axis_strategy ?? 'article_date';
  const legacyXAxisField = (config as unknown as { x_axis?: string | null })?.x_axis ?? null;
  const xField = config?.axes?.x?.field ?? legacyXAxisField ?? 'date';

  // null dimensions on a fact means every schema dimension applies to it.
  const currentFactDims = useMemo<Set<string> | null>(() => {
    const factInfo = config?.fact_selector?.available_facts?.find((f) => f.name === selectedFact);
    if (!factInfo?.dimensions?.length) return null;
    return new Set<string>(factInfo.dimensions);
  }, [config, selectedFact]);

  // Color encoding is only active when the color field belongs to the current fact's dimensions.
  const colorFieldApplies = !currentFactDims || (colorField !== null && currentFactDims.has(colorField!));
  const effectiveColorField = colorField && colorFieldApplies && (filterState[colorField]?.size ?? 0) > 0 ? colorField : null;

  const dynamicDimValues = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const art of rawData) {
      for (const rec of art.records) {
        for (const [k, v] of Object.entries(rec)) {
          if (v !== null && v !== undefined && v !== '') {
            map[k] ??= new Set();
            map[k].add(String(v));
          }
        }
      }
    }
    return map;
  }, [rawData]);

  const chartPoints = useMemo(() => {
    if (!config || !selectedFact) return [];

    // Historical view: never plot articles published after the article being read.
    const cutoffDate =
      normalizeDate(currentArticleDate ?? '') ||
      normalizeDate(rawData.find((a) => a.article_id === currentArticleId)?.date ?? '');

    // Missing article dates are kept so sparse corpora still render something.
    const historicalData = cutoffDate
      ? rawData.filter((art) => {
          const artDate = normalizeDate(art.date ?? '');
          return !artDate || artDate <= cutoffDate;
        })
      : rawData;

    // Only apply filters for dimensions that belong to the currently selected fact.
    const activeFilters = currentFactDims
      ? (config.dimension_filters ?? []).filter((f) => currentFactDims.has(f.dimension_name))
      : (config.dimension_filters ?? []);

    if (xStrategy === 'temporal_dimension') {
      const allPoints = buildChartPointsFromRecords(
        historicalData,
        selectedFact,
        xField,
        effectiveColorField,
        activeFilters,
        filterState,
      );

      // Unselected slice dimensions are averaged away; the x-axis date dimension is not.
      type GroupEntry = { values: number[]; _displayDate: string; _articleId: string; _title: string; colorVal: string | null };
      const groupMap = new Map<string, GroupEntry>();

      for (const p of allPoints) {
        const colorVal = effectiveColorField ? String(p[effectiveColorField] ?? '') : null;
        const groupKey = colorVal !== null ? `${p._date}\x00${colorVal}` : p._date;
        const v = p[selectedFact];
        const num = typeof v === 'number' ? v : null;
        if (num === null) continue;
        const entry = groupMap.get(groupKey);
        if (entry) {
          entry.values.push(num);
        } else {
          groupMap.set(groupKey, { values: [num], _displayDate: p._displayDate, _articleId: p._articleId, _title: p._title, colorVal });
        }
      }

      return Array.from(groupMap.entries())
        .map(([groupKey, { values, _displayDate, _articleId, _title, colorVal }]) => {
          const _date = colorVal !== null ? groupKey.split('\x00')[0] : groupKey;
          const point: ChartPoint = {
            _date,
            _displayDate,
            _articleId,
            _title,
            [selectedFact]: aggregateRecords(
              values.map((v) => ({ [selectedFact]: v })),
              selectedFact,
              aggMethod,
            ),
          };
          if (effectiveColorField && colorVal !== null) point[effectiveColorField] = colorVal;
          return point;
        })
        .filter((p) => p[selectedFact] !== null)
        .sort((a, b) => a._date.localeCompare(b._date))
        .slice(-50);
    }

    const filtered = historicalData.filter((art) =>
      articlePassesFilters(art, activeFilters, filterState),
    );
    return buildChartPoints(filtered, selectedFact, aggMethod, effectiveColorField)
      .slice(-50);
  }, [rawData, config, selectedFact, filterState, aggMethod, effectiveColorField, xStrategy, xField, currentArticleId, currentArticleDate, currentFactDims]);

  const colorSeries = useMemo(() => {
    if (!effectiveColorField) return null;
    return Array.from(new Set(chartPoints.map((p) => String(p[effectiveColorField] ?? '')))).filter(Boolean);
  }, [chartPoints, effectiveColorField]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleBarClick(data: any) {
    const id = data?.activePayload?.[0]?.payload?._articleId;
    if (id) onArticleClick(id);
  }

  function toggleFilterValue(dimName: string, value: string) {
    const current = filterState[dimName] ?? new Set<string>();
    const newSet = current.has(value) ? new Set<string>() : new Set([value]);
    const newState = { ...filterState, [dimName]: newSet };
    setFilterState(newState);
    onStateChange?.(selectedFact, newState);
  }

  function clearFilter(dimName: string) {
    const newState = { ...filterState, [dimName]: new Set<string>() };
    setFilterState(newState);
    onStateChange?.(selectedFact, newState);
  }

  async function handleExport(format: 'png' | 'pdf') {
    setExportError(null);
    setExporting(format);
    try {
      const plot = document.querySelector('[data-testid="chart-plot-area"]') as HTMLElement | null;
      if (!plot) {
        throw new Error('Chart plot area is not available.');
      }
      await exportChartFromPlotArea(plot, format);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setExporting(null);
    }
  }

  const currentFact = config?.fact_selector?.available_facts?.find((f) => f.name === selectedFact);
  const factLabel = currentFact?.label ?? selectedFact;
  const factUnit = currentFact?.unit ?? '';

  function resolveTemplate(template: string): string {
    return template
      .replace(/\{\{selected_fact_label\}\}/g, factLabel)
      .replace(/\{\{selected_fact_unit\}\}/g, factUnit)
      .replace(/\{\{selected_fact\}\}/g, selectedFact)
      .replace(/\{\{fact_selector_label\}\}/gi, 'Оберіть показник:')
      .replace(/\{\{empty_state_message\}\}/gi, 'Немає даних для обраних фільтрів')
      .replace(/\{\{open_article_label\}\}/gi, 'Відкрити статтю')
      .replace(/\{\{tooltip_title_label\}\}/gi, 'Стаття')
      .replace(/\{\{tooltip_date_label\}\}/gi, 'Дата');
  }

  function resolveTitle(template: string): string {
    return resolveTemplate(template);
  }

  function resolveAxisLabel(template: string | undefined, fallback: string): string {
    if (!template) return fallback;
    const resolved = resolveTemplate(template).trim();
    return resolved || fallback;
  }

  function formatActiveFilters(): string {
    const parts: string[] = [];
    for (const f of config?.dimension_filters ?? []) {
      if (currentFactDims && !currentFactDims.has(f.dimension_name)) continue;
      const selected = filterState[f.dimension_name];
      if (selected?.size) {
        parts.push(`${f.label}: ${Array.from(selected).join(', ')}`);
      }
    }
    return parts.length ? parts.join(' · ') : 'без обмежень';
  }

  function chartSectionTitle(): string {
    if (config?.title) return resolveTitle(config.title);
    return 'Візуалізація даних';
  }

  function chartErrorDetails(): { title: string; hint: string } {
    if (error === 'no_subcluster') {
      return {
        title: 'Графік недоступний для цієї статті',
        hint: 'Стаття не належить до кластера з OLAP-даними або підкластер ще не сформовано.',
      };
    }
    if (error?.includes('404') || error?.includes('not found')) {
      return {
        title: 'Конфігурацію графіка не знайдено',
        hint: 'Переконайтеся, що обробка новин завершена та для кластера згенеровано OLAP-схему.',
      };
    }
    return {
      title: 'Не вдалося завантажити графік',
      hint: error ?? 'Перевірте підключення до бази даних і спробуйте оновити сторінку.',
    };
  }

  if (!cluster) {
    return (
      <div className="chart-section">
        <div className="chart-section-header">
          <h2 className="chart-section-title">Візуалізація даних</h2>
          <Link to="/help#charts" className="chart-help-link">Довідка</Link>
        </div>
        <div className="chart-placeholder">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <p>Для цієї статті не призначено кластер — графік недоступний.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="chart-section" aria-busy="true" aria-live="polite">
        <div className="chart-section-header">
          <h2 className="chart-section-title">Візуалізація даних</h2>
        </div>
        <div className="chart-placeholder">
          <div className="spinner" style={{ margin: '0 auto 14px' }} />
          <p>Завантаження даних графіка…</p>
        </div>
      </div>
    );
  }

  if (error || !config) {
    const { title, hint } = chartErrorDetails();
    return (
      <div className="chart-section">
        <div className="chart-section-header">
          <h2 className="chart-section-title">Візуалізація даних</h2>
          <Link to="/help#charts" className="chart-help-link">Довідка</Link>
        </div>
        <div className="chart-status chart-status--error" role="alert">
          <span className="chart-status-icon" aria-hidden="true">!</span>
          <div>
            <strong>{title}</strong>
            <p>{hint}</p>
          </div>
        </div>
      </div>
    );
  }

  const renderableFilters = (config.dimension_filters ?? []).filter((f) => {
    if (f.type === 'date_range' || f.type === 'slider') return false;
    // Only show filters relevant to the currently selected fact.
    if (currentFactDims && !currentFactDims.has(f.dimension_name)) return false;
    const vals = f.possible_values?.length ? f.possible_values : Array.from(dynamicDimValues[f.dimension_name] ?? []);
    return vals.length > 1;
  });

  const legacySeriesRenderAs = (config as unknown as { series?: Array<{ render_as?: string }> })?.series?.[0]?.render_as;
  const chartType = config.chart_type ?? legacySeriesRenderAs ?? 'bar';
  const showGrid = config.visual_options?.show_grid !== false;
  const showLegend = config.visual_options?.show_legend && colorSeries && colorSeries.length > 1;

  function renderChart() {
    const commonProps = {
      data: chartPoints,
      margin: { top: 8, right: 16, left: 16, bottom: 40 },
      onClick: handleBarClick,
      style: { cursor: chartPoints.length ? 'pointer' : 'default' },
    };

    const yLabelFallback = factUnit ? `${factLabel}, ${factUnit}` : factLabel;
    const yLabel = resolveAxisLabel(config?.axes?.y?.label, yLabelFallback);

    const yValues = chartPoints
      .map((p) => p[selectedFact])
      .filter((v): v is number => typeof v === 'number');
    const yDomain: [number | string, number | string] = (() => {
      if (yValues.length === 0) return ['auto', 'auto'];
      const dataMin = Math.min(...yValues);
      const dataMax = Math.max(...yValues);
      // Keep a visible range for flat lines/bars and apply +/-10% padding.
      const isFlat = dataMin === dataMax;
      const basePad = Math.max(Math.abs(dataMax || dataMin), 1) * 0.1;
      const lo = isFlat
        ? dataMin - basePad
        : dataMin - Math.abs(dataMin) * 0.1;
      const hi = isFlat
        ? dataMax + basePad
        : dataMax + Math.abs(dataMax) * 0.1;
      if (config?.axes?.y?.scale === 'log') return [Math.max(lo, 0.0001), Math.max(hi, 0.001)];
      return [lo, hi];
    })();

    const xAxisLabel = resolveAxisLabel(
      config?.axes?.x?.label,
      legacyXAxisField ?? 'Дата',
    );
    const yScale = config?.axes?.y?.scale === 'log' ? 'log' : 'linear';

    const xAxis = (
      <XAxis
        dataKey="_displayDate"
        tick={{ fontSize: 11 }}
        angle={-30}
        textAnchor="end"
        height={60}
        label={{ value: xAxisLabel, position: 'insideBottom', offset: -4, fontSize: 11 }}
      />
    );

    const yAxis = (
      <YAxis
        scale={yScale}
        domain={yDomain}
        allowDataOverflow
        tick={{ fontSize: 11 }}
        width={72}
        tickFormatter={(v: number) => v.toLocaleString('uk-UA', { maximumFractionDigits: 2, notation: 'compact' })}
        label={{ value: yLabel, angle: -90, position: 'insideLeft', offset: -4, fontSize: 11, style: { textAnchor: 'middle' } }}
      />
    );

    const grid = showGrid ? <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e4" /> : null;
    const legend = showLegend ? <Legend wrapperStyle={{ fontSize: 11 }} /> : null;
    const tooltip = (
      <Tooltip
        content={
          <ChartTooltip
            factLabel={factLabel}
            factUnit={factUnit}
          />
        }
      />
    );

    if (chartType === 'line' || chartType === 'area') {
      const ChartComp = chartType === 'area' ? AreaChart : LineChart;
      const DataComp = chartType === 'area' ? Area : Line;

      if (colorSeries && colorSeries.length > 1) {
        // Recharts sorts x labels lexicographically; bucket by ISO date instead of display text.
        type MultiPoint = { _date: string; _displayDate: string; [k: string]: number | string | null };
        const byDate: Record<string, MultiPoint> = {};
        for (const p of chartPoints) {
          const d = p._date;
          byDate[d] ??= { _date: d, _displayDate: p._displayDate };
          const seriesKey = String(p[effectiveColorField!] ?? '');
          byDate[d][seriesKey] = p[selectedFact] as number;
          // preserve article id so activeDot onClick can navigate
          byDate[d][`_id_${seriesKey}`] = p._articleId;
        }
        const multiData = Object.values(byDate).sort((a, b) =>
          a._date.localeCompare(b._date),
        );

        return (
          <ChartComp {...commonProps} data={multiData}>
            {grid}
            {xAxis}
            {yAxis}
            {tooltip}
            {legend}
            {colorSeries.map((s, i) => (
              <DataComp
                key={s}
                type="monotone"
                dataKey={s}
                name={s}
                stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                fill={SERIES_COLORS[i % SERIES_COLORS.length]}
                fillOpacity={0.2}
                dot={{ r: 3, cursor: 'pointer' }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                activeDot={{ r: 5, cursor: 'pointer', onClick: (_: any, payload: any) => { const id = payload?.payload?.[`_id_${s}`]; if (id) onArticleClick(String(id)); } }}
                connectNulls
              />
            ))}
          </ChartComp>
        );
      }

      return (
        <ChartComp {...commonProps}>
          {grid}
          {xAxis}
          {yAxis}
          {tooltip}
          <DataComp
            type="monotone"
            dataKey={selectedFact}
            stroke={SERIES_COLORS[0]}
            fill={SERIES_COLORS[0]}
            fillOpacity={0.15}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            dot={(props: any) => {
              const isCurrent = props.payload?._articleId === currentArticleId;
              const artId = props.payload?._articleId;
              return (
                <circle
                  key={`dot-${artId}`}
                  cx={props.cx ?? 0}
                  cy={props.cy ?? 0}
                  r={isCurrent ? 6 : 3}
                  fill={isCurrent ? '#c41e3a' : SERIES_COLORS[0]}
                  stroke={isCurrent ? '#fff' : 'none'}
                  strokeWidth={2}
                  style={{ cursor: 'pointer' }}
                  onClick={() => { if (artId) onArticleClick(String(artId)); }}
                />
              );
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            activeDot={{ r: 5, cursor: 'pointer', onClick: (_: any, payload: any) => { const id = payload?.payload?._articleId; if (id) onArticleClick(String(id)); } }}
            connectNulls
          />
        </ChartComp>
      );
    }

    return (
      <BarChart {...commonProps}>
        {grid}
        {xAxis}
        {yAxis}
        {tooltip}
        {legend}
        {colorSeries && colorSeries.length > 1
          ? colorSeries.map((s, i) => (
              <Bar
                key={s}
                dataKey={s}
                name={s}
                fill={SERIES_COLORS[i % SERIES_COLORS.length]}
                radius={[2, 2, 0, 0]}
              />
            ))
          : (
            <Bar
              dataKey={selectedFact}
              fill={SERIES_COLORS[1]}
              radius={[2, 2, 0, 0]}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              shape={(props: any) => {
                const isCurrent = props.payload?._articleId === currentArticleId;
                const artId = props.payload?._articleId;
                return (
                  <rect
                    key={`bar-${artId}`}
                    x={props.x ?? 0}
                    y={props.y ?? 0}
                    width={props.width ?? 0}
                    height={props.height ?? 0}
                    fill={isCurrent ? '#c41e3a' : SERIES_COLORS[1]}
                    rx={2}
                    ry={2}
                    style={{ cursor: 'pointer' }}
                    onClick={() => { if (artId) onArticleClick(String(artId)); }}
                  />
                );
              }}
            />
          )
        }
      </BarChart>
    );
  }

  const factDisplay = factUnit ? `${factLabel} (${factUnit})` : factLabel;

  return (
    <div className="chart-section" data-testid="subcluster-chart">
      <div className="chart-section-header">
        <div>
          <h2 className="chart-section-title"></h2>
        </div>
        <Link to="/help#charts" className="chart-help-link">Довідка</Link>
      </div>

      <div className="chart-card">
        <div className="chart-controls" data-testid="chart-controls-panel">
          <div className="chart-controls-main">
          {config.fact_selector?.enabled && (config.fact_selector.available_facts?.length ?? 0) > 1 && (
            <div className="chart-control-group">
              <label className="chart-control-label">{resolveTemplate(config.fact_selector.label ?? '')}</label>
              <select
                className="chart-select"
                data-testid="chart-fact-select"
                value={selectedFact}
                onChange={(e) => {
                  const newFact = e.target.value;
                  setSelectedFact(newFact);
                  // Clear filters for dimensions that don't apply to the newly selected fact.
                  const newFactInfo = config?.fact_selector?.available_facts?.find((f) => f.name === newFact);
                  const newFactDims = newFactInfo?.dimensions?.length ? new Set<string>(newFactInfo.dimensions) : null;
                  if (newFactDims) {
                    const cleared: FilterState = {};
                    for (const [k, v] of Object.entries(filterState)) {
                      cleared[k] = newFactDims.has(k) ? v : new Set<string>();
                    }
                    setFilterState(cleared);
                    onStateChange?.(newFact, cleared);
                  } else {
                    onStateChange?.(newFact, filterState);
                  }
                }}
              >
                {config.fact_selector.available_facts.map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.label}{f.unit ? ` (${f.unit})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {renderableFilters.map((f) => {
            const vals = f.possible_values?.length
              ? f.possible_values
              : Array.from(dynamicDimValues[f.dimension_name] ?? []);
            const selected = filterState[f.dimension_name] ?? new Set();

            return (
              <div
                key={f.dimension_name}
                className="chart-control-group"
                data-testid={`chart-filter-${f.dimension_name}`}
              >
                <label className="chart-control-label" title={f.description || undefined}>
                  {f.label}
                  {selected.size > 0 && (
                    <button className="chart-filter-clear" onClick={() => clearFilter(f.dimension_name)}>
                      ×
                    </button>
                  )}
                </label>

                {f.type === 'toggle' && vals.length <= 2 ? (
                  <div className="chart-filter-toggle-group">
                    {vals.map((v) => (
                      <button
                        key={v}
                        className={`chart-filter-tag${selected.has(v) ? ' active' : ''}`}
                        onClick={() => toggleFilterValue(f.dimension_name, v)}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                ) : f.type === 'dropdown' ? (
                  <select
                    className="chart-select"
                    value={selected.size === 1 ? Array.from(selected)[0] : ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      const newState = {
                        ...filterState,
                        [f.dimension_name]: val ? new Set([val]) : new Set<string>(),
                      };
                      setFilterState(newState);
                      onStateChange?.(selectedFact, newState);
                    }}
                  >
                    <option value="">Усі</option>
                    {vals.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                ) : (
                  <div className="chart-filter-tags">
                    {vals.slice(0, 20).map((v) => (
                      <button
                        key={v}
                        className={`chart-filter-tag${selected.has(v) ? ' active' : ''}`}
                        onClick={() => toggleFilterValue(f.dimension_name, v)}
                      >
                        {v}
                      </button>
                    ))}
                    {vals.length > 20 && (
                      <span className="chart-filter-more">+{vals.length - 20} ще</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          </div>

          {chartPoints.length > 0 && (
            <div className="chart-export-toolbar">
              <button
                type="button"
                className="chart-export-btn chart-export-btn--png"
                data-testid="chart-export-png"
                disabled={exporting !== null}
                onClick={() => handleExport('png')}
              >
                {exporting === 'png' ? '…' : 'PNG'}
              </button>
              <button
                type="button"
                className="chart-export-btn chart-export-btn--icon"
                data-testid="chart-export-pdf"
                aria-label="Export PDF"
                title="Export PDF"
                disabled={exporting !== null}
                onClick={() => handleExport('pdf')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </button>
            </div>
          )}
          {exportError && (
            <div className="chart-status chart-status--error chart-export-error" role="alert">
              <span className="chart-status-icon" aria-hidden="true">!</span>
              <span>{exportError}</span>
            </div>
          )}
        </div>

        {chartPoints.length === 0 ? (
          <div className="chart-placeholder" style={{ padding: '40px 24px' }}>
            <p>{resolveTemplate(config.visual_options?.empty_state_message ?? '{{empty_state_message}}')}</p>
            <p className="chart-empty-hint">Спробуйте змінити показник або скинути фільтри вимірів.</p>
          </div>
        ) : (
          <>
            <div className="chart-wrap" data-testid="chart-plot-area">
              <ResponsiveContainer width="100%" height={320}>
                {renderChart()}
              </ResponsiveContainer>
            </div>
            <div className="chart-footer" aria-live="polite">
              {config.interactivity?.click_to_article?.enabled !== false && (
                <span className="chart-footer-hint">Натисніть на точку даних, щоб відкрити статтю-джерело</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
