import { API_BASE } from '../config/env';

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
}

export interface CreateProcessingRequest {
  type: 'IntellectualProcessing' | 'OlapSchemaRebuild';
  mongoDbServerUrl: string;
  assignedServer?: string;
}

export interface ProcessingStatusResponse {
  processId: string;
  message: string;
}

export async function fetchActiveProcesses(): Promise<ProcessingProcess[]> {
  const response = await fetch(`${API_BASE}/api/admin/processing/active`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch active processes: ${response.statusText}`);
  }

  return await response.json();
}

export async function fetchAllProcesses(): Promise<ProcessingProcess[]> {
  const response = await fetch(`${API_BASE}/api/admin/processing/all`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch all processes: ${response.statusText}`);
  }

  return await response.json();
}

export async function fetchProcess(processId: string): Promise<ProcessingProcess | null> {
  const response = await fetch(`${API_BASE}/api/admin/processing/${processId}`, {
    method: 'GET',
    credentials: 'include',
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch process: ${response.statusText}`);
  }

  return await response.json();
}

export async function initiateProcessing(
  request: CreateProcessingRequest,
): Promise<ProcessingStatusResponse> {
  const response = await fetch(`${API_BASE}/api/admin/processing/initiate`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `Failed to initiate processing: ${response.statusText}`);
  }

  return await response.json();
}
