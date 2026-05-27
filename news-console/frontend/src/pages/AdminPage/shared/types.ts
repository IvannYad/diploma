export interface UserRow {
  id: number;
  name: string;
  surname: string | null;
  email: string;
  role: string;
  isBlocked: boolean;
  createdAt: string;
}

export interface Server {
  id: number;
  ipAddress: string;
  maxCapacity: number;
  addedAt: string;
}

export interface ProcessingProcess {
  id: string;
  type: 'IntellectualProcessing' | 'OlapSchemaRebuild';
  isActive: boolean;
  assignedServer: string | null;
  mongoDbServerUrl: string | null;
  resultStatus: 'running' | 'success' | 'failed' | 'cancelled';
  resultMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  lastEvent?: string | null;
  currentStage?: string | null;
  stageIndex?: number | null;
  totalStages?: number | null;
  processed?: number | null;
  total?: number | null;
  percent?: number | null;
}

export type Tab = 'users' | 'servers' | 'processing';
