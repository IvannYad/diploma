import { useEffect, useMemo, useState } from 'react';
import { findAutoDateDimensionName, isAutoDateDimensionName } from '../../../lib/olap/dateDimension';
import {
  cloneDimensionsToEditState,
  cloneSchemasToEditState,
} from '../../../lib/olap/schemaPayload';
import type { FactInfo } from '../../../types/news';
import type { EditedDimension, EditedSchema } from '../../../types/olap';
import type { EditTab } from '../types';

type OlapDimension = {
  name: string;
  description: string;
  type: string;
  possible_values?: string[];
};

export function useSchemaEditor(olapFacts: FactInfo[], olapDimensions: OlapDimension[]) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [editTab, setEditTab] = useState<EditTab>('facts');
  const [selectedFactName, setSelectedFactName] = useState<string | null>(null);
  const [editedSchemas, setEditedSchemas] = useState<Record<string, EditedSchema>>({});
  const [editedDimensions, setEditedDimensions] = useState<Record<string, EditedDimension>>({});

  const displaySchemas = useMemo<EditedSchema[]>(() => {
    if (!isEditMode) {
      return olapFacts.map((fact) => ({
        ...fact,
        isSoftDeleted: false,
      }));
    }
    return Object.values(editedSchemas);
  }, [isEditMode, olapFacts, editedSchemas]);

  const availableDimensions = useMemo<EditedDimension[]>(() => {
    if (!isEditMode) {
      return olapDimensions.map((dimension) => ({
        ...dimension,
        possible_values: [...(dimension.possible_values ?? [])],
      }));
    }
    return Object.values(editedDimensions);
  }, [isEditMode, olapDimensions, editedDimensions]);

  const editableDimensions = useMemo(
    () => availableDimensions.filter((dimension) => !isAutoDateDimensionName(dimension.name)),
    [availableDimensions],
  );

  const autoDateDimensionName = useMemo(
    () => findAutoDateDimensionName(availableDimensions),
    [availableDimensions],
  );

  function exitEditModeSilently() {
    setIsEditMode(false);
    setEditTab('facts');
    setSelectedFactName(null);
    setEditedSchemas({});
    setEditedDimensions({});
  }

  function handleEditMode() {
    if (isEditMode) {
      exitEditModeSilently();
    } else {
      const nextEditedSchemas = cloneSchemasToEditState(olapFacts);
      const nextEditedDimensions = cloneDimensionsToEditState(olapDimensions);
      const nextAutoDate = findAutoDateDimensionName(Object.values(nextEditedDimensions));
      if (nextAutoDate) {
        Object.keys(nextEditedSchemas).forEach((factName) => {
          const dims = nextEditedSchemas[factName].dimensions ?? [];
          if (!dims.includes(nextAutoDate)) {
            nextEditedSchemas[factName].dimensions = [...dims, nextAutoDate];
          }
        });
      }
      setIsEditMode(true);
      setEditTab('facts');
      setEditedSchemas(nextEditedSchemas);
      setEditedDimensions(nextEditedDimensions);
      const firstSchema = Object.keys(nextEditedSchemas)[0] ?? null;
      setSelectedFactName(firstSchema ?? null);
    }
  }

  function handleAddSchema() {
    const newSchemaName = `new_fact_${Date.now()}`;
    setEditedSchemas((prev) => ({
      ...prev,
      [newSchemaName]: {
        name: newSchemaName,
        unit: '',
        description: '',
        dimensions: autoDateDimensionName ? [autoDateDimensionName] : [],
        isNew: true,
        isSoftDeleted: false,
      },
    }));
    setEditTab('facts');
    setSelectedFactName(newSchemaName);
  }

  function handleDeleteSchema(schemaName: string) {
    setEditedSchemas((prev) => {
      const updated = { ...prev };
      const target = updated[schemaName];
      if (!target) {
        return prev;
      }

      if (target.isSoftDeleted) {
        updated[schemaName] = { ...target, isSoftDeleted: false };
        return updated;
      }

      const activeCount = Object.values(updated).filter((schema) => !schema.isSoftDeleted).length;

      if (activeCount > 1) {
        updated[schemaName] = { ...target, isSoftDeleted: true };
        return updated;
      }

      const fallbackSchema = Object.values(updated).find(
        (schema) => schema.name !== schemaName && schema.isSoftDeleted,
      );

      if (fallbackSchema) {
        updated[schemaName] = { ...target, isSoftDeleted: true };
        updated[fallbackSchema.name] = { ...fallbackSchema, isSoftDeleted: false };
      }

      return updated;
    });
  }

  function handleUpdateSchema(schemaName: string, updates: Partial<EditedSchema>) {
    const nextUpdates = { ...updates };
    if (Array.isArray(nextUpdates.dimensions) && autoDateDimensionName) {
      if (!nextUpdates.dimensions.includes(autoDateDimensionName)) {
        nextUpdates.dimensions = [...nextUpdates.dimensions, autoDateDimensionName];
      }
    }

    setEditedSchemas((prev) => ({
      ...prev,
      [schemaName]: {
        ...prev[schemaName],
        ...nextUpdates,
      },
    }));
  }

  function handleUpdateDimension(dimensionName: string, updates: Partial<EditedDimension>) {
    setEditedDimensions((prev) => ({
      ...prev,
      [dimensionName]: {
        ...prev[dimensionName],
        ...updates,
      },
    }));
  }

  function handleAddDimension(name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }

    const key = trimmed.toLowerCase().replace(/\s+/g, '_');
    if (editedDimensions[key] || isAutoDateDimensionName(key)) {
      return;
    }

    setEditedDimensions((prev) => ({
      ...prev,
      [key]: {
        name: key,
        description: '',
        type: 'nominal',
        possible_values: [],
      },
    }));
  }

  function handleDeleteDimension(dimensionName: string) {
    if (isAutoDateDimensionName(dimensionName)) {
      return;
    }

    setEditedDimensions((prev) => {
      const updated = { ...prev };
      delete updated[dimensionName];
      return updated;
    });

    setEditedSchemas((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((factName) => {
        const dims = updated[factName].dimensions ?? [];
        if (dims.includes(dimensionName)) {
          updated[factName] = {
            ...updated[factName],
            dimensions: dims.filter((d) => d !== dimensionName),
          };
        }
      });
      return updated;
    });
  }

  function countActiveSchemas(): number {
    return Object.values(editedSchemas).filter((schema) => !schema.isSoftDeleted).length;
  }

  function hasUnsavedChanges(): boolean {
    if (!isEditMode) return false;

    const originalFactNames = new Set(olapFacts.map((f) => f.name));
    const editedFactNames = new Set(Object.keys(editedSchemas));

    if (originalFactNames.size !== editedFactNames.size) return true;

    for (const fact of olapFacts) {
      const edited = editedSchemas[fact.name];
      if (!edited) return true;
      if (edited.isSoftDeleted) return true;
      if (edited.unit !== fact.unit || edited.description !== fact.description) return true;
      if (edited.isNew) return true;

      const originalDims = fact.dimensions ?? [];
      const editedDims = edited.dimensions ?? [];
      if (originalDims.length !== editedDims.length) return true;
      if (!originalDims.every((d) => editedDims.includes(d))) return true;
    }

    const originalDimNames = new Set(olapDimensions.map((d) => d.name));
    const editedDimNames = new Set(Object.keys(editedDimensions));

    if (originalDimNames.size !== editedDimNames.size) return true;

    for (const dim of olapDimensions) {
      const edited = editedDimensions[dim.name];
      if (!edited) return true;
      if (
        edited.type !== (dim.type ?? '') ||
        edited.description !== (dim.description ?? '')
      ) {
        return true;
      }

      const originalValues = dim.possible_values ?? [];
      const editedValues = edited.possible_values ?? [];
      if (originalValues.length !== editedValues.length) return true;
      if (!originalValues.every((v) => editedValues.includes(v))) return true;
    }

    return false;
  }

  function handleCancelEdit(onClearStatus: () => void) {
    if (hasUnsavedChanges()) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to discard them?',
      );
      if (!confirmed) return;
    }

    exitEditModeSilently();
    onClearStatus();
  }

  useEffect(() => {
    if (!isEditMode || !hasUnsavedChanges()) {
      return;
    }

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = '';
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isEditMode, editedSchemas, editedDimensions, olapFacts, olapDimensions]);

  return {
    isEditMode,
    editTab,
    setEditTab,
    selectedFactName,
    setSelectedFactName,
    editedSchemas,
    setEditedSchemas,
    editedDimensions,
    displaySchemas,
    editableDimensions,
    autoDateDimensionName,
    exitEditModeSilently,
    handleEditMode,
    handleAddSchema,
    handleDeleteSchema,
    handleUpdateSchema,
    handleUpdateDimension,
    handleAddDimension,
    handleDeleteDimension,
    countActiveSchemas,
    handleCancelEdit,
    hasUnsavedChanges,
  };
}
