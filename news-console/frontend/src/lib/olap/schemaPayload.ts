import type { FactInfo } from '../../types/news';
import type { OlapSchemaPayload } from '../../types/olap';
import { findAutoDateDimensionName } from './dateDimension';
import type { EditedDimension, EditedSchema } from '../../types/olap';

export function cloneSchemasToEditState(facts: FactInfo[]): Record<string, EditedSchema> {
  return facts.reduce<Record<string, EditedSchema>>((acc, fact) => {
    acc[fact.name] = {
      ...fact,
      label: fact.label ?? '',
      dimensions: [...(fact.dimensions ?? [])],
    };
    return acc;
  }, {});
}

export function cloneDimensionsToEditState(
  dimensions: Array<{ name: string; description: string; type: string; possible_values?: string[] }>,
): Record<string, EditedDimension> {
  return dimensions.reduce<Record<string, EditedDimension>>((acc, dimension) => {
    acc[dimension.name] = {
      name: dimension.name,
      description: dimension.description ?? '',
      type: dimension.type ?? '',
      possible_values: [...(dimension.possible_values ?? [])],
    };
    return acc;
  }, {});
}

export function buildEditableSchemaPayload(
  editedSchemas: Record<string, EditedSchema>,
  editedDimensions: Record<string, EditedDimension>,
  autoDateDimensionName: string | null,
  tableDescription: string,
): OlapSchemaPayload {
  const activeFacts = Object.values(editedSchemas)
    .filter((schema) => !schema.isSoftDeleted)
    .map((schema) => {
      const dims = [...(schema.dimensions ?? [])];
      if (autoDateDimensionName && !dims.includes(autoDateDimensionName)) {
        dims.push(autoDateDimensionName);
      }
      return {
        name: schema.name,
        description: schema.description ?? '',
        unit: schema.unit ?? '',
        dimensions: dims,
      };
    });

  const dimensions = Object.values(editedDimensions).map((dimension) => ({
    name: dimension.name,
    description: dimension.description ?? '',
    type: dimension.type ?? 'categorical',
    possible_values: [...(dimension.possible_values ?? [])],
  }));

  return {
    table_description: tableDescription,
    facts: activeFacts,
    dimensions,
  };
}

export function dimensionsForFact(
  fact: FactInfo,
  olapDimensions: Array<{ name: string; description: string; type: string }>,
  autoDateDimensionName: string | null,
): Array<{ name: string; description: string; type: string }> {
  const dimensionNames = fact.dimensions?.length
    ? fact.dimensions
    : olapDimensions.map((dimension) => dimension.name);

  const dateDimensionName = autoDateDimensionName || findAutoDateDimensionName(olapDimensions);
  const ensuredNames = new Set(dimensionNames);
  if (dateDimensionName) {
    ensuredNames.add(dateDimensionName);
  }

  return Array.from(ensuredNames)
    .map((name) => olapDimensions.find((dimension) => dimension.name === name) ?? null)
    .filter((dimension): dimension is { name: string; description: string; type: string } => dimension !== null);
}
