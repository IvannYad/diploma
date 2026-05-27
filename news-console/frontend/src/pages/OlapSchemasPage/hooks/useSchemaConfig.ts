import { useEffect, useMemo, useState } from 'react';
import { fetchChartConfig, invalidateChartConfigCache } from '../../../api/charts';
import { isAutoDateDimensionName } from '../../../lib/olap/dateDimension';
import type { ChartConfigFile } from '../../../types/news';
import type { Selection } from '../types';

export function useSchemaConfig(selection: Selection | null) {
  const [schemaConfig, setSchemaConfig] = useState<ChartConfigFile | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState('');

  useEffect(() => {
    let disposed = false;

    async function loadSchema() {
      if (!selection?.clusterName || !selection.subclusterName) {
        setSchemaConfig(null);
        setSchemaError('');
        setSchemaLoading(false);
        return;
      }

      try {
        setSchemaLoading(true);
        setSchemaError('');
        const config = await fetchChartConfig(selection.clusterName, selection.subclusterName);
        if (disposed) return;
        setSchemaConfig(config);
      } catch (err) {
        if (disposed) return;
        setSchemaConfig(null);
        setSchemaError(err instanceof Error ? err.message : 'Failed to load OLAP schema');
      } finally {
        if (!disposed) setSchemaLoading(false);
      }
    }

    loadSchema();
    return () => { disposed = true; };
  }, [selection?.clusterName, selection?.subclusterName]);

  const olapFacts = schemaConfig?.olap_schema?.facts ?? [];

  const olapDimensions = useMemo(() => {
    const raw = schemaConfig?.olap_schema?.dimensions ?? [];
    let seenTemporal = false;
    const sorted = [...raw].sort((a) => (a.name.toLowerCase() === 'дата' ? -1 : 1));
    return sorted.filter((dim) => {
      if (dim.type === 'temporal' || isAutoDateDimensionName(dim.name)) {
        if (seenTemporal) return false;
        seenTemporal = true;
      }
      return true;
    });
  }, [schemaConfig]);

  async function reloadSchemaForSelection() {
    if (!selection?.clusterName || !selection.subclusterName) {
      return;
    }

    invalidateChartConfigCache(selection.clusterName, selection.subclusterName);

    try {
      setSchemaLoading(true);
      setSchemaError('');
      const config = await fetchChartConfig(selection.clusterName, selection.subclusterName);
      setSchemaConfig(config);
    } catch (err) {
      setSchemaConfig(null);
      setSchemaError(err instanceof Error ? err.message : 'Failed to load OLAP schema');
    } finally {
      setSchemaLoading(false);
    }
  }

  return {
    schemaConfig,
    schemaLoading,
    schemaError,
    olapFacts,
    olapDimensions,
    reloadSchemaForSelection,
  };
}
