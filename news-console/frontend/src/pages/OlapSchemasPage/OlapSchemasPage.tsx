import './OlapSchemasPage.scss';
import { formatLabel } from '../../lib/format';
import { findAutoDateDimensionName } from '../../lib/olap/dateDimension';
import ClusterTree from './components/ClusterTree';
import DimensionsEditor from './components/DimensionsEditor';
import FactEditor from './components/FactEditor';
import SchemaActionsBar from './components/SchemaActionsBar';
import SchemaDiagram from './components/SchemaDiagram';
import { useOlapTree } from './hooks/useOlapTree';
import { useSchemaConfig } from './hooks/useSchemaConfig';
import { useSchemaEditor } from './hooks/useSchemaEditor';
import { useSchemaRebuild } from './hooks/useSchemaRebuild';

export default function OlapSchemasPage() {
  const tree = useOlapTree();
  const config = useSchemaConfig(tree.selection);

  const editor = useSchemaEditor(config.olapFacts, config.olapDimensions);

  const rebuild = useSchemaRebuild({
    selection: tree.selection,
    editedSchemas: editor.editedSchemas,
    editedDimensions: editor.editedDimensions,
    autoDateDimensionName: editor.autoDateDimensionName,
    tableDescription: config.schemaConfig?.olap_schema?.table_description ?? '',
    onSuccess: config.reloadSchemaForSelection,
    exitEditModeSilently: editor.exitEditModeSilently,
  });

  const viewAutoDate = findAutoDateDimensionName(config.olapDimensions);

  function handleEditMode() {
    if (editor.isEditMode) {
      editor.exitEditModeSilently();
      rebuild.clearRebuildStatus();
    } else {
      rebuild.clearRebuildStatus();
      editor.handleEditMode();
    }
  }

  function handleRenameFact(oldName: string, newName: string) {
    const schema = editor.editedSchemas[oldName];
    editor.setEditedSchemas((prev) => {
      const updated = { ...prev };
      delete updated[oldName];
      updated[newName] = { ...schema, name: newName };
      return updated;
    });
    editor.setSelectedFactName(newName);
  }

  return (
    <div className="olap-page" data-testid="olap-schemas-page">
      <div className="olap-page__shell">
        <div className="olap-page__hero">
          <div>
            <div className="olap-page__eyebrow">News Intelligence Platform</div>
            <h1 className="olap-page__title">Edit OLAP schemas</h1>
          </div>
        </div>

        <div className="olap-page__layout">
          <ClusterTree
            isEditMode={editor.isEditMode}
            selection={tree.selection}
            clusters={tree.clusters}
            loading={tree.loading}
            error={tree.error}
            expanded={tree.expanded}
            displaySchemas={editor.displaySchemas}
            selectedFactName={editor.selectedFactName}
            onToggleExpanded={(clusterName) => {
              tree.setExpanded((prev) => ({ ...prev, [clusterName]: !prev[clusterName] }));
            }}
            onSelectSubcluster={tree.setSelection}
            onSelectFact={editor.setSelectedFactName}
            onAddSchema={editor.handleAddSchema}
            onDeleteSchema={editor.handleDeleteSchema}
            activeSchemaCount={editor.isEditMode ? editor.countActiveSchemas() : editor.displaySchemas.filter((s) => !s.isSoftDeleted).length}
          />

          <section className="olap-page__details">
            <SchemaActionsBar
              isEditMode={editor.isEditMode}
              hasSelection={Boolean(tree.selection)}
              editTab={editor.editTab}
              saveLoading={rebuild.saveLoading}
              saveError={rebuild.saveError}
              saveSuccess={rebuild.saveSuccess}
              onEdit={handleEditMode}
              onSave={rebuild.handleRebuildSchemas}
              onCancel={() => editor.handleCancelEdit(rebuild.clearRebuildStatus)}
              onTabChange={editor.setEditTab}
            />

            {!editor.isEditMode && (
              <SchemaDiagram
                schemaConfig={config.schemaConfig}
                schemaLoading={config.schemaLoading}
                schemaError={config.schemaError}
                olapFacts={config.olapFacts}
                olapDimensions={config.olapDimensions}
                autoDateDimensionName={viewAutoDate}
              />
            )}

            {!editor.isEditMode && (
              <>
                {tree.selection ? (
                  <div className="olap-page__details-card">
                    <div className="olap-page__details-row">
                      <span>Cluster</span>
                      <strong>{formatLabel(tree.selection.clusterName)}</strong>
                    </div>
                    <div className="olap-page__details-row">
                      <span>Subcluster</span>
                      <strong>
                        {tree.selection.subclusterName
                          ? formatLabel(tree.selection.subclusterName)
                          : '—'}
                      </strong>
                    </div>
                  </div>
                ) : (
                  <div className="olap-page__empty">Select a cluster or subcluster to inspect it.</div>
                )}
              </>
            )}

            {editor.isEditMode && editor.editTab === 'dimensions' && (
              <DimensionsEditor
                dimensions={editor.editableDimensions}
                onUpdateDimension={editor.handleUpdateDimension}
                onAddDimension={editor.handleAddDimension}
                onDeleteDimension={editor.handleDeleteDimension}
              />
            )}

            {editor.isEditMode && editor.editTab === 'facts' && editor.selectedFactName
              && editor.editedSchemas[editor.selectedFactName] && (
              <FactEditor
                factName={editor.selectedFactName}
                schema={editor.editedSchemas[editor.selectedFactName]}
                editableDimensions={editor.editableDimensions}
                onRenameFact={handleRenameFact}
                onUpdateSchema={editor.handleUpdateSchema}
              />
            )}

            {editor.isEditMode && editor.editTab === 'facts' && !editor.selectedFactName && (
              <div className="olap-page__empty">Select a schema from the list to edit it.</div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
