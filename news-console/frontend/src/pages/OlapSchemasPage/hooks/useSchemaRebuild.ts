import { useEffect, useState } from 'react';
import { getRebuildProgress, rebuildOlapSchemas } from '../../../api/olap';
import { buildEditableSchemaPayload } from '../../../lib/olap/schemaPayload';
import type { EditedDimension, EditedSchema } from '../../../types/olap';
import type { Selection } from '../types';

type RebuildDeps = {
  selection: Selection | null;
  editedSchemas: Record<string, EditedSchema>;
  editedDimensions: Record<string, EditedDimension>;
  autoDateDimensionName: string | null;
  tableDescription: string;
  onSuccess: () => Promise<void>;
  exitEditModeSilently: () => void;
};

export function useSchemaRebuild({
  selection,
  editedSchemas,
  editedDimensions,
  autoDateDimensionName,
  tableDescription,
  onSuccess,
  exitEditModeSilently,
}: RebuildDeps) {
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  useEffect(() => {
    setSaveError('');
    setSaveSuccess('');
  }, [selection?.clusterName, selection?.subclusterName]);

  function clearRebuildStatus() {
    setSaveError('');
    setSaveSuccess('');
  }

  async function handleRebuildSchemas() {
    if (!selection?.clusterName || !selection.subclusterName) {
      setSaveError('Select cluster and subcluster before saving schemas.');
      setSaveSuccess('');
      return;
    }

    try {
      setSaveLoading(true);
      setSaveError('');
      setSaveSuccess('');

      const subclusterPayload = buildEditableSchemaPayload(
        editedSchemas,
        editedDimensions,
        autoDateDimensionName,
        tableDescription,
      );
      const result = await rebuildOlapSchemas(
        selection.clusterName,
        selection.subclusterName,
        subclusterPayload,
      );

      setSaveSuccess(`Rebuild process started. Process ID: ${result.processId}`);

      let isComplete = false;
      let attempts = 0;
      const maxAttempts = 300;

      while (!isComplete && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        attempts++;

        try {
          const progress = await getRebuildProgress(result.processId);
          if (progress.status === 'success') {
            exitEditModeSilently();
            await onSuccess();
            setSaveError('');
            setSaveSuccess('Schema rebuild completed successfully!');
            isComplete = true;
          } else if (progress.status === 'failed') {
            setSaveSuccess('');
            setSaveError(`Rebuild failed: ${progress.error || progress.lastMessage}`);
            isComplete = true;
          }
        } catch {
          // Progress endpoint can 404 briefly while the worker starts.
        }
      }

      if (!isComplete) {
        setSaveError('Rebuild process timed out. Check backend logs for details.');
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to send rebuilt schemas');
    } finally {
      setSaveLoading(false);
    }
  }

  return {
    saveLoading,
    saveError,
    saveSuccess,
    clearRebuildStatus,
    handleRebuildSchemas,
  };
}
