import { useEffect, useMemo, useState } from 'react';
import { fetchOlapSchemaTree, type OlapClusterTree } from '../api/olap';
import type { Selection } from '../pages/OlapSchemasPage/types';
import { firstSelection } from '../pages/OlapSchemasPage/types';

export function useOlapTree() {
  const [clusters, setClusters] = useState<OlapClusterTree[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selection, setSelection] = useState<Selection | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError('');
        const tree = await fetchOlapSchemaTree();
        if (cancelled) return;

        setClusters(tree.clusters);
        const initial = firstSelection(tree.clusters);
        setSelection(initial);
        if (initial?.clusterName) {
          setExpanded({ [initial.clusterName]: true });
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load OLAP schemas');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const selectedCluster = useMemo(
    () => clusters.find((cluster) => cluster.name === selection?.clusterName) ?? null,
    [clusters, selection?.clusterName],
  );

  const selectedSubcluster = useMemo(
    () => selectedCluster?.subclusters.find((subcluster) => subcluster.name === selection?.subclusterName) ?? null,
    [selectedCluster, selection?.subclusterName],
  );

  return {
    clusters,
    loading,
    error,
    expanded,
    setExpanded,
    selection,
    setSelection,
    selectedCluster,
    selectedSubcluster,
  };
}
