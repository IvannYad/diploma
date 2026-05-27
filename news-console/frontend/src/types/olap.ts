export interface OlapSubclusterTree {
  name: string;
}

export interface OlapClusterTree {
  name: string;
  subclusters: OlapSubclusterTree[];
}

export interface OlapSchemaTree {
  clusters: OlapClusterTree[];
}

export interface OlapSchemaFactPayload {
  name: string;
  description: string;
  unit: string;
  dimensions: string[];
}

export interface OlapSchemaDimensionPayload {
  name: string;
  description: string;
  type: string;
  possible_values: string[];
}

export interface OlapSchemaPayload {
  table_description: string;
  facts: OlapSchemaFactPayload[];
  dimensions: OlapSchemaDimensionPayload[];
}

import type { FactInfo } from './news';

export type EditedSchema = FactInfo & { isNew?: boolean; isSoftDeleted?: boolean };

export type EditedDimension = {
  name: string;
  description: string;
  type: string;
  possible_values: string[];
};

export interface RebuildProcessStatus {
  processId: string;
  status: 'started' | 'running' | 'success' | 'failed';
  progress_endpoint?: string;
  currentStage?: string;
  stageProgress?: number;
  lastMessage?: string;
  error?: string;
}
