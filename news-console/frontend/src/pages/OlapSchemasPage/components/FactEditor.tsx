import { titleCase } from '../../../lib/format';
import type { EditedDimension, EditedSchema } from '../types';

interface Props {
  factName: string;
  schema: EditedSchema;
  editableDimensions: EditedDimension[];
  onRenameFact: (oldName: string, newName: string) => void;
  onUpdateSchema: (name: string, updates: Partial<EditedSchema>) => void;
}

export default function FactEditor({
  factName,
  schema,
  editableDimensions,
  onRenameFact,
  onUpdateSchema,
}: Props) {
  return (
    <div className="olap-page__schema-editor" data-fact-name={factName}>
      {schema.isSoftDeleted && (
        <div className="olap-page__schema-warning" role="status">
          This schema is marked for deletion. Click the trash icon in the left list to restore it.
        </div>
      )}
      <h3 className="olap-page__schema-title">Fact editor</h3>
      <div className="olap-page__form-group">
        <label className="olap-page__form-label">
          Fact Name
          <input
            type="text"
            className="olap-page__form-input"
            value={schema.name ?? ''}
            onChange={(e) => {
              const newName = e.target.value;
              if (newName !== factName) {
                onRenameFact(factName, newName);
              }
            }}
          />
        </label>
      </div>

      <div className="olap-page__form-group">
        <label className="olap-page__form-label">
          Unit
          <input
            type="text"
            className="olap-page__form-input"
            value={schema.unit ?? ''}
            onChange={(e) => onUpdateSchema(factName, { unit: e.target.value })}
          />
        </label>
      </div>

      <div className="olap-page__form-group">
        <label className="olap-page__form-label">
          Description
          <textarea
            className="olap-page__form-textarea"
            value={schema.description ?? ''}
            onChange={(e) => onUpdateSchema(factName, { description: e.target.value })}
          />
        </label>
      </div>

      <div className="olap-page__form-group">
        <label className="olap-page__form-label">Dimensions used by this fact</label>
        <div className="olap-page__dimensions-list">
          {editableDimensions.map((dimension) => {
            const isSelected = schema.dimensions?.includes(dimension.name) ?? false;
            return (
              <label
                key={dimension.name}
                className="olap-page__dimension-checkbox"
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => {
                    const newDimensions = e.target.checked
                      ? [...(schema.dimensions || []), dimension.name]
                      : (schema.dimensions || []).filter((d) => d !== dimension.name);
                    onUpdateSchema(factName, { dimensions: newDimensions });
                  }}
                />
                <span>{titleCase(dimension.name)}</span>
                {dimension.description && (
                  <span className="olap-page__dimension-hint">
                    {dimension.type} · {dimension.description}
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
