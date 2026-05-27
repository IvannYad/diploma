import type { OlapClusterTree } from '../../types/olap';

export type { EditedDimension, EditedSchema } from '../../types/olap';

export type Selection = {
  clusterName: string;
  subclusterName: string;
};

export type EditTab = 'facts' | 'dimensions';

export function firstSelection(clusters: OlapClusterTree[]): Selection | null {
  const cluster = clusters[0];
  if (!cluster) return null;
  return {
    clusterName: cluster.name,
    subclusterName: cluster.subclusters[0]?.name ?? '',
  };
}
