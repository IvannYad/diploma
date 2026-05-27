import { titleCase } from '../../../lib/format';
import { dimensionsForFact } from '../../../lib/olap/schemaPayload';
import type { ChartConfigFile, FactInfo } from '../../../types/news';
import { DIAGRAM_HEIGHT, DIAGRAM_WIDTH, nodePosition } from '../lib/diagram';

interface Props {
  schemaConfig: ChartConfigFile | null;
  schemaLoading: boolean;
  schemaError: string;
  olapFacts: FactInfo[];
  olapDimensions: Array<{ name: string; description: string; type: string }>;
  autoDateDimensionName: string | null;
}

export default function SchemaDiagram({
  schemaConfig,
  schemaLoading,
  schemaError,
  olapFacts,
  olapDimensions,
  autoDateDimensionName,
}: Props) {
  return (
    <div className="olap-page__schema-block">
      <h3 className="olap-page__schema-title">Conceptual OLAP schema</h3>
      <p className="olap-page__schema-subtitle">
        Star-like conceptual view. One diagram is rendered per fact.
      </p>

      {schemaLoading && <div className="olap-page__empty">Loading conceptual schema...</div>}
      {!schemaLoading && schemaError && <div className="olap-page__error">{schemaError}</div>}
      {!schemaLoading && !schemaError && !schemaConfig && (
        <div className="olap-page__empty">Select a subcluster to see schema diagram.</div>
      )}
      {!schemaLoading && !schemaError && schemaConfig && olapFacts.length === 0 && (
        <div className="olap-page__empty">No facts found in OLAP schema.</div>
      )}

      {!schemaLoading && !schemaError && schemaConfig && olapFacts.length > 0 && (
        <div className="olap-page__schema-grid">
          {olapFacts.map((fact) => {
            const dimensions = dimensionsForFact(fact, olapDimensions, autoDateDimensionName);

            return (
              <div
                key={fact.name}
                className="olap-page__star-card"
              >
                <div className="olap-page__star-canvas">
                  <svg
                    className="olap-page__star-lines"
                    viewBox={`0 0 ${DIAGRAM_WIDTH} ${DIAGRAM_HEIGHT}`}
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    {dimensions.map((dimension, index) => {
                      const point = nodePosition(index, dimensions.length);
                      return (
                        <line
                          key={`${fact.name}-${dimension.name}`}
                          x1={DIAGRAM_WIDTH / 2}
                          y1={DIAGRAM_HEIGHT / 2}
                          x2={point.x}
                          y2={point.y}
                        />
                      );
                    })}
                  </svg>

                  <div className="olap-page__fact-node" title={fact.description || fact.name}>
                    {titleCase(fact.name)}
                  </div>

                  {dimensions.map((dimension, index) => {
                    const point = nodePosition(index, dimensions.length);
                    const labelSide = point.x < DIAGRAM_WIDTH / 2 ? 'left' : 'right';
                    return (
                      <div
                        key={`${fact.name}-${dimension.name}-node`}
                        className="olap-page__dimension-wrap"
                        style={{
                          left: `${(point.x / DIAGRAM_WIDTH) * 100}%`,
                          top: `${(point.y / DIAGRAM_HEIGHT) * 100}%`,
                        }}
                        title={dimension.description || dimension.name}
                      >
                        <span className="olap-page__dimension-dot" />
                        <span
                          className={`olap-page__dimension-label olap-page__dimension-label--${labelSide}`}
                        >
                          {titleCase(dimension.name)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
