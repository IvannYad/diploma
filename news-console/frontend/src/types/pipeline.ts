export interface PipelineStatus {
  runId: string | null;
  isRunning: boolean;
  lastEvent: string;
  stage: string | null;
  stageIndex: number | null;
  totalStages: number | null;
  processed: number | null;
  total: number | null;
  percent: number | null;
  error: string | null;
  exitCode: number | null;
  startedAtUtc: string | null;
  lastUpdateUtc: string | null;
  finishedAtUtc: string | null;
}

export interface StartPipelineRequest {
  mongoUrl: string;
  openAiToken?: string;
  databaseName?: string;
  sourceCollection?: string;
  batchSize?: number;
  modelName?: string;
  skipCharts?: boolean;
  pythonExecutable?: string;
}

export interface StartPipelineResponse {
  started: boolean;
  runId?: string;
  message?: string;
  status: PipelineStatus;
}

export interface ClusterInfo {
  label: string;
  count: number;
}
