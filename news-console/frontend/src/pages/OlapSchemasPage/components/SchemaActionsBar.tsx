import type { EditTab } from '../types';

interface Props {
  isEditMode: boolean;
  hasSelection: boolean;
  editTab: EditTab;
  saveLoading: boolean;
  saveError: string;
  saveSuccess: string;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onTabChange: (tab: EditTab) => void;
}

export default function SchemaActionsBar({
  isEditMode,
  hasSelection,
  editTab,
  saveLoading,
  saveError,
  saveSuccess,
  onEdit,
  onSave,
  onCancel,
  onTabChange,
}: Props) {
  return (
    <>
      <div className="olap-page__details-header">
        <div className="olap-page__panel-title">Current selection</div>
        {!isEditMode && hasSelection && (
          <button
            type="button"
            className="olap-page__edit-btn"
            onClick={onEdit}
          >
            Edit
          </button>
        )}
        {isEditMode && (
          <div className="olap-page__edit-actions">
            <button
              type="button"
              className="olap-page__btn olap-page__btn--primary"
              onClick={onSave}
              disabled={saveLoading}
            >
              {saveLoading ? 'Saving...' : 'Save and Rebuild schemas'}
            </button>
            {saveLoading && (
              <span className="olap-page__save-loading" role="status">
                Rebuilding…
              </span>
            )}
            <button
              type="button"
              className="olap-page__btn olap-page__btn--secondary"
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {isEditMode && saveError && (
        <div className="olap-page__error">
          {saveError}
        </div>
      )}
      {isEditMode && saveSuccess && (
        <div className="olap-page__empty">
          {saveSuccess}
        </div>
      )}

      {isEditMode && (
        <div className="olap-page__edit-tabs" role="tablist" aria-label="OLAP edit sections">
          <button
            type="button"
            role="tab"
            aria-selected={editTab === 'facts'}
            className={`olap-page__edit-tab${editTab === 'facts' ? ' olap-page__edit-tab--active' : ''}`}
            onClick={() => onTabChange('facts')}
          >
            Facts
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={editTab === 'dimensions'}
            className={`olap-page__edit-tab${editTab === 'dimensions' ? ' olap-page__edit-tab--active' : ''}`}
            onClick={() => onTabChange('dimensions')}
          >
            Dimensions
          </button>
        </div>
      )}
    </>
  );
}
