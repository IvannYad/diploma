import { formatLabel, titleCase } from '../../../lib/format';
import type { OlapClusterTree } from '../../../types/olap';
import type { EditedSchema, Selection } from '../types';

interface Props {
  isEditMode: boolean;
  selection: Selection | null;
  clusters: OlapClusterTree[];
  loading: boolean;
  error: string;
  expanded: Record<string, boolean>;
  displaySchemas: EditedSchema[];
  selectedFactName: string | null;
  onToggleExpanded: (clusterName: string) => void;
  onSelectSubcluster: (selection: Selection) => void;
  onSelectFact: (factName: string) => void;
  onAddSchema: () => void;
  onDeleteSchema: (schemaName: string) => void;
  activeSchemaCount: number;
}

export default function ClusterTree({
  isEditMode,
  selection,
  clusters,
  loading,
  error,
  expanded,
  displaySchemas,
  selectedFactName,
  onToggleExpanded,
  onSelectSubcluster,
  onSelectFact,
  onAddSchema,
  onDeleteSchema,
  activeSchemaCount,
}: Props) {
  return (
    <aside className="olap-page__tree">
      <div className="olap-page__panel-title">
        {isEditMode && selection ? 'OLAP Schemas' : 'Clusters'}
      </div>

      {!isEditMode && (
        <>
          {loading && <div className="olap-page__empty">Loading schema tree...</div>}
          {!loading && error && <div className="olap-page__error">{error}</div>}
          {!loading && !error && clusters.length === 0 && (
            <div className="olap-page__empty">No OLAP schema data found yet.</div>
          )}

          {!loading && !error && clusters.map((cluster) => {
            const isExpanded = expanded[cluster.name] === true;
            const isSelectedCluster = selection?.clusterName === cluster.name;

            return (
              <div key={cluster.name} className="olap-page__cluster">
                <button
                  type="button"
                  className={`olap-page__cluster-row${isSelectedCluster ? ' olap-page__cluster-row--selected' : ''}`}
                  onClick={() => onToggleExpanded(cluster.name)}
                >
                  <span className={`olap-page__chevron${isExpanded ? ' olap-page__chevron--open' : ''}`}>▸</span>
                  <span className="olap-page__cluster-name" title={cluster.name}>{formatLabel(cluster.name)}</span>
                </button>

                {isExpanded && (
                  <div className="olap-page__subcluster-list">
                    {cluster.subclusters.map((subcluster) => {
                      const isSelected = selection?.clusterName === cluster.name
                        && selection.subclusterName === subcluster.name;

                      return (
                        <button
                          key={subcluster.name}
                          type="button"
                          className={`olap-page__subcluster-row${isSelected ? ' olap-page__subcluster-row--selected' : ''}`}
                          onClick={() => onSelectSubcluster({ clusterName: cluster.name, subclusterName: subcluster.name })}
                          title={subcluster.name}
                        >
                          <span className="olap-page__subcluster-bullet" />
                          <span>{formatLabel(subcluster.name)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {isEditMode && selection && (
        <div className="olap-page__schemas-list">
          <button
            type="button"
            className="olap-page__add-schema-btn"
            onClick={onAddSchema}
          >
            + Add fact
          </button>
          {displaySchemas.map((schema) => {
            const isSelected = selectedFactName === schema.name;
            const isSoftDeleted = schema.isSoftDeleted === true;
            return (
              <div
                key={schema.name}
                className={`olap-page__schema-row${isSelected ? ' olap-page__schema-row--selected' : ''}${isSoftDeleted ? ' olap-page__schema-row--soft-deleted' : ''}`}
                onClick={() => onSelectFact(schema.name)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onSelectFact(schema.name);
                  }
                }}
                title={schema.name}
              >
                <span className="olap-page__schema-row-name">{titleCase(schema.name)}</span>
                <div
                  className={`olap-page__schema-row-delete${isSoftDeleted ? ' olap-page__schema-row-delete--restore' : ''}${!isSoftDeleted && activeSchemaCount <= 1 ? ' olap-page__schema-row-delete--disabled' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isSoftDeleted && activeSchemaCount <= 1) {
                      return;
                    }
                    onDeleteSchema(schema.name);
                  }}
                  role="button"
                  tabIndex={!isSoftDeleted && activeSchemaCount <= 1 ? -1 : 0}
                  aria-disabled={!isSoftDeleted && activeSchemaCount <= 1}
                  aria-label={isSoftDeleted ? 'Restore schema' : 'Delete fact'}
                  title={!isSoftDeleted && activeSchemaCount <= 1
                    ? 'At least one fact is required'
                    : isSoftDeleted ? 'Restore schema' : 'Delete fact'}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                </div>
              </div>
            );
          })}
          {displaySchemas.length === 0 && (
            <div className="olap-page__empty">No schemas. Click &quot;Add Schema&quot; to create one.</div>
          )}
        </div>
      )}
    </aside>
  );
}
